/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class simpleLightControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['zwave:OnOffLightZWaveComponent', 'zwave:OnOffZWaveComponent', 'eliot:OnOffLightEliotComponent', 'io:OnOffLightIOComponent', 'io:DynamicLight', 'ogp:Light'];
		await super.onInit();
	}

}

module.exports = simpleLightControllerDriver;
