/* jslint node: true */

'use strict';

const
{
	SimpleClass,
} = require('homey');

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

axiosCookieJarSupport(axios);

module.exports = class HttpHelper extends SimpleClass
{

	constructor()
	{
		super();

		this.cookieJar = new tough.CookieJar();
		this.axios = axios.create();

		this.axios.defaults.jar = this.cookieJar;
		this.axios.defaults.withCredentials = true;
		this.axios.defaults.maxRedirects = 0;

		this.setBaseURL('europe');
		return this;
	}

	setDefaultHeaders(headers, withCredentials)
	{
		this.axios.defaults.withCredentials = withCredentials;
		this.axios.defaults.headers = headers;
		if (!withCredentials)
		{
			this.cookieJar.removeAllCookies();
		}
	}

	setBaseURL(region, pin, port)
	{
		this.axios.defaults.baseURL = this.getBaseURL(region, pin, port);
		this.axios.defaults.timeout = 10000;
	}

	isTransientNetworkError(error)
	{
		if (!error)
		{
			return false;
		}

		const message = ((error.message || '') + '').toLowerCase();
		const code = ((error.code || '') + '').toUpperCase();

		if (message.indexOf('missing expected cr after response line') >= 0)
		{
			return true;
		}

		return (
			code === 'ECONNRESET'
			|| code === 'EPIPE'
			|| code === 'ETIMEDOUT'
			|| code === 'ECONNABORTED'
			|| message.indexOf('socket hang up') >= 0
		);
	}

	async delay(ms)
	{
		await new Promise((resolve) => setTimeout(resolve, ms));
	}

	async requestWithRetry(requestFn, retries = 2)
	{
		let attemptsLeft = retries;
		let lastError = null;

		while (attemptsLeft-- > 0)
		{
			try
			{
				const response = await requestFn();
				return response.data;
			}
			catch (error)
			{
				lastError = error;
				if (!this.isTransientNetworkError(error) || attemptsLeft <= 0)
				{
					throw (error);
				}

				await this.delay(250);
			}
		}

		throw (lastError);
	}

	// Convert the host option into the host name
	getBaseURL(region, pin, port)
	{
		if (region === 'local')
		{
			// Base URL for local access
			return `https://gateway-${pin}.local:${port}/enduser-mobile-web/1/enduserAPI`;
		}

		if (region === 'local2')
		{
			// Base URL for local access
			return `https://${pin}.local:${port}/enduser-mobile-web/1/enduserAPI`;
		}

		// Base URL for cloud
		if (region === 'usa')
		{
			return 'https://ha401-1.overkiz.com/enduser-mobile-web/enduserAPI';
		}

		if (region === 'oceana')
		{
			return 'https://ha201-1.overkiz.com/enduser-mobile-web/enduserAPI';
		}

		// default is Europe
		return 'https://ha101-1.overkiz.com/enduser-mobile-web/enduserAPI';
  }

	// Convert the host option into the host name
	getHostName(region, pin)
	{
		if (region === 'local')
		{
			// Base URL for local access
			return `gateway-${pin}.local`;
		}

		if (region === 'local2')
		{
			// Base URL for local access
			return `${pin}.local`;
		}

		// Base URL for cloud
		if (region === 'usa')
		{
			return 'ha401-1.overkiz.com';
		}

		if (region === 'oceana')
		{
			return 'ha201-1.overkiz.com';
		}

		return 'ha101-1.overkiz.com';
	}

	async get(uri, config)
	{
		// Throws an error if the get fails
		return this.requestWithRetry(() => this.axios.get(uri, config));
	}

	async post(uri, config, data)
	{
		// Throws an error if the post fails
		return this.requestWithRetry(() => this.axios.post(uri, data, config));
	}

	async delete(uri, config)
	{
		return this.requestWithRetry(() => this.axios.delete(uri, config));
	}

};
