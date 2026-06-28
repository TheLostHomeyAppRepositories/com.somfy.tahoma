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
		this.deviceType = ['io:KeygoController', 'io:IzymoController', 'io:KeypadController'];
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
				const gatewayIdFromDeviceURL = (deviceURL) =>
				{
					if (!deviceURL)
					{
						return '';
					}

					const match = `${deviceURL}`.match(/^[^:]+:\/\/([^/]+)\//);
					return (match && match[1]) ? match[1] : '';
				};
				const filteredDevices = devices.filter((device) => this.deviceType.indexOf(device.controllableName) !== -1);
				const composedLabelCounts = {};
				filteredDevices.forEach((device) =>
				{
					const attributes = Array.isArray(device.attributes) ? device.attributes : [];
					const groupIndexAttribute = attributes.find((attribute) => attribute && attribute.name === 'core:GroupIndex' && attribute.value);
					const readableIndex = groupIndexAttribute ? `: ${groupIndexAttribute.value}` : '';
					const composedLabel = `${device.label}${readableIndex}`;
					composedLabelCounts[composedLabel] = (composedLabelCounts[composedLabel] || 0) + 1;
				});

				const homeyDevices = filteredDevices.map((device) => {
					let readableIndex = '';

					// if the Attributes array contains an attribute with the name "core:GroupIndex", set readableIndex to that value as ': value', otherwise leave it at an empty string
					const attributes = Array.isArray(device.attributes) ? device.attributes : [];
					if (attributes.length > 0)
					{
						const groupIndexAttribute = attributes.find((attribute) => attribute && attribute.name === 'core:GroupIndex' && attribute.value);
						readableIndex = groupIndexAttribute ? `: ${groupIndexAttribute.value}` : '';
					}

					const gatewayId = device.gatewayId || gatewayIdFromDeviceURL(device.deviceURL);
					const composedLabel = `${device.label}${readableIndex}`;
					const hasDuplicateLabel = !!(composedLabelCounts[composedLabel] > 1);
					const displayName = (hasDuplicateLabel && gatewayId)
						? `${composedLabel} (${gatewayId})`
						: composedLabel;

					return {
						name: displayName,
						data:
						{
							id: device.deviceURL || device.oid,
							oid: device.oid,
							deviceURL: device.deviceURL,
							gatewayId,
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
