/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:SomfyOccupancyIOSystemSensor and rtds:RTDSMotionSensor controllable name in TaHoma
 * @extends {Driver}
 */
class MotionDetectorDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:SomfyOccupancyIOSystemSensor', 'rtds:RTDSMotionSensor', 'zwave:ZWaveNotificationMotionSensor'];
    }

}

module.exports = MotionDetectorDriver;
