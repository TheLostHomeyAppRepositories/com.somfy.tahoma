/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the remote controller with the "io:KeygoController" or "io:IzymoController" controllable name in TaHoma
 * @extends {Driver}
 */
// eslint-disable-next-line camelcase
class key_go_remoteDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:KeygoController', 'io:IzymoController'];
		await super.onInit();

		this._remoteStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('key_go_remote_state_changed');

		this._remoteStateChangedTriggerTo = this.homey.flow.getDeviceTriggerCard('key_go_remote_state_changed_to')
			.registerRunListener((args, state) => {
				// If true, this flow should run
				return Promise.resolve(args.expected_state === state.expected_state);
			});
	}

	async onReceiveSetupData()
	{
		try
		{
			const devices = await this.homey.app.getDeviceData();
			if (devices)
			{
				this.log('setup resolve');
				const homeyDevices = devices.filter((device) => this.deviceType.indexOf(device.controllableName) !== -1).map((device) => {
					let readableIndex = '';

					// if the Attributes array contains an attribute with the name "core:GroupIndex", set readableIndex to that value as ': value', otherwise leave it at an empty string
					const attributes = Array.isArray(device.attributes) ? device.attributes : [];
					if (attributes.length > 0)
					{
						const groupIndexAttribute = attributes.find((attribute) => attribute && attribute.name === 'core:GroupIndex' && attribute.value);
						readableIndex = groupIndexAttribute ? `: ${groupIndexAttribute.value}` : '';
					}

					return {
						name: `${device.label}${readableIndex}`,
						data:
						{
							id: device.oid,
							deviceURL: device.deviceURL,
							label: device.label,
							controllableName: device.controllableName,
						},
					};
				});
				return homeyDevices;
			}
		}
		catch (error)
		{
			this.homey.app.logInformation('OnReceiveSetupData', error);
			throw error;
		}

		return [];
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
module.exports = key_go_remoteDriver;
