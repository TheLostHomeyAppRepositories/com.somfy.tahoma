/* eslint-disable max-len */
/* jslint node: true */

'use strict';

/* eslint-disable no-use-before-define */
const Homey = require('homey');
const https = require('https');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const HttpHelper = require('./HttpHelper');

/* OAuth login information from https://github.com/yenoiwesa/homebridge-connexoon */

module.exports = class Tahoma extends Homey.SimpleClass
{

	constructor(Homey, Local)
	{
		super();

		this.registerResponse = null;
		this.refreshToken = null;
		this.authenticated = false;
		this.localLogin = Local;
		this.oauthLogin = null;

		this.homey = Homey;
		this.httpsAgent = null;
		if (Local)
		{
			const crtFile = path.resolve('lib', '..', 'assets', 'overkiz-root-ca-2048.crt');
			this.local_httpsAgent = new https.Agent({ ca: fs.readFileSync(crtFile) });
		}
		this.httpHelper = new HttpHelper();
		this.username = null;
		this.password = null;
		this.region = 'europe';
		this.devicePin = null;
		this.port = null;
		this.homeyID = null;
		this.supportedDevices = null;
		this.lastLoginIssue = '';

		return this;
	}

	getAppInstance()
	{
		try
		{
			return this.homey.app;
		}
		catch (error)
		{
			return null;
		}
	}

	setAppLocalBearer(bearer)
	{
		const app = this.getAppInstance();
		if (app)
		{
			app.localBearer = bearer;
		}
	}

	appInfoLoggingEnabled()
	{
		const app = this.getAppInstance();
		return !!(app && app.infoLogEnabled);
	}

	appVarToString(value)
	{
		const app = this.getAppInstance();
		if (app && (typeof app.varToString === 'function'))
		{
			return app.varToString(value);
		}

		try
		{
			return JSON.stringify(value);
		}
		catch (error)
		{
			return String(value);
		}
	}

	appLogInformation(source, payload)
	{
		const app = this.getAppInstance();
		if (app && (typeof app.logInformation === 'function'))
		{
			app.logInformation(source, payload);
		}
	}

	// Throws an error if the post fails but will handle re-authentication
	async postWithReAuth(uri, config, data)
	{
		if (this.blockedUntil)
		{
			const secondsNow = (Date.now() / 1000);
			if (secondsNow < this.blockedUntil)
			{
				// still blocked due to too many requests
				throw (new Error(`blocked for ${this.blockedUntil - secondsNow}s`));
			}

			this.blockedUntil = null;
		}

		if (this.httpsAgent)
		{
			if (config)
			{
				config.httpsAgent = this.httpsAgent;
			}
			else
			{
				config = { httpsAgent: this.httpsAgent };
			}
		}

		try
		{
			return await this.httpHelper.post(uri, config, data);
		}
		catch (error)
		{
			if (error.response && error.response.status === 401)
			{
				// Not authorised so login again
				this.authenticated = false;
				if (this.localLogin)
				{
					const bearer = await this.getLocalAuthCode(this.username, this.password, this.region, this.devicePin, this.port, null, this.homeyID);
					this.homey.settings.set('localBearer', bearer);
					this.setAppLocalBearer(bearer);
				}
				else
				{
					await this.login(this.username, this.password, this.region, this.oauthLogin, true, true);
				}

				try
				{
					return await this.httpHelper.post(uri, config, data);
				}
				catch (err)
				{
					throw (error);
				}
			}
			if (error.response && error.response.status === 429)
			{
				// Too many request. Header should contain Retry-After: time in seconds
				if (error.response.headers['retry-after'])
				{
					const blockedFor = error.response.headers['retry-after'];
					this.blockedUntil = (Date.now() / 1000) + blockedFor;
				}
			}
			throw (error);
		}
	}

	// Throws an error if the get fails but will handle re-authentication
	async getWithReAuth(uri)
	{
		if (this.blockedUntil)
		{
			const secondsNow = (Date.now() / 1000);
			if (secondsNow < this.blockedUntil)
			{
				// still blocked due to too many requests
				throw (new Error(`blocked for ${this.blockedUntil - secondsNow}s`));
			}

			this.blockedUntil = null;
		}

		try
		{
			return await this.httpHelper.get(uri, this.httpsAgent ? { httpsAgent: this.httpsAgent } : {});
		}
		catch (error)
		{
			if (error.response && error.response.status === 401)
			{
				// Not authorised so login again
				this.authenticated = false;
				if (this.localLogin)
				{
					const bearer = await this.getLocalAuthCode(this.username, this.password, this.region, this.devicePin, this.port, null, this.homeyID);
					this.homey.settings.set('localBearer', bearer);
					this.setAppLocalBearer(bearer);
				}
				else
				{
					await this.login(this.username, this.password, this.region, this.oauthLogin, true, true);
				}

				return this.httpHelper.get(uri, this.httpsAgent ? { httpsAgent: this.httpsAgent } : {});
			}
			if (error.response && error.response.status === 429)
			{
				// Too many request. Header should contain Retry-After: time in seconds
				if (error.response.headers['retry-after'])
				{
					const blockedFor = error.response.headers['retry-after'];
					this.blockedUntil = (Date.now() / 1000) + blockedFor;
				}
				throw (error);
			}
			else
			{
				throw (error);
			}
		}
	}

	// Throws an error if the delete fails but will handle re-authentication
	async deleteWithReAuth(uri)
	{
		if (this.blockedUntil)
		{
			const secondsNow = (Date.now() / 1000);
			if (secondsNow < this.blockedUntil)
			{
				// still blocked due to too many requests
				throw (new Error(`blocked for ${this.blockedUntil - secondsNow}s`));
			}

			this.blockedUntil = null;
		}

		try
		{
			return await this.httpHelper.delete(uri, this.httpsAgent ? { httpsAgent: this.httpsAgent } : {});
		}
		catch (error)
		{
			if (error.response && error.response.status === 400 && uri && uri.indexOf('/local/tokens/') >= 0)
			{
				// Bridge can return 400 when the token is already invalid/stale.
				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation('Tahoma Local Login',
					{
						message: 'Ignoring local token delete 400 for stale token',
						stack: uri,
					});
				}

				return null;
			}

			if (error.response && error.response.status === 401)
			{
				// Not authorised so login again
				this.authenticated = false;
				if (this.localLogin)
				{
					const bearer = await this.getLocalAuthCode(this.username, this.password, this.region, this.devicePin, this.port, null, this.homeyID);
					this.homey.settings.set('localBearer', bearer);
					this.setAppLocalBearer(bearer);
				}
				else
				{
					await this.login(this.username, this.password, this.region, this.oauthLogin, true, true);
				}

				return this.httpHelper.delete(uri, this.httpsAgent ? { httpsAgent: this.httpsAgent } : {});
			}
			if (error.response && error.response.status === 429)
			{
				// Too many request. Header should contain Retry-After: time in seconds
				if (error.response.headers['retry-after'])
				{
					const blockedFor = error.response.headers['retry-after'];
					this.blockedUntil = (Date.now() / 1000) + blockedFor;
				}
			}
			else
			{
				throw (error);
			}
		}

		return null;
	}

	async getLocalAuthCode(username, password, region, devicePin, port, bearer, homeyID, newToken = null)
	{
		try
		{
			this.lastLocalTokenError = null;

			if (!bearer)
			{
				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation('Tahoma Local Login',
					{
						message: 'Connecting to the cloud to fetch a token',
					});
				}

				if (newToken == null)
				{
					// Login to the web auth server so we can generate a new token
					await this.login(username, password, region, true);

					if (this.appInfoLoggingEnabled())
					{
						this.appLogInformation('Tahoma Local Login',
						{
							message: 'Deleting old Homey local tokens',
						});
					}

					const localTokenList = await this.httpHelper.get(`/config/${devicePin}/local/tokens/devmode`, {}, false);
					const label = `Homey token ${homeyID}`;
					const deletePromises = localTokenList
						.filter((token) => token.label === label)
						.map((token) => this.deleteWithReAuth(`/config/${devicePin}/local/tokens/${token.uuid}`));

					if (deletePromises.length > 0)
					{
						const deleteResults = await Promise.allSettled(deletePromises);
						if (this.appInfoLoggingEnabled())
						{
							const failed = deleteResults.filter((result) => result.status === 'rejected');
							if (failed.length > 0)
							{
								this.appLogInformation('Tahoma Local Login',
								{
									message: `Token cleanup had ${failed.length} failure(s)`,
								});
							}
						}
					}

					if (this.appInfoLoggingEnabled())
					{
						this.appLogInformation('Tahoma Local Login',
						{
							message: 'Generating a new Homey token',
						});
					}

					// Generate a new local token
					newToken = await this.httpHelper.get(`/config/${devicePin}/local/tokens/generate`, {}, false);

					// Activate the local token
					const data = {
						label: `Homey token ${homeyID}`,
						token: newToken.token,
						scope: 'devmode',
					};

					const options = {
						json: true,
					};

					// Fetch the local tokens to make sure the connection is working
					const tokens = await this.httpHelper.post(`/config/${devicePin}/local/tokens`, options, data);
					if (this.appInfoLoggingEnabled())
					{
						this.appLogInformation('Tahoma Local Login',
						{
							message: 'Local Token Obtained',
							stack: tokens,
						});
					}
				}

				bearer = newToken.token;
			}

			this.username = username;
			this.password = password;
			this.region = region;
			this.devicePin = devicePin;
			this.port = port;
			this.homeyID = homeyID;

			// Use local certificate
			const crtFile = path.resolve('lib', '..', 'assets', 'overkiz-root-ca-2048.crt');
			this.local_httpsAgent = new https.Agent({ ca: fs.readFileSync(crtFile), servername: `${devicePin}.local` });
			this.httpsAgent = this.local_httpsAgent;

			// switch to local URL
			this.httpHelper.setBaseURL('local', devicePin, port);
			let hostName = this.httpHelper.getHostName('local', devicePin);

			// Setup the token header and stop using token cookie
			const headers = {
				'content-type': 'application/json',
				Authorization: `Bearer ${bearer}`,
				'User-Agent': 'homey',
			};

			this.httpHelper.setDefaultHeaders(headers, false);

			try
			{
				// Test the connection to the local server
				await this.getLocalAPIVersion();
			}
			catch (err)
			{
				let errCode = 'unknown';
				if (err && err.data && err.data.code)
				{
					errCode = err.data.code;
				}
				else if (err && err.code)
				{
					errCode = err.code;
				}
				this.appLogInformation('Tahoma Local Login',
				{
					message: `local1 connection failed: ${errCode}: Trying local2`,
				});

				if (errCode === 'ENOTFOUND')
				{
					this.httpHelper.setBaseURL('local2', devicePin, port);
					hostName = this.httpHelper.getHostName('local2', devicePin);
					await this.getLocalAPIVersion();
				}
			}

			this.localLogin = true;
			this.authenticated = true;

			if (this.appInfoLoggingEnabled())
			{
				this.appLogInformation('Tahoma Local Login',
				{
					message: `Set local token for https://${hostName}`,
				});
			}

			return bearer;
		}
		catch (err)
		{
			const statusCode = err && err.response ? err.response.status : null;
			this.lastLocalTokenError = {
				statusCode,
				message: err && err.message ? err.message : 'Unknown local token error',
				time: Date.now(),
			};

			this.appLogInformation('Tahoma Local Login',
			{
				message: 'Failed to get Local Token',
				stack: statusCode ? `${statusCode}: ${err.message}` : err.message,
			});
		}

		return null;
	}

	async getLocalTokens(devicePin)
	{
		if (!this.authenticated)
		{
			throw (new Error('Not logged in yet'));
		}

		if (this.localLogin)
		{
			throw (new Error('Not availbale for local login'));
		}

		return this.httpHelper.get(`/config/${devicePin}/local/tokens/devmode`);
	}

	async deleteLocalToken(devicePin, uuid)
	{
		if (!this.authenticated)
		{
			throw (new Error('Not logged in yet'));
		}

		if (this.localLogin)
		{
			throw (new Error('Not availbale for local login'));
		}

		return this.deleteWithReAuth(`/config/${devicePin}/local/tokens/${uuid}`);
	}

	// Throws an error if the login fails
	async login(username, password, region, oauthLogin, fromPro, fromReAuthenticate = false)
	{
		region = region || this.region || 'europe';
		let attemptsKey = 'loginAttempts';
		let timeKey = 'loginTime';
		let type = 'simple';
		let blockedUntilKey = 'simpleBlockedUntil';
		let loginTime = this.homey.settings.get(timeKey);

		const maxAttempts = fromPro ? 5 : 2;
		if (fromPro === undefined)
		{
			attemptsKey = 'loginAttemptsLocal';
			timeKey = 'loginTimeLocal';
			type = 'local';
			blockedUntilKey = 'localBlockedUntil';
		}
		else if (oauthLogin)
		{
			attemptsKey = 'loginAttemptsOA';
			timeKey = 'loginTimeOA';
			type = 'OAuth';
			blockedUntilKey = 'oAuthBlockedUntil';
		}

		this.blockedUntil = this.homey.settings.get(blockedUntilKey);

		if (!fromReAuthenticate && this.authenticated)
		{
			// Already authenticated. Logout first to do a new login
			if (this.appInfoLoggingEnabled())
			{
				const lastTime = new Date(loginTime);
				this.appLogInformation(`Tahoma Cloud Login for ${type} connection`,
				{
					message: 'Already Logged in',
					stack: `Next Login time: ${lastTime.toJSON()}`,
				});
			}
			return;
		}

		if (this.blockedUntil)
		{
			const secondsNow = (Date.now() / 1000);
			if (secondsNow < this.blockedUntil)
			{
				// still blocked due to too many requests
				throw (new Error(`blocked for ${this.blockedUntil - secondsNow}s`));
			}

			this.blockedUntil = null;
			this.homey.settings.unset(blockedUntilKey);
		}

		// Keep track of the number of login attempts
		let loginAttempts = this.homey.settings.get(attemptsKey);
		if (!loginAttempts || !loginTime)
		{
			// First login attempt
			loginAttempts = 0;
			loginTime = Date.now();
		}

		const lastTime = new Date(loginTime);
		const dateNow = new Date();

		// validate the time difference to make sure it is not too long as some users have reported issues
		if ((loginTime - dateNow) > (fromPro ? 900000 : 86400000))
		{
			// Too long so reset the login attempts
			loginAttempts = 0;
			loginTime = Date.now();
		}

		if (loginAttempts > 0)
		{
			if (this.appInfoLoggingEnabled())
			{
				this.appLogInformation(`Tahoma Cloud Login for ${type} connection`,
				{
					message: 'Re-attempt Cloud Login',
					stack: `Login attempts: ${loginAttempts}, next allowed login time: ${lastTime.toJSON()}, current time: ${dateNow.toJSON()}`,
				});
			}

			if (loginTime > dateNow)
			{
				this.lastLoginIssue = loginAttempts <= maxAttempts ? `Please leave 1 minutes between cloud login attempts, next allowed login time: ${lastTime.toJSON()}` : `Far Too many ${type} login attempts (blocked for ${fromPro ? '15 minutes' : '24 hours'})`;
				throw (new Error(this.lastLoginIssue));
			}
		}
		else if (this.appInfoLoggingEnabled())
		{
			const lastTime = new Date(loginTime);
			this.appLogInformation(`Tahoma Cloud Login for ${type} connection`,
			{
				message: 'First Cloud Login attempt',
				stack: `Next allowed login time: ${lastTime.toJSON()}`,
			});
		}

		loginAttempts++;
		if (loginAttempts <= maxAttempts)
		{
			// Add on 1 minute
			loginTime = Date.now() + 60000;
		}
		else
		{
			// Add on 15 minutes for Pro and 12 hours for cloud
			loginTime = Date.now() + (fromPro ? 900000 : 86400000);
		}

		this.homey.settings.set(attemptsKey, loginAttempts);
		this.homey.settings.set(timeKey, loginTime);

		try
		{
			// if (https.globalAgent.options.ca)
			// {
			//    https.globalAgent.options.ca = null;
			// }

			this.httpHelper.setBaseURL(region);
			this.registerResponse = null;
			this.registeringEvents = false;

			// Check the type of login required
			if (!oauthLogin)
			{
				if (this.appInfoLoggingEnabled())
				{
					// Use simple login
					this.appLogInformation(`Tahoma Cloud Login for ${type} connection`,
					{
						message: 'Start Simple Login',
						stack: { attempts: loginAttempts, linkURL: region },
					});
				}

				// Clear the headers and use token cookie
				this.httpHelper.setDefaultHeaders({}, true);

				const form = new FormData();
				form.append('userId', username);
				form.append('userPassword', password);

				const headers = form.getHeaders();

				const result = await this.httpHelper.post('/login', { headers }, form);
				this.username = username;
				this.password = password;
				this.region = region;
				this.oauthLogin = oauthLogin;
				this.authenticated = true;

				this.homey.settings.unset(attemptsKey);
				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation(`Tahoma Cloud simple Login for ${type} connection`,
					{
						message: 'Successful',
						stack: result,
					});
				}
			}
			else
			{
				// Use OAuth login
				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation(`Tahoma Cloud Login for ${type} connection`,
					{
						message: 'Start OAuth Login',
						stack: { attempts: this.loginAttempts, blocked: this.loginsBlocked, linkURL: region },
					});
				}

				// Clear the headers and use credentials
				this.httpHelper.setDefaultHeaders({}, true);

				const data = {
					grant_type: 'password',
					username,
					password,
					client_id: Homey.env.SOMFY_OAUTH_CLIENT_ID,
					client_secret: Homey.env.SOMFY_OAUTH_CLIENT_SECRET,
				};

				const config = {
					headers:
					{
						'content-type': 'application/json',
						host: 'accounts.somfy.com',
						'User-Agent': 'homey',
					},
				};

				this.httpsAgent = null;

				// Throws an exception if login fails
				const result = await this.httpHelper.post(Homey.env.SOMFY_OAUTH_URL, config, data);

				// Setup the token header and stop using token cookie
				const headers = {
					Authorization: `Bearer ${result.access_token}`,
					'User-Agent': 'homey',
				};

				this.httpHelper.setDefaultHeaders(headers, false);

				// get the User ID as it is quick and will test if the OAuth login allows us to use the API
				const userId = await this.getUserId();

				this.homey.settings.unset(attemptsKey);
				this.username = username;
				this.password = password;
				this.region = region;
				this.oauthLogin = oauthLogin;
				this.authenticated = true;
				this.refreshToken = result.refresh_token;
				this.oAuthTimeEnd = Date.now() + ((result.expires_in - 1) * 1000);

				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation(`Tahoma Cloud Login for ${type} connection`,
					{
						message: `Successful as ${this.appVarToString(userId)}`,
						stack: result,
					});
				}
			}
		}
		catch (error)
		{
			this.appLogInformation(`Tahoma Cloud Login for ${type} connection`, `Error: ${error.message}`);
			this.authenticated = false;

			if (error.response && error.response.status === 429)
			{
				// Too many request. Header should contain Retry-After: time in seconds
				if (error.response.headers['retry-after'])
				{
					const blockedFor = error.response.headers['retry-after'];
					this.blockedUntil = (Date.now() / 1000) + blockedFor;
				}
			}
			else if (error.response && ((error.response.status === 403) || (error.response.status === 401)))
			{
				// Block for 15 minutes for Pro and 24 hours for cloud
				const blockedFor = (error.response.status === 403) ? 15 * 60 : 24 * 60 * 60;
				this.blockedUntil = (Date.now() / 1000) + blockedFor;
				this.homey.settings.set(blockedUntilKey, this.blockedUntil);
			}
			throw (error);
		}
	}

	async refreshOAuth()
	{
		if (this.refreshToken)
		{
			// Use OAuth login
			if (this.appInfoLoggingEnabled())
			{
				this.appLogInformation('Tahoma Refresh OAuth',
				{
					message: 'Start OAuth Refresh',
					stack: { attempts: this.loginAttempts, blocked: this.loginsBlocked },
				});
			}

			const reRegisterEvents = (this.registerResponse !== null);
			this.registerResponse = null;

			// Clear the headers and use credentials
			this.httpHelper.setDefaultHeaders({}, true);

			const data = {
				grant_type: 'refresh_token',
				refresh_token: this.refreshToken,
				client_id: Homey.env.SOMFY_OAUTH_CLIENT_ID,
				client_secret: Homey.env.SOMFY_OAUTH_CLIENT_SECRET,
			};

			const config = {
				headers:
				{
					'content-type': 'application/json',
					host: 'accounts.somfy.com',
					'User-Agent': 'homey',
				},
			};

			try
			{
				// Throws an exception if login fails
				const result = await this.httpHelper.post(Homey.env.SOMFY_OAUTH_URL, config, data);

				// Setup the token header and stop using token cookie
				const headers = {
					Authorization: `Bearer ${result.access_token}`,
					'User-Agent': 'homey',
				};

				this.httpHelper.setDefaultHeaders(headers, false);

				// get the User ID as it is quick and will test if the OAuth login allows us to use the API
				const userId = await this.getUserId();

				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation('Tahoma Refresh OAuth',
					{
						message: `Successful as ${this.appVarToString(userId)}`,
						stack: result,
					});
				}

				this.refreshToken = result.refresh_token;
				this.oAuthTimeEnd = Date.now() + ((result.expires_in - 1) * 1000);
				if (reRegisterEvents)
				{
					await this.registerEvents();
				}
			}
			catch (err)
			{
				this.refreshToken = null;
				this.appLogInformation('Tahoma Refresh OAuth',
				{
					message: 'Failed',
					stack: err,
				});
			}
		}
	}

	getOAuthTimeLeft()
	{
		if (this.refreshToken)
		{
			let timeLeft = (this.oAuthTimeEnd - Date.now()) / 1000;
			if (timeLeft < 0)
			{
				timeLeft = 0;
			}
			return timeLeft;
		}
		return -1;
	}

	async logout()
	{
		try
		{
			if (!this.localLogin && this.authenticated)
			{
				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation('Tahoma Log Out',
					{
						message: 'Request Logout',
					});
				}

				await this.httpHelper.post('/logout');

				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation('Tahoma Log Out',
					{
						message: 'Successful',
					});
				}
			}
		}
		catch (error)
		{
			this.appLogInformation('Tahoma Log Out',
			{
				message: 'Failed',
				stack: error,
			});
		}

		try
		{
			await this.eventsClearRegistered();
		}
		catch (error)
		{
			this.homey.error('Tahoma Log Out: eventsClearRegistered failed', error);
		}

		// Clear the headers and don't use credentials
		this.httpHelper.setDefaultHeaders({}, false);
		this.httpsAgent = null;
		this.authenticated = false;
	}

	async getLocalAPIVersion()
	{
		return this.httpHelper.get('apiVersion', { httpsAgent: this.httpsAgent }, false);
	}

	async getSetupOID()
	{
		if (this.authenticated)
		{
			return this.httpHelper.get('/enduser/defaultSetupOID');
		}
		throw (new Error('Not Logged in'));
	}

	extractGatewayIdFromDeviceURL(deviceURL)
	{
		if (!deviceURL)
		{
			return '';
		}

		const match = `${deviceURL}`.match(/^[^:]+:\/\/([^/]+)\//);
		return (match && match[1]) ? match[1] : '';
	}

	annotateDevicesWithGateway(devices)
	{
		if (!Array.isArray(devices))
		{
			return [];
		}

		return devices.map((device) =>
		{
			const gatewayId = (device && device.gatewayId)
				? `${device.gatewayId}`
				: this.extractGatewayIdFromDeviceURL(device && device.deviceURL ? device.deviceURL : '');

			return {
				...device,
				gatewayId,
			};
		});
	}

	async getSetupSnapshot()
	{
		const snapshot = {
			setup: null,
			gateways: null,
			devices: null,
		};

		try
		{
			snapshot.setup = await this.getWithReAuth('/setup');
			if (snapshot.setup && Array.isArray(snapshot.setup.gateways))
			{
				snapshot.gateways = snapshot.setup.gateways;
			}

			if (snapshot.setup && Array.isArray(snapshot.setup.devices))
			{
				snapshot.devices = snapshot.setup.devices;
			}
		}
		catch (error)
		{
			// Fallback to dedicated setup endpoints below.
		}

		if (!Array.isArray(snapshot.gateways))
		{
			try
			{
				snapshot.gateways = await this.getWithReAuth('/setup/gateways');
			}
			catch (error)
			{
				snapshot.gateways = [];
			}
		}

		if (!Array.isArray(snapshot.devices))
		{
			snapshot.devices = await this.getWithReAuth('/setup/devices');
		}

		return snapshot;
	}

	async getDeviceData()
	{
		if (this.authenticated)
		{
			const setupSnapshot = await this.getSetupSnapshot();
			const devices = this.annotateDevicesWithGateway(setupSnapshot.devices);
			this.supportedDevices = devices.map((device) => (
			{
				deviceURL: device.deviceURL,
				gatewayId: device.gatewayId || '',
			}));

			if (this.appInfoLoggingEnabled())
			{
				const gateways = Array.isArray(setupSnapshot.gateways) ? setupSnapshot.gateways : [];
				const gatewayIdsFromDevices = [...new Set(devices
					.map((device) => this.extractGatewayIdFromDeviceURL(device && device.deviceURL ? device.deviceURL : ''))
					.filter((gatewayId) => !!gatewayId))];

				this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} setup discovery`,
				{
					gatewaysFromAPI: gateways.map((gateway) => ({
						gatewayId: gateway.gatewayId,
						placeOID: gateway.placeOID,
						type: gateway.type,
						alive: gateway.alive,
					})),
					gatewayIdsFromDevices,
					deviceCount: devices.length,
				});
			}

			if (this.homey.settings.get('debugMode'))
			{
				const simData = this.homey.settings.get('simData');
				if (simData)
				{
					if (this.localLogin && simData.devices && simData.devices.local)
					{
						// Return the simulated data as an array of local devices
						return simData.devices.local.devices;
					}

					if (!this.localLogin && simData.devices && simData.devices.cloud)
					{
						// Return the simulated data as an array of cloud devices
						if (simData.devices.cloud.devices && Array.isArray(simData.devices.cloud.devices))
						{
							return simData.devices.cloud.devices;
						}
						return simData.devices.cloud;
					}

					return simData;
				}
			}

			return devices;
		}
		throw (new Error('Not Logged in'));
	}

	async getDeviceStates(deviceUrl)
	{
		if (this.authenticated)
		{
			const states = await this.getWithReAuth(`/setup/devices/${encodeURIComponent(deviceUrl)}/states`);
			if (this.isEmpty(states))
			{
				return null;
			}
			return states;
		}
		throw (new Error('Not Logged in'));
	}

	async getDeviceSingleState(deviceUrl, state)
	{
		if (this.authenticated)
		{
			return this.getWithReAuth(`/setup/devices/${encodeURIComponent(deviceUrl)}/states/${encodeURIComponent(state)}`);
		}
		throw (new Error('Not Logged in'));
	}

	async getActionGroups()
	{
		if (this.authenticated)
		{
			return this.getWithReAuth('/actionGroups');
		}
		throw (new Error('Not Logged in'));
	}

	/**
	 * Gets the device state history from TaHoma
	 * @param {string} deviceUrl - The device url for the device as defined in TaHoma
	 * @param {string} state - The device state for which to retrieve the history
	 * @param {timestamp} from - The timestamp from which to retrieve the history
	 * @param {timestamp} to - The timestamp until to retrieve the history
	 * @async
	 */
	async getDeviceStateHistory(deviceUrl, state, from, to)
	{
		if (this.authenticated)
		{
			return this.getWithReAuth(`/setup/devices/${encodeURIComponent(deviceUrl)}/states/${encodeURIComponent(state)}/history/${from}/${to}`);
		}
		throw (new Error('Not Logged in'));
	}

	/**
	 * Executes an action on a give device in TaHoma
	 * @param {string} name - Name of the device
	 * @param {string} deviceUrl - Url of the device
	 * @param {Object} action - An object defining the action to be executed in TaHoma
	 * @example
	 * const action = {
	 *  name: 'open',
	 *  parameters: []
	 * };
	 *
	 */
	async executeDeviceAction(name, deviceUrl, action, action2)
	{
		if (this.authenticated)
		{
			if (deviceUrl)
			{
				// Make sure events are registered so we get feedback from the execution process
				try
				{
					await this.registerEvents();
				}
				catch (err)
				{
					this.error(err);
				}

				const data = {
					label: `${name} - ${action.name}  - Homey`,
					actions: [
					{
						deviceURL: deviceUrl,
						commands: [
							action,
						],
					}],
				};

				if (action2)
				{
					data.actions[0].commands.push(action2);
				}

				const options = {
					json: true,
				};
				return this.postWithReAuth('/exec/apply', options, data);
			}
			this.appLogInformation(name,
			{
				message: 'No Device URL',
				stack: action,
			});

			throw (new Error('No device URL'));
		}
		throw (new Error(`${this.localLogin ? 'Local' : 'Cloud'} Not Logged in`));
	}

	/**
	 * Executes a TaHoma scenario
	 * @param {string} scenarioId - The id of the scenario (oid in TaHoma)
	 * @returns {Promise<Object>}
	 * @async
	 */
	async executeScenario(scenarioId)
	{
		if (this.authenticated)
		{
			// Make sure events are registered so we get feedback from the execution process
			await this.registerEvents();
			return this.postWithReAuth(`/exec/${scenarioId}`);
		}
		throw (new Error(`${this.localLogin ? 'Local' : 'Cloud'} Not Logged in`));
	}

	/**
	 * Cancels the execution of a previously defined action
	 * @param {string} executionId - The execution id of the action
	 * @returns {Promise<Object>}
	 * @async
	 */
	async cancelExecution(executionId)
	{
		if (executionId && this.authenticated)
		{
			return this.deleteWithReAuth(`/exec/current/setup/${executionId}`);
		}
		throw (new Error(`${this.localLogin ? 'Local' : 'Cloud'} Not Logged in`));
	}

	// Returns true if the events are registered or are being registered
	eventsRegistered()
	{
		return ((this.registerResponse && this.registerResponse.id) || this.registeringEvents);
	}

	async eventsClearRegistered()
	{
		let maxLoops = 60;
		while (this.registeringEvents && (maxLoops-- > 0))
		{
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		// See if we have events registered and are logged in
		if (this.registerResponse && this.registerResponse.id && this.authenticated)
		{
			try
			{
				await this.postWithReAuth(`/events/${this.registerResponse.id}/unregister`);
				this.homey.log(`${this.localLogin ? 'Local' : 'Cloud'} Unregister Events: Success`);
			}
			catch (err)
			{
				this.homey.error(`${this.localLogin ? 'Local' : 'Cloud'} Unregister Events: Failed`, err.message);
			}
		}

		this.registerResponse = null;
		this.registeringEvents = false;
	}

	// Returns true if the events are already registered
	// Throws an error if the registration fails
	async registerEvents()
	{
		// Check to see if the events are already being registered by another 'task'
		if (this.registeringEvents)
		{
			if (this.appInfoLoggingEnabled())
			{
				this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Register Events`, 'Waiting..');
			}

			let maxLoops = 60;
			while (this.registeringEvents && (maxLoops-- > 0))
			{
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			if (this.registeringEvents)
			{
				this.registeringEvents = false;
				this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Timeout while registering events`, 'Aborting');
			}

			if (!this.registerResponse || !this.registerResponse.id)
			{
				throw (new Error(`${this.localLogin ? 'Local' : 'Cloud'} Register events failed`));
			}

			// return false so the devices fetch the status data
			return false;
		}

		if (!this.registerResponse || !this.registerResponse.id)
		{
			// Events are not registered yet
			this.registeringEvents = true;
			if (this.appInfoLoggingEnabled())
			{
				this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Register Events`, 'Starting');
			}

			try
			{
				this.registerResponse = await this.postWithReAuth('/events/register');
				if (this.appInfoLoggingEnabled())
				{
					this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Register Events`,
					{
						message: 'Success',
						stack: this.registerResponse,
					});
				}

				this.registeringEvents = false;

				// return false so the devices fetch the status data
				return false;
			}
			catch (error)
			{
				this.registerResponse = null;
				this.httpHelper.authenticated = false;
				this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Register Events`, error);
				this.registeringEvents = false;
				throw (error);
			}
		}

		return true;
	}

	// Returns null if it fails or it's a new registration so the devices need to fetch their data,
	// or returns an array of status changes since the las call, which maybe an empty array if nothing has changed
	async getEvents()
	{
		if (this.authenticated)
		{
			// Throws an error if registration fails. Returns true if already registered
			if (await this.registerEvents())
			{
				// Get new events
				try
				{
					const events = await this.postWithReAuth(`/events/${this.registerResponse.id}/fetch`);
					if (events === undefined)
					{
						const message = this.registerResponse ? this.registerResponse.id : '';
						throw (new Error(`Undefined response for /events/${message}/fetch`));
					}

					if (this.appInfoLoggingEnabled())
					{
						if (events && (events.length > 0))
						{
							this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Fetching Events`,
							{
								message: 'Complete',
								stack: events,
							});
						}
						else
						{
							this.appLogInformation(`${this.localLogin ? 'Local' : 'Cloud'} Fetching Events`, 'Complete');
						}
					}

					const oAuthTimeLeft = this.getOAuthTimeLeft();
					if ((oAuthTimeLeft >= 0) && (oAuthTimeLeft < 180))
					{
						this.homey.log('OAuth time remaining = ', oAuthTimeLeft);
						this.httpHelper.authenticated = false;
						this.refreshOAuth().catch((error) =>
						{
							this.homey.error('Tahoma Refresh OAuth failed', error);
						});
					}

					return events;
				}
				catch (error)
				{
					this.registerResponse = null;
					if (error.response && error.response.status === 400)
					{
						// Bad request so register the events again
						await this.registerEvents();
					}
					else
					{
						throw (error);
					}
				}
			}

			return null;
		}
		throw (new Error(`${this.localLogin ? 'Local' : 'Cloud'} Not Logged in`));
	}

	async refreshStates()
	{
		await this.postWithReAuth('/setup/devices/states/refresh');
	}

	async getUserId()
	{
		// Don't try reauth
		return this.httpHelper.get('/currentUserId', this.httpsAgent ? { httpsAgent: this.httpsAgent } : {});
	}

	updateBaseURL(linkurl)
	{
		this.httpHelper.setBaseURL(linkurl);
	}

	isEmpty(obj)
	{
		// eslint-disable-next-line no-restricted-syntax
		for (const key in obj)
		{
			if (Object.prototype.hasOwnProperty.call(obj, key))
			{
				return false;
			}
		}
		return true;
	}

};
