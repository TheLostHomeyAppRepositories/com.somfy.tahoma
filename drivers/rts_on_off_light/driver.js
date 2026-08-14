/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the rts:LightRTSComponent
 * @extends {Driver}
 */
class OnOffLightRTSControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['rts:LightRTSComponent'];
		await super.onInit();
	}

}

module.exports = OnOffLightRTSControllerDriver;
