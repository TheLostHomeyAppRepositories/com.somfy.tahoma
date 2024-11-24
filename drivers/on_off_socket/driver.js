/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class OnOffSocketControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:OnOffIOComponent', 'eliot:OnOffSwitchEliotComponent', 'io:SwitchMicroModuleSomfyIOComponent', 'ogp:Outlet'];
		await super.onInit();
	}

}

module.exports = OnOffSocketControllerDriver;
