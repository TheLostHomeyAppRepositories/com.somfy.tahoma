/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:AlarmIOComponent controllable name in TaHoma
 * @extends {Driver}
 */
class OneAlarmDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:AlarmIOComponent'];
    }

}

module.exports = OneAlarmDriver;
