/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the myfox:SomfyProtectAlarmController controllable name in TaHoma
 * @extends {Driver}
 */
class OneAlarmDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['myfox:SomfyProtectAlarmController', 'myfox:HomeKeeperProAlarmController'];
    }

}

module.exports = OneAlarmDriver;
