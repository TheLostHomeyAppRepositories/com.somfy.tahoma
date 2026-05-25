/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the remote controller with the "io:IORemoteController" controllable name in TaHoma
 * @extends {Driver}
 */
// eslint-disable-next-line camelcase
class io_open_close_remoteDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:IORemoteController', 'io:DynamicRemoteController'];
		await super.onInit();

		this._remoteStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('remote_state_changed');

		this._remoteStateChangedTriggerTo = this.homey.flow.getDeviceTriggerCard('remote_state_changed_to')
			.registerRunListener((args, state) =>
			{
				// If true, this flow should run
				return Promise.resolve(args.expected_state === state.expected_state);
			});
	}

	triggerRemoteStateChange(device, tokens, state)
	{
		this.triggerFlow(this._remoteStateChangedTrigger, device, tokens, state);
		return this;
	}

	triggerRemoteStateChangeTo(device, tokens, state)
	{
		this.triggerFlow(this._remoteStateChangedTriggerTo, device, tokens, state);
		return this;
	}

}

// eslint-disable-next-line camelcase
module.exports = io_open_close_remoteDriver;
