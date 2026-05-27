/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class CO2SensorDriver extends Driver
{
	async onInit()
	{
		this.deviceType = ['netatmo:CO2Component'];
	}
}

module.exports = CO2SensorDriver;
