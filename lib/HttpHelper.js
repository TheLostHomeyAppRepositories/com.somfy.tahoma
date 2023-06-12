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

    // Convert the host option into the host name
    getBaseURL(region, pin, port)
    {
        if (region === 'local')
        {
            // Base URL for local access
            return `https://gateway-${pin}.local:${port}/enduser-mobile-web/1/enduserAPI`;
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
        const response = await this.axios.delete(uri, config);
        return response.data;
    }

};
