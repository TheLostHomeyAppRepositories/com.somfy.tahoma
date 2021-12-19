/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the remote controller with the "io:IORemoteController" controllable name in TaHoma
 * @extends {Driver}
 */
// eslint-disable-next-line camelcase
class io_open_close_remoteDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:IORemoteController'];
        await super.onInit();
    }

}

// eslint-disable-next-line camelcase
module.exports = io_open_close_remoteDriver;
