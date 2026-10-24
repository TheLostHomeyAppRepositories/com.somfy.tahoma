/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class SomfyThermostatDriver extends Driver
{
	async onInit()
	{
		this.deviceType = ['somfythermostat:SomfyThermostatThermostatComponent'];
	}
}

module.exports = SomfyThermostatDriver;
