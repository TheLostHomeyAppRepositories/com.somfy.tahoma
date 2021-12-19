/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the temperature sensor with the io:TemperatureInCelciusIOSystemDeviceSensor, io:TemperatureIOSystemSensor,
 *  io:AtlanticPassAPCOutsideTemperatureSensor, io:AtlanticPassAPCZoneTemperatureSensor and ovp:SomfyPilotWireTemperatureSensorOVPComponent controllable name in TaHoma
 * @extends {Driver}
 */
class TemperatureSensorDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:TemperatureIOSystemSensor',
            'io:AtlanticPassAPCOutsideTemperatureSensor',
            'io:AtlanticPassAPCZoneTemperatureSensor',
            'ovp:SomfyPilotWireTemperatureSensorOVPComponent',
            'zwave:ZWaveTemperatureSensor',
            'io:TemperatureInCelciusIOSystemDeviceSensor',
        ];
    }

}

module.exports = TemperatureSensorDriver;
