/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class HumiditySensorDriver extends Driver
{
	async onInit()
	{
		this.deviceType = ['netatmo:HumidityComponent'];
	}
}

module.exports = HumiditySensorDriver;