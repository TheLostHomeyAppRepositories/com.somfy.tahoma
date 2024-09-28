/* jslint node: true */

'use strict';

const ioWindowCoveringsDriver = require('../ioWindowCoveringsDriver');

class IOGateDriver extends ioWindowCoveringsDriver
{

	async onInit()
	{
		this.deviceType = ['io:GateOpenerIOComponent'];

		this.pedestrian_changedTrigger = this.homey.flow.getDeviceTriggerCard('pedestrian_changed');

		await super.onInit();
	}

	triggerPedestrianChange(device, tokens, state)
	{
		this.triggerFlow(this.pedestrian_changedTrigger, device, tokens, state);
		return this;
	}

}
module.exports = IOGateDriver;
