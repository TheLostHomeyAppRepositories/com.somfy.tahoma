/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the rts:OnOffRTSComponent
 * @extends {Driver}
 */
class OnOffSocketRTSControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['rts:OnOffRTSComponent'];
		await super.onInit();
	}

}

module.exports = OnOffSocketRTSControllerDriver;
