/* jslint node: true */

'use strict';

const
{
    SimpleClass,
} = require('homey');

const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const { isNullOrUndefined } = require('util');

axiosCookieJarSupport(axios);

module.exports = class HttpHelper extends SimpleClass
{

    constructor(Homey, Tahoma)
    {
        super();

        this.cookieJar = new tough.CookieJar();
        this.axios = axios.create();
        this.axios.defaults.jar = this.cookieJar;
        this.axios.defaults.withCredentials = true;
        this.axios.defaults.maxRedirects = 0;

        this.setBaseURL('default');
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

    setBaseURL(linkUrlOption, pin, port)
    {
        this.axios.defaults.baseURL = this.getBaseURL(linkUrlOption, pin, port);
        this.axios.defaults.timeout = 10000;
    }

    // Convert the host option into the host name
    getBaseURL(linkUrlOption, pin, port)
    {
        if (linkUrlOption === 'local')
        {
            // Base URL for local access
            return `https://gateway-${pin}.local:${port}/enduser-mobile-web/1/enduserAPI`;
        }
		// Base URL for cloud
		return 'https://ha101-1.overkiz.com/enduser-mobile-web/enduserAPI';
    }

    // Convert the host option into the host name
    getHostName(linkUrlOption, pin)
    {
        if (linkUrlOption === 'local')
        {
            // Base URL for local access
            return `gateway-${pin}.local`;
        }
		
		// Base URL for cloud
		return 'ha101-1.overkiz.com';
    }

    async get(uri, config)
    {
		// Throws an error if the get fails
		const response = await this.axios.get(uri, config);
		return response.data;
    }

    async post(uri, config, data)
    {
		// Throws an error if the post fails
		const response = await this.axios.post(uri, data, config);
		return response.data;
    }

    async delete(uri, config)
    {
        return await this.axios.delete(uri, config);
    }
};
