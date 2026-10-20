/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class OnOffSocketControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:OnOffIOComponent', 'io:DynamicOutletIOComponent', 'eliot:OnOffSwitchEliotComponent', 'io:SwitchMicroModuleSomfyIOComponent', 'ogp:Outlet', 'io:OnOffLightIOComponent', 'zigbee:OnOffComponent'];
		await super.onInit();
	}

}

module.exports = OnOffSocketControllerDriver;
