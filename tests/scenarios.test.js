'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '..', 'app.js');
const appModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
	module: appModule,
	process: { env: {} },
	require: (name) => (name === 'homey' ? { App: class {} } : {}),
}, { filename });
const App = appModule.exports;

function create({ localOnly = false, logging = false, authenticated = true } = {})
{
	const app = new App();
	const logs = [];
	const calls = [];
	const scenarios = [
		{ oid: 'morning', label: 'Open blinds' },
		{ oid: 'evening', label: 'Close blinds' },
	];
	const client = {
		authenticated,
		getActionGroups: async () =>
		{
			calls.push('fetch');
			return scenarios;
		},
		executeScenario: async (oid) =>
		{
			calls.push(['execute', oid]);
			return { execId: 'execution' };
		},
	};
	const card = {
		registerRunListener(listener) { this.run = listener; return this; },
		getArgument(name) { assert.equal(name, 'scenario'); return this; },
		registerAutocompleteListener(listener) { this.autocomplete = listener; return this; },
	};
	const settings = { username: 'user@example.com', password: 'secret', region: 'europe' };
	app.homey = {
		settings: { get: (key) => settings[key] },
		flow: {
			getActionCard: (id) =>
			{
				assert.equal(id, 'activate_scenario');
				return card;
			},
		},
	};
	app.localOnly = localOnly;
	app.infoLogEnabled = logging;
	app.tahomaCloud = client;
	app.tahomaLocal = {};
	app.logInformation = (...args) => logs.push(args);
	app.ensureCredentialsFromSessions = () => {};
	app.getCloudClientForSession = (username) =>
	{
		assert.equal(username, settings.username);
		return client;
	};
	app.ensureCloudSessionAuthenticated = async (...args) =>
	{
		calls.push(['authenticate', ...args]);
		client.authenticated = true;
		return true;
	};
	app.addScenarioActionListeners();
	return { app, card, client, calls, logs, scenarios };
}

for (const localOnly of [false, true])
{
	test(`scenario fetching uses cloud and preserves case-insensitive filtering (localOnly=${localOnly})`, async () =>
	{
		const { card, calls, logs } = create({ localOnly });
		const results = await card.autocomplete('OPEN');
		assert.deepEqual(JSON.parse(JSON.stringify(results)), [{ oid: 'morning', name: 'Open blinds' }]);
		assert.deepEqual(calls, ['fetch']);
		assert.deepEqual(logs, []);
	});

	test(`successful fetch logs all scenarios before filtering when enabled (localOnly=${localOnly})`, async () =>
	{
		const { card, logs, scenarios } = create({ localOnly, logging: true });
		const results = await card.autocomplete('missing');
		assert.equal(results.length, 0);
		assert.equal(logs.length, 1);
		assert.equal(logs[0][0], 'Cloud scenario fetch');
		assert.deepEqual(JSON.parse(JSON.stringify(logs[0][1])), {
			count: 2,
			scenarios,
		});
	});

	test(`scenario execution uses cloud (localOnly=${localOnly})`, async () =>
	{
		const { card, calls } = create({ localOnly });
		assert.deepEqual(await card.run({ scenario: { oid: 'evening' } }), { execId: 'execution' });
		assert.deepEqual(calls, [['execute', 'evening']]);
	});
}

test('local mode authenticates cloud on demand for fetching and execution', async () =>
{
	const { app, card, client, calls } = create({ localOnly: true, authenticated: false });
	await card.autocomplete('');
	await card.run({ scenario: { oid: 'morning' } });
	assert.equal(calls[0][0], 'authenticate');
	assert.deepEqual(calls[0].slice(1), ['user@example.com', 'secret', 'europe', false, 'scenario']);
	assert.deepEqual(calls.slice(1), ['fetch', ['execute', 'morning']]);
	assert.equal(client.authenticated, true);
	assert.equal(app.localOnly, true);
});

test('execution can authenticate cloud without first opening autocomplete', async () =>
{
	const { card, calls } = create({ localOnly: true, authenticated: false });
	await card.run({ scenario: { oid: 'morning' } });
	assert.equal(calls[0][0], 'authenticate');
	assert.deepEqual(calls[1], ['execute', 'morning']);
});

test('empty successful fetches are logged when enabled', async () =>
{
	const { card, scenarios, logs } = create({ logging: true });
	scenarios.length = 0;
	assert.equal((await card.autocomplete('')).length, 0);
	assert.equal(logs[0][1].count, 0);
	assert.equal(logs[0][1].scenarios.length, 0);
});

test('cloud authentication failure is logged and surfaced without fetching', async () =>
{
	const { app, card, calls, logs } = create({ localOnly: true, authenticated: false });
	app.ensureCloudSessionAuthenticated = async () => false;
	await assert.rejects(card.autocomplete(''), /cloud login is required for scenarios/i);
	assert.deepEqual(calls, []);
	assert.equal(logs.length, 1);
	assert.equal(logs[0][0], 'addScenarioActionListeners');
	await assert.rejects(card.run({ scenario: { oid: 'morning' } }), /cloud login is required for scenarios/i);
});

test('fetch failures are logged and surfaced without a success entry', async () =>
{
	const { card, client, logs } = create({ logging: true });
	const error = new Error('Request failed with status code 503');
	client.getActionGroups = async () => { throw error; };
	await assert.rejects(card.autocomplete(''), (actual) => actual === error);
	assert.deepEqual(logs, [['addScenarioActionListeners', error.message]]);
});
