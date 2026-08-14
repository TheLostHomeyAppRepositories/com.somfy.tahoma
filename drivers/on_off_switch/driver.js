/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:LightMicroModuleSomfyIOComponent and io:OnOffIOComponent controllable name in TaHoma
 * @extends {Driver}
 */
class OnOffLightControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:LightMicroModuleSomfyIOComponent', 'io:OnOffIOComponent', 'eliot:OnOffSwitchEliotComponent', 'io:SwitchMicroModuleSomfyIOComponent', 'zigbee:OnOffComponent'];
		await super.onInit();
	}

}

module.exports = OnOffLightControllerDriver;
