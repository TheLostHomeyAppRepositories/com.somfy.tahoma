/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the rain sensor with the io:SomfyRainIOSystemSensor or netatmo:RainComponent controllable name in TaHoma
 * @extends {Driver}
 */
class RainSensorDriver extends Driver
{
	async onInit()
	{
		this.deviceType = ['io:SomfyRainIOSystemSensor', 'netatmo:RainComponent'];
	}
}

module.exports = RainSensorDriver;
