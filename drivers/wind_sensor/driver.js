/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class WindSensorDriver extends Driver
{
	async onInit()
	{
		this.deviceType = ['netatmo:WindComponent'];
	}
}

module.exports = WindSensorDriver;
