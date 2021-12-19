/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the rtds:RTDSSmokeSensor and io:SomfySmokeIOSystemSensor controllable name in TaHoma
 * @extends {Driver}
 */
class SmokeDetectorDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['rtds:RTDSSmokeSensor', 'io:SomfySmokeIOSystemSensor'];
    }

}

module.exports = SmokeDetectorDriver;
