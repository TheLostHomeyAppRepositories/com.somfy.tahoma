/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the Somfy ergonomic remote with the zigbee:SomfyRemoteWithErgonomicsComponent controllable name in TaHoma
 * @extends {Driver}
 */
class ZigbeeRemoteErgonomicsDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['zigbee:SomfyRemoteWithErgonomicsComponent'];
		await super.onInit();

		this._ergonomicsModeChangedTrigger = this.homey.flow.getDeviceTriggerCard('ergonomics_mode_changed');

		this._ergonomicsModeChangedToTrigger = this.homey.flow.getDeviceTriggerCard('ergonomics_mode_changed_to')
			.registerRunListener((args, state) =>
			{
				// If true, this flow should run
				return Promise.resolve(args.expected_mode === state.expected_mode);
			});
	}

	triggerErgonomicsModeChange(device, tokens, state)
	{
		this.triggerFlow(this._ergonomicsModeChangedTrigger, device, tokens, state);
		return this;
	}

	triggerErgonomicsModeChangeTo(device, tokens, state)
	{
		this.triggerFlow(this._ergonomicsModeChangedToTrigger, device, tokens, state);
		return this;
	}

}

module.exports = ZigbeeRemoteErgonomicsDriver;
