/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:SomfyContactIOSystemSensor, rtds:RTDSContactSensor and io:SomfyBasicContactIOSystemSensor controllable name in TaHoma
 * @extends {Driver}
 */
class OpeningDetectorDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:SomfyContactIOSystemSensor', 'rtds:RTDSContactSensor', 'io:SomfyBasicContactIOSystemSensor'];
    }

}

module.exports = OpeningDetectorDriver;
