'use strict';

/* jslint node: true */
const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the enocean:EnOceanWindowHandle controllable name in TaHoma
 * @extends {Driver}
 */
class WindowHandleDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['enocean:EnOceanWindowHandle'];
    }

}

module.exports = WindowHandleDriver;
