/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the light sensor with the io:LightIOSystemSensor controllable name in TaHoma
 * @extends {Driver}
 */
class LightSensorDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:LightIOSystemSensor', 'zwave:ZWaveLightSensor'];
    }

}

module.exports = LightSensorDriver;
