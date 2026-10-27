/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class RtsPergolaDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['rts:BioclimaticPergolaRTSComponent'];
		await super.onInit();
	}

}

module.exports = RtsPergolaDriver;
