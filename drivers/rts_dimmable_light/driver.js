/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class rtsDimmableLightDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['rts:DimmableLightRTSComponent'];
		await super.onInit();
	}

}

module.exports = rtsDimmableLightDriver;
