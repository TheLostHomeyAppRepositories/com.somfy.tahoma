'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class HomeyStub {}

function load(relativePath)
{
	const filename = path.resolve(__dirname, '..', relativePath);
	const module = { exports: {} };
	vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
		module,
		process: { env: {} },
		require: (name) => (name === 'homey' ? {
			App: HomeyStub,
			SimpleClass: HomeyStub,
			env: { SOMFY_OAUTH_URL: 'https://accounts.example.test/token' },
		} : {}),
	}, { filename });
	return module.exports;
}

const Tahoma = load('lib\\Tahoma.js');
const App = load('app.js');

function deferred()
{
	let resolve;
	let reject;
	const promise = new Promise((res, rej) =>
	{
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function httpError(status, retryAfter)
{
	const error = new Error(`HTTP ${status}`);
	error.response = { status, headers: { 'retry-after': retryAfter } };
	return error;
}

function createClient()
{
	const client = Object.create(Tahoma.prototype);
	const settings = {};
	const logs = [];
	client.homey = {
		settings: {
			get: (key) => settings[key],
			set: (key, value) => { settings[key] = value; },
			unset: (key) => { delete settings[key]; },
		},
	};
	client.authenticated = true;
	client.localLogin = false;
	client.oauthLogin = true;
	client.username = 'user@example.test';
	client.password = 'test-password';
	client.region = 'europe';
	client.registerResponse = { id: 'old-listener' };
	client.refreshToken = 'old-refresh';
	client.oAuthTimeEnd = Date.now() + 60000;
	client.appInfoLoggingEnabled = () => false;
	client.appLogInformation = (...args) => logs.push(args);
	client.nextAuthCycleId = () => 'test-cycle';
	client.nextLoginStartNumber = () => 1;
	const headerChanges = [];
	client.httpHelper = {
		setDefaultHeaders: (headers, cookies) => headerChanges.push({ headers, cookies }),
		setBaseURL: () => {},
		post: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }),
		get: async () => 'test-user',
		delete: async () => ({ deleted: true }),
	};
	return { client, settings, logs, headerChanges };
}

for (const method of ['get', 'post', 'delete'])
{
	const request = (client) => client[`${method}WithReAuth`]('/test');

	test(`${method} waits for a single OAuth refresh without removing the current authorization`, async () =>
	{
		const { client, headerChanges } = createClient();
		const tokenResponse = deferred();
		let refreshCalls = 0;
		let requestCalls = 0;
		client.httpHelper.post = async (uri, config) =>
		{
			if (uri === 'https://accounts.example.test/token')
			{
				assert.equal(config.headers.Authorization, '');
				refreshCalls++;
				return tokenResponse.promise;
			}
			requestCalls++;
			return 'ok';
		};
		client.httpHelper[method] = method === 'post' ? client.httpHelper.post : async (uri) =>
		{
			if (uri === '/test')
			{
				requestCalls++;
			}
			return 'ok';
		};
		const firstRefresh = client.refreshOAuth();
		const secondRefresh = client.refreshOAuth();
		const command = request(client);
		assert.equal(headerChanges.length, 0);
		assert.equal(requestCalls, 0);
		tokenResponse.resolve({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
		await Promise.all([firstRefresh, secondRefresh, command]);
		assert.equal(refreshCalls, 1);
		assert.equal(requestCalls, 1);
		assert.equal(client.authenticated, true);
		assert.equal(client.refreshToken, 'new-refresh');
		assert.equal(client.registerResponse, null);
		assert.equal(client.oauthRefreshInFlight, null);
		assert.ok(headerChanges.every(({ headers }) => headers.Authorization));
	});

	test(`${method} shares reauthentication after concurrent 401 responses`, async () =>
	{
		const { client } = createClient();
		const loginStarted = deferred();
		const loginFinished = deferred();
		let loginCalls = 0;
		let calls = 0;
		client.httpHelper[method] = async () =>
		{
			calls++;
			if (calls <= 2)
			{
				throw httpError(401);
			}
			return 'ok';
		};
		client.login = async () =>
		{
			loginCalls++;
			loginStarted.resolve();
			await loginFinished.promise;
			client.authenticated = true;
		};
		const commands = [request(client), request(client)];
		await loginStarted.promise;
		loginFinished.resolve();
		assert.deepEqual(await Promise.all(commands), ['ok', 'ok']);
		assert.equal(loginCalls, 1);
		assert.equal(calls, 4);
		assert.equal(client.authenticated, true);
	});

	test(`${method} obeys a numeric Retry-After header and resumes when the block expires`, async () =>
	{
		const { client } = createClient();
		const error = httpError(429, '60');
		let calls = 0;
		client.httpHelper[method] = async () =>
		{
			calls++;
			if (calls === 1)
			{
				throw error;
			}
			return 'recovered';
		};
		const before = Date.now() / 1000;
		await assert.rejects(request(client), (err) => err === error);
		assert.equal(typeof client.blockedUntil, 'number');
		assert.ok(client.blockedUntil >= before + 60);
		assert.ok(client.blockedUntil <= Date.now() / 1000 + 60);
		await assert.rejects(request(client), /blocked for/);
		assert.equal(calls, 1);
		client.blockedUntil = before - 1;
		assert.equal(await request(client), 'recovered');
	});

	test(`${method} surfaces and applies rate limits from a retried request`, async () =>
	{
		const { client } = createClient();
		const retryError = httpError(429, '60');
		let calls = 0;
		client.login = async () => { client.authenticated = true; };
		client.httpHelper[method] = async () =>
		{
			throw (++calls === 1 ? httpError(401) : retryError);
		};
		await assert.rejects(request(client), (err) => err === retryError);
		assert.equal(typeof client.blockedUntil, 'number');
		assert.equal(calls, 2);
	});

	test(`${method} marks a rejected new session unauthenticated without retrying indefinitely`, async () =>
	{
		const { client } = createClient();
		let calls = 0;
		client.login = async () => { client.authenticated = true; };
		client.httpHelper[method] = async () =>
		{
			calls++;
			throw httpError(401);
		};
		await assert.rejects(request(client), /HTTP 401/);
		assert.equal(client.authenticated, false);
		assert.equal(calls, 2);
	});
}

test('a request already in flight uses the refreshed token instead of starting another login', async () =>
{
	const { client } = createClient();
	const requestResponse = deferred();
	const tokenResponse = deferred();
	let calls = 0;
	let logins = 0;
	client.httpHelper.get = async (uri) =>
	{
		if (uri === '/test' && ++calls === 1)
		{
			return requestResponse.promise;
		}
		return 'ok';
	};
	client.httpHelper.post = () => tokenResponse.promise;
	client.login = async () => { logins++; };
	const command = client.getWithReAuth('/test');
	const refresh = client.refreshOAuth();
	requestResponse.reject(httpError(401));
	tokenResponse.resolve({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
	await Promise.all([command, refresh]);
	assert.equal(logins, 0);
	assert.equal(client.authenticated, true);
});

test('a late 401 from the old token does not start another login after refresh completes', async () =>
{
	const { client } = createClient();
	const response = deferred();
	let calls = 0;
	let logins = 0;
	client.httpHelper.get = async (uri) =>
	{
		if (uri === '/test' && ++calls === 1)
		{
			return response.promise;
		}
		return 'ok';
	};
	client.login = async () => { logins++; };
	const command = client.getWithReAuth('/test');
	await client.refreshOAuth();
	response.reject(httpError(401));
	assert.equal(await command, 'ok');
	assert.equal(logins, 0);
});

test('the next event poll registers the refreshed session without deadlocking', async () =>
{
	const { client } = createClient();
	const requests = [];
	const { post } = client.httpHelper;
	client.httpHelper.post = async (uri, config, data) =>
	{
		requests.push(uri);
		if (uri === '/events/register')
		{
			return { id: 'new-listener' };
		}
		if (uri === '/events/new-listener/fetch')
		{
			return [];
		}
		return post(uri, config, data);
	};
	await client.refreshOAuth();
	assert.equal(await client.getEvents(), null);
	assert.deepEqual(await client.getEvents(), []);
	assert.deepEqual(requests, ['https://accounts.example.test/token', '/events/register', '/events/new-listener/fetch']);
});

test('logout waits for refresh and does not let it restore a logged-out session', async () =>
{
	const { client } = createClient();
	const response = deferred();
	const requests = [];
	client.httpHelper.post = async (uri) =>
	{
		requests.push(uri);
		if (uri === 'https://accounts.example.test/token')
		{
			return response.promise;
		}
		return {};
	};
	const refresh = client.refreshOAuth();
	const logout = client.logout();
	assert.deepEqual(requests, ['https://accounts.example.test/token']);
	response.resolve({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 });
	await Promise.all([refresh, logout]);
	assert.equal(client.authenticated, false);
	assert.equal(client.refreshToken, null);
	assert.equal(client.registerResponse, null);
	assert.deepEqual(requests, ['https://accounts.example.test/token', '/logout']);
});

test('failed OAuth refresh is logged, rejects waiters, and permits a fresh login', async () =>
{
	const { client, logs } = createClient();
	const tokenResponse = deferred();
	const error = new Error('Temporary token service failure');
	client.httpHelper.post = () => tokenResponse.promise;
	const refresh = client.refreshOAuth();
	const command = client.getWithReAuth('/test');
	tokenResponse.reject(error);
	await assert.rejects(refresh, (err) => err === error);
	await assert.rejects(command, (err) => err === error);
	assert.equal(client.authenticated, false);
	assert.equal(client.refreshToken, null);
	assert.equal(client.oauthRefreshInFlight, null);
	assert.ok(logs.some(([source, entry]) => source === 'Tahoma Refresh OAuth' && entry.message === 'Failed'));
	client.httpHelper.post = async () => ({ access_token: 'recovered', refresh_token: 'recovered', expires_in: 3600 });
	await client.login(client.username, client.password, 'europe', true, true);
	assert.equal(client.authenticated, true);
});

test('a failed 401 reauthentication releases its guard so the next attempt can recover', async () =>
{
	const { client } = createClient();
	let logins = 0;
	client.login = async () =>
	{
		if (++logins === 1)
		{
			throw new Error('Temporary login failure');
		}
		client.authenticated = true;
	};
	client.httpHelper.get = async () =>
	{
		if (logins < 2)
		{
			throw httpError(401);
		}
		return 'ok';
	};
	await assert.rejects(client.getWithReAuth('/test'), /Temporary login failure/);
	assert.equal(client.reAuthInFlight, null);
	assert.equal(client.authenticated, false);
	assert.equal(await client.getWithReAuth('/test'), 'ok');
	assert.equal(logins, 2);
});

test('OAuth refresh rate limits survive the next login attempt', async () =>
{
	const { client, settings } = createClient();
	let calls = 0;
	client.httpHelper.post = async () =>
	{
		calls++;
		throw httpError(429, '120');
	};
	await assert.rejects(client.refreshOAuth(), /HTTP 429/);
	assert.equal(settings.oAuthBlockedUntil, client.blockedUntil);
	await assert.rejects(client.login(client.username, client.password, 'europe', true, true), /blocked for/);
	assert.equal(calls, 1);
});

test('local 401 recovery still stores and uses the replacement bearer', async () =>
{
	const { client, settings } = createClient();
	client.localLogin = true;
	let calls = 0;
	let bearer;
	client.setAppLocalBearer = (value) => { bearer = value; };
	client.getLocalAuthCode = async () =>
	{
		client.authenticated = true;
		return 'replacement';
	};
	client.httpHelper.get = async () =>
	{
		if (++calls === 1)
		{
			throw httpError(401);
		}
		return 'ok';
	};
	assert.equal(await client.getWithReAuth('/test'), 'ok');
	assert.equal(settings.localBearer, 'replacement');
	assert.equal(bearer, 'replacement');
});

test('deleting a stale local token remains harmless but other bad requests are surfaced', async () =>
{
	const { client } = createClient();
	client.httpHelper.delete = async () => { throw httpError(400); };
	assert.equal(await client.deleteWithReAuth('/local/tokens/old'), null);
	await assert.rejects(client.deleteWithReAuth('/other'), /HTTP 400/);
});

test('login rate limits use seconds rather than string concatenation', async () =>
{
	const { client, settings } = createClient();
	client.authenticated = false;
	const error = httpError(429, '120');
	client.httpHelper.post = async () => { throw error; };
	const before = Date.now() / 1000;
	await assert.rejects(client.login(client.username, client.password, 'europe', true, true), (err) => err === error);
	assert.equal(typeof client.blockedUntil, 'number');
	assert.ok(client.blockedUntil >= before + 120);
	assert.ok(client.blockedUntil <= Date.now() / 1000 + 120);
	assert.equal(settings.oAuthBlockedUntil, client.blockedUntil);
	await assert.rejects(client.login(client.username, client.password, 'europe', true, true), /blocked for/);
});

test('HTTP-date Retry-After headers are respected and invalid values are logged', async () =>
{
	const { client, logs } = createClient();
	const until = new Date(Date.now() + 120000).toUTCString();
	client.httpHelper.get = async () => { throw httpError(429, until); };
	await assert.rejects(client.getWithReAuth('/test'), /HTTP 429/);
	assert.equal(client.blockedUntil, Date.parse(until) / 1000);
	client.blockedUntil = null;
	client.httpHelper.get = async () => { throw httpError(429, 'invalid'); };
	await assert.rejects(client.getWithReAuth('/test'), /HTTP 429/);
	assert.equal(client.blockedUntil, null);
	assert.ok(logs.some(([source]) => source === 'Tahoma Retry-After'));
});

function createApp()
{
	const app = new App();
	const timers = [];
	const logs = [];
	app.homey = {
		clearTimeout: () => {},
		setTimeout: (callback, delay) =>
		{
			const timer = { callback, delay };
			timers.push(timer);
			return timer;
		},
	};
	app.nextCloudInterval = 1;
	app.localOnly = false;
	app.syncing = false;
	app.boostTimerId = null;
	app.cloudLastSyncBySession = {};
	app.normalizeSessionEmail = (value) => value;
	app.logInformation = (...args) => logs.push(args);
	app.updateConnectivityWarningFromLoginIssue = async () => {};
	app.isTransientSyncError = () => false;
	app.syncEvents = async () => {};
	app.syncAllCloudSessions = async () => 30000;
	return { app, timers, logs };
}

test('cloud polling automatically logs back in after a failed token refresh', async () =>
{
	const { client } = createClient();
	const { app } = createApp();
	let tokenCalls = 0;
	const requests = [];
	client.httpHelper.post = async (uri) =>
	{
		requests.push(uri);
		if (uri === 'https://accounts.example.test/token')
		{
			if (++tokenCalls === 1)
			{
				throw new Error('Temporary refresh failure');
			}
			return { access_token: 'recovered', refresh_token: 'recovered', expires_in: 3600 };
		}
		if (uri === '/events/register')
		{
			return { id: 'recovered-listener' };
		}
		return [];
	};
	app.getCloudClientForSession = () => client;
	app.getCloudPollingSessions = () => [{ username: client.username, password: client.password, region: client.region }];
	app.cloudSessionRetryAfter = {};
	app.homey.setTimeout = (callback) => { callback(); };
	let stateRefreshes = 0;
	app.syncEvents = async (events) =>
	{
		assert.equal(events, null);
		stateRefreshes++;
	};
	await assert.rejects(client.refreshOAuth(), /Temporary refresh failure/);
	assert.equal(client.authenticated, false);
	await App.prototype.syncAllCloudSessions.call(app);
	assert.equal(client.authenticated, true);
	assert.equal(client.refreshToken, 'recovered');
	assert.equal(client.registerResponse.id, 'recovered-listener');
	assert.equal(tokenCalls, 2);
	assert.equal(stateRefreshes, 1);
	assert.equal(requests[requests.length - 1], '/events/register');
});

for (const local of [false, true])
{
	test(`polling recovers after a rejected ${local ? 'local' : 'cloud'} operation`, async () =>
	{
		const { app, timers, logs } = createApp();
		let calls = 0;
		const poll = async () =>
		{
			if (++calls === 1)
			{
				throw new Error('Temporary polling failure');
			}
			return 30000;
		};
		if (local)
		{
			app.tahomaLocal = {};
			app.syncAllLocalBridges = poll;
		}
		else
		{
			app.syncAllCloudSessions = poll;
		}
		app.syncLoop = app.syncLoop.bind(app);
		let recoveries = 0;
		app.initSync = async () =>
		{
			recoveries++;
			app.nextCloudInterval = 1;
			await app.syncLoop();
		};
		await app.syncLoop();
		assert.equal(timers.length, 1);
		assert.equal(timers[0].delay, 10000);
		assert.ok(logs.some((entry) => entry.some((value) => String(value).includes('Temporary polling failure'))));
		await timers[0].callback();
		assert.equal(recoveries, 1);
		assert.equal(calls, 2);
		assert.equal(timers.length, 2);
	});
}

test('syncWorker releases its busy flag even if error handling fails, then can poll again', async () =>
{
	const { app } = createApp();
	const connection = {
		authenticated: true,
		username: 'user@example.test',
		getEvents: async () => { throw new Error('Far Too many OAuth login attempts (blocked for 15 minutes)'); },
	};
	app.updateConnectivityWarningFromLoginIssue = async (issue) =>
	{
		if (issue)
		{
			throw new Error('Warning update failed');
		}
	};
	await assert.rejects(app.syncWorker(connection), /Warning update failed/);
	assert.equal(app.syncing, false);
	app.cloudLastSyncBySession = {};
	let polls = 0;
	connection.getEvents = async () => { polls++; return []; };
	await app.syncWorker(connection);
	assert.equal(polls, 1);
	assert.equal(app.syncing, false);
});

test('a worker that does not own the busy flag leaves the active worker alone', async () =>
{
	const { app } = createApp();
	app.syncing = true;
	await app.syncWorker({ authenticated: true });
	assert.equal(app.syncing, true);
});
