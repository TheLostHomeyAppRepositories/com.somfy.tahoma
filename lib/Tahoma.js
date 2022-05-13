/* jslint node: true */

'use strict';

/* eslint-disable no-use-before-define */
const Homey = require('homey');
const FormData = require('form-data');
const HttpHelper = require('./HttpHelper');
const https = require('https');
const fs = require('fs');

/* OAuth login information from https://github.com/yenoiwesa/homebridge-connexoon */

module.exports = class Tahoma extends Homey.SimpleClass
{

    constructor(Homey)
    {
        super();

        this.loginAttempts60s = 0;
        this.loginAttempts15m = 0;
        this.loginTimer60sID = null;
        this.loginTimer15mID = null;
        this.registerResponse = null;
        this.refreshToken = null;
        this.oAuthRefreshTimer = null;
		this.authenticated = false;
		this.localLogin = false;
		
        this.homey = Homey;
        this.httpHelper = new HttpHelper(Homey, this);
        this.username = null;
        this.password = null;
        this.devicePin = null;
        this.port = null;
        this.homeyID = null;

        return this;
    }

    // Throws an error if the post fails but will handle re-authentication
    async postWithReAuth(uri, config, data)
    {
        try
        {
            return await this.httpHelper.post(uri, config, data);
        }
        catch (error)
        {
            if (error.response && error.response.status === 401)
            {
                // Not authorised so login again
                if (this.localLogin)
                {
                    await this.getLocalAuthCode(this.username, this.password, this.devicePin, this.port, this.homeyID);
                }
                else
                {
                    await this.login(this.username, this.password, this.linkurl, this.oauthLogin, false, true);
                }

                return await this.httpHelper.post(uri, config, data);
            }
            else
            {
                throw (error);
            }
        }
    }

    // Throws an error if the get fails but will handle re-authentication
    async getWithReAuth(uri, config)
    {
        try
        {
            return await this.httpHelper.get(uri, config);
        }
        catch (error)
        {
            if (error.response && error.response.status === 401)
            {
                // Not authorised so login again
                if (this.localLogin)
                {
                    await this.getLocalAuthCode(this.username, this.password, this.devicePin, this.port, this.homeyID);
                }
                else
                {
                    await this.login(this.username, this.password, this.linkurl, this.oauthLogin, false, true);
                }

                return await this.httpHelper.get(uri, config);
            }
            else
            {
                throw (error);
            }
        }
    }

    // Throws an error if the delete fails but will handle re-authentication
    async deleteWithReAuth(uri, config)
    {
        try
        {
            return await this.httpHelper.delete(uri, config);
        }
        catch (error)
        {
            if (error.response && error.response.status === 401)
            {
                // Not authorised so login again
                if (this.localLogin)
                {
                    await this.getLocalAuthCode(this.username, this.password, this.devicePin, this.port, this.homeyID);
                }
                else
                {
                    await this.login(this.username, this.password, this.linkurl, this.oauthLogin, false, true);
                }

                return await this.httpHelper.delete(uri, config);
            }
            else
            {
                throw (error);
            }
        }
    }

    async getLocalAuthCode(username, password, devicePin, port, homeyID)
    {
        try
        {
			// Make sure we are logged out
			await this.logout();

			// Login to the web auth server so we can generate a new token
			await this.login(username, password, 'local_auth', false);

			const localTokenList = await this.httpHelper.get(`/config/${devicePin}/local/tokens/devmode`, {}, false);
            const label = `Homey token ${homeyID}`;
            localTokenList.forEach(token => {
                if (token.label === label)
                {
                    this.httpHelper.delete(`/config/${devicePin}/local/tokens/${token.uuid}`, {}, false);
                }
            });

			// Generate a new local token
			const newToken = await this.httpHelper.get(`/config/${devicePin}/local/tokens/generate`, {}, false);

			// Activate the local token
			const data = {
				'label' : `Homey token ${homeyID}`,
				'token' : newToken.token,
				'scope' : 'devmode'
			};

			const options = {
				json: true,
			};

			const active = await this.httpHelper.post(`/config/${devicePin}/local/tokens`, options, data);
			console.log(active);

			this.username = username;
            this.password = password;
            this.devicePin = devicePin;
			this.port = port;
			this.homeyID = homeyID;
			let bearer = newToken.token;

            // switch to local URL
            try
            {
				// Load in the Tahoma box security certificate
                https.globalAgent.options.ca = fs.readFileSync('/assets/overkiz-root-ca-2048.crt'); // Note: this is a global setting
            }
            catch (err)
            {
                console.log(err);
            }

            this.httpHelper.setBaseURL('local', devicePin, port);

            // Setup the token header and stop using token cookie
            const headers = {
                'content-type': 'application/json',
                Authorization: `Bearer ${bearer}`,
                'User-Agent': 'homey',
            };

            this.httpHelper.setDefaultHeaders(headers, false);
            this.localLogin = true;
			this.authenticated = true;
            
            return bearer;
        }
        catch (err)
        {
            this.homey.app.logInformation('Tahoma Login',
            {
                message: 'Local Token',
                stack: err.message,
            });
        }

        return null;
    }

    async getLocalTokens(devicePin)
    {
        if (!this.authenticated)
		{
			throw(new Error('Not logged in yet'));
		}
		
		if (this.localLogin)
        {
			throw(new Error('Not availbale for local login'));
        }

        return await this.httpHelper.get(`/config/${devicePin}/local/tokens/devmode`, {}, false);
    }

    async deleteLocalToken(devicePin, uuid)
    {
        if (!this.authenticated)
		{
			throw(new Error('Not logged in yet'));
		}
		
		if (this.localLogin)
        {
			throw(new Error('Not availbale for local login'));
        }

        return await this.deleteWithReAuth(`/config/${devicePin}/local/tokens/${uuid}`, {}, false);
    }

    // Throws an error if the login fails
    async login(username, password, linkurl, oauthLogin, ignoreBlock = false, fromReAuthenticate = false)
    {
        if (!fromReAuthenticate && this.authenticated)
        {
            // Already authenticated. Logout first to do a new login
            return;
        }

        if (this.oAuthRefreshTimer)
        {
            this.homey.clearTimeout(this.oAuthRefreshTimer);
        }

        // IgnoreBlock should only be set for a GUI login
        if (!ignoreBlock)
        {
            // Keep track of the number of login attempts
            this.loginAttempts60s++;
            this.loginAttempts15m++;

            // Check if the timer is running
            if (this.loginTimer60sID === null)
            {
                // Start the timer
                this.loginTimer60sID = this.homey.setTimeout(() =>
                {
                    // Reset the login attempts to allow 2 more in the next time period
                    this.loginAttempts60s = 0;

                    this.loginTimer60sID = null;
                }, 60000);
            }

            if (this.loginTimer15mID === null)
            {
                // Start the timer
                this.loginTimer15mID = this.homey.setTimeout(() =>
                {
                    // Reset the login attempts to allow 2 more in the next time period
                    this.loginAttempts15m = 0;

                    this.loginTimer15mID = null;
                }, 900000);
            }

            // Allow up to 2 login attempts in 20 seconds or 6 in 5 minutes
            if ((this.loginAttempts60s > 2) || (this.loginAttempts15m > 6))
            {
                throw (this.loginAttempts15m > 6 ? new Error('Far Too many login attempts (blocked for 15 minutes)') : new Error('Too many login attempts (blocked for 60 seconds)'));
            }
        }

        try
        {
            if (https.globalAgent.options.ca)
            {
                https.globalAgent.options.ca = null;
            }

            this.httpHelper.setBaseURL(linkurl);
            this.registerResponse = null;
            this.registeringEvents = false;

            // Check the type of login required
            if (!oauthLogin)
            {
                if (this.homey.app.infoLogEnabled)
                {
                    // Use simple login
                    this.homey.app.logInformation('Tahoma Login',
                    {
                        message: 'Start Simple Login',
                        stack: { attempts: this.loginAttempts60s, linkURL: linkurl },
                    });
                }

                // Clear the headers and use token cookie
                this.httpHelper.setDefaultHeaders({}, true);

                const form = new FormData();
                form.append('userId', username);
                form.append('userPassword', password);

                const headers = form.getHeaders();

                const result = await this.httpHelper.post('/login', { headers }, form);
                this.authenticated = true;

                if (this.homey.app.infoLogEnabled)
                {
                    this.homey.app.logInformation('Tahoma Simple Login',
                    {
                        message: 'Successful',
                        stack: result,
                    });
                }
            }
            else
            {
                // Use OAuth login
                if (this.homey.app.infoLogEnabled)
                {
                    this.homey.app.logInformation('Tahoma Login',
                    {
                        message: 'Start OAuth Login',
                        stack: { attempts: this.loginAttempts, blocked: this.loginsBlocked, linkURL: linkurl },
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

                if (this.homey.app.infoLogEnabled)
                {
                    this.homey.app.logInformation('Tahoma OAuth Login',
                    {
                        message: `Successful as ${this.homey.app.varToString(userId)}`,
                        stack: result,
                    });
                }

                this.authenticated = true;
                this.refreshToken = result.refresh_token;
                this.oAuthTimeEnd = Date.now() + ((result.expires_in - 1) * 1000);
            }
        }
        catch (error)
        {
            throw (error);
        }
    }

    async refreshOAuth()
    {
        if (this.oAuthRefreshTimer)
        {
            this.homey.clearTimeout(this.oAuthRefreshTimer);
        }

        if (this.refreshToken)
        {
            // Use OAuth login
            if (this.homey.app.infoLogEnabled)
            {
                this.homey.app.logInformation('Tahoma Refresh OAuth',
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

                if (this.homey.app.infoLogEnabled)
                {
                    this.homey.app.logInformation('Tahoma Refresh OAuth',
                    {
                        message: `Successful as ${this.homey.app.varToString(userId)}`,
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
                this.error(err);
                this.log(err);
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
        if (this.oAuthRefreshTimer)
        {
            this.homey.clearTimeout(this.oAuthRefreshTimer);
            this.refreshToken = null;
        }

        try
        {
            if (!this.localLogin && this.authenticated)
            {
                await this.httpHelper.post('/logout');
            }
        }
        catch (error)
        {
            this.log('Logout: ', error);
        }

        this.eventsClearRegistered();

        // Clear the headers and don't use credentials
        this.httpHelper.setDefaultHeaders({}, false);
        this.authenticated = false;
    }

    async getLocalAPIVersion()
    {
        const apiVersion = await this.httpHelper.get('apiVersion', {}, false);
        this.homey.app.logInformation('Tahoma Login',
        {
            message: 'Local API Version',
            stack: apiVersion,
        });

        return apiVersion;
    }

    async getSetupOID()
    {
        if (this.authenticated) 
        {
            return this.httpHelper.get('/enduser/defaultSetupOID');
        }
        throw (new Error('Not Logged in'));
    }

    async getDeviceData()
    {
        if (this.authenticated)
        {
            if (this.homey.settings.get('debugMode'))
            {
                const simData = this.homey.settings.get('simData');
                if (simData)
                {
                    return simData;
                }
            }
            return this.getWithReAuth('/setup/devices');
        }
        throw (new Error('Not Logged in'));
    }

    async getDeviceStates(deviceUrl)
    {
        if (this.authenticated)
        {
            if (this.localLogin)
            {
                const states = await this.getWithReAuth(`/setup/devices/${encodeURIComponent(deviceUrl)}`);
                if (this.isEmpty(states))
                {
                    return null;
                }
                return states.states;
            }
            else
            {
                const states = await this.getWithReAuth(`/setup/devices/${encodeURIComponent(deviceUrl)}/states`);
                if (this.isEmpty(states))
                {
                    return null;
                }
                return states;
            }
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
     *    name: 'open',
     *    parameters: []
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
            this.homey.app.logInformation(name,
            {
                message: 'No Device URL',
                stack: action,
            });

            throw (new Error('No device URL'));
        }
        throw (new Error('Not Logged in'));
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
        throw (new Error('Not Logged in'));
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
            return this.httpHelper.delete(`/exec/current/setup/${executionId}`);
        }
        throw (new Error('Not Logged in'));
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
            await this.homey.app.asyncDelay(500);
        }

        // See if we have events registered and are logged in
        if (this.registerResponse && this.registerResponse.id && this.authenticated)
        {
            try
            {
                await this.postWithReAuth(`/events/${this.registerResponse.id}/unregister`);
                if (this.homey.app.infoLogEnabled)
                {
                    this.homey.app.logInformation('Unregister Events',
                    {
                        message: 'Success',
                        stack: this.registerResponse,
                    });
                }
            }
            catch (err)
            {
                this.homey.app.logInformation('Unregister Events',
                {
                    message: 'Failed',
                    stack: err.message,
                });
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
            if (this.homey.app.infoLogEnabled)
            {
                this.homey.app.logInformation('Register Events', 'Waiting..');
            }

            let maxLoops = 60;
            while (this.registeringEvents && (maxLoops-- > 0))
            {
                await this.homey.app.asyncDelay(500);
            }

            if (this.registeringEvents)
            {
                this.registeringEvents = false;
                this.homey.app.logInformation('Timeout while registering events', 'Aborting');
            }

            if (!this.registerResponse || !this.registerResponse.id)
            {
                throw (new Error('Register events failed'));
            }

            // return false so the devices fetch the status data
            return false;
        }
		
        if (!this.registerResponse || !this.registerResponse.id)
        {
            // Events are not registered yet
            this.registeringEvents = true;
            if (this.homey.app.infoLogEnabled)
            {
                this.homey.app.logInformation('Register Events', 'Starting');
            }

            try
            {
                this.registerResponse = await this.postWithReAuth('/events/register');
                if (this.homey.app.infoLogEnabled)
                {
                    this.homey.app.logInformation('Register Events',
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
                this.homey.app.logInformation('Register Events', error.message);
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
                        const message = this.registerRespons ? this.registerResponse.id : '';
                        throw (new Error(`Undefined response for /events/${message}/fetch`));
                    }

                    if (this.homey.app.infoLogEnabled)
                    {
                        if (events && (events.length > 0))
                        {
                            this.homey.app.logInformation('Fetching Events',
                            {
                                message: 'Complete',
                                stack: events,
                            });
                        }
                        else
                        {
                            this.homey.app.logInformation('Fetching Events', 'Complete');
                        }
                    }

                    const oAuthTimeLeft = this.getOAuthTimeLeft();
                    if ((oAuthTimeLeft >= 0) && (oAuthTimeLeft < 180))
                    {
                        this.homey.log('OAuth time remaining = ', oAuthTimeLeft);
                        this.httpHelper.authenticated = false;
                        this.refreshOAuth();
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
        throw (new Error('Not Logged in'));
    }

    async refreshStates()
    {
        await this.postWithReAuth('/setup/devices/states/refresh');
    }

    async getUserId()
    {
        return this.getWithReAuth('/currentUserId', {}, false);
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
