/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'target_temperature',
		somfyNameGet: 'core:TargetTemperatureState',
		somfyNameSet: [],
	},
	{
		homeyName: 'measure_battery',
		somfyNameGet: 'core:BatteryLevelState',
		somfyNameSet: [],
	},
];

const HeatingModes = [
	'atHomeMode',
	'awayMode',
	'freezeMode',
	'geofencingMode',
	'manualMode',
	'sleepingMode',
	'suddenDropMode',
];

class SomfyThermostatDevice extends SensorDevice
{
	async onInit()
	{
		this.boostSync = true;
		this.heatingMode = null;
		await super.onInit();
		this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
	}

	async onCapabilityTargetTemperature(value, opts)
	{
		if (opts && opts.fromCloudSync)
		{
			await this.setCapabilityValue('target_temperature', value);
			return;
		}

		let heatingMode;
		({ heatingMode } = this);
		if (!HeatingModes.includes(heatingMode))
		{
			const states = await this.getStates();
			const modeState = Array.isArray(states)
				? states.find((state) => state && state.name === 'somfythermostat:HeatingModeState')
				: null;
			const { value: stateHeatingMode } = modeState || {};
			heatingMode = stateHeatingMode || null;
		}

		if (!HeatingModes.includes(heatingMode))
		{
			throw new Error('Unable to set thermostat temperature: heating mode is unavailable');
		}

		const action = {
			name: 'setModeTemperature',
			parameters: [heatingMode, value],
		};
		const deviceData = this.getData();
		const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
		this.executionCmd = action.name;
		const { execId, local } = result;
		this.executionId = { id: execId, local };
		const executionIndex = this.executionCommands.findIndex((execution) => execution.name === action.name);
		if (executionIndex < 0)
		{
			this.executionCommands.push({ id: execId, name: action.name, local });
		}
		else
		{
			await this.homey.app.unBoostSync();
		}
	}

	async syncEvents(events, local)
	{
		if (events === null)
		{
			const states = await this.getStates();
			const modeState = Array.isArray(states)
				? states.find((state) => state && state.name === 'somfythermostat:HeatingModeState')
				: null;
			const { value: stateHeatingMode } = modeState || {};
			if (HeatingModes.includes(stateHeatingMode))
			{
				this.heatingMode = stateHeatingMode;
			}
		}
		else
		{
			for (const event of events)
			{
				if (event && event.name === 'DeviceStateChangedEvent'
					&& this.isRelatedDeviceURL(event.deviceURL, this.getDeviceUrl())
					&& Array.isArray(event.deviceStates))
				{
					const modeState = event.deviceStates.find((state) => state && state.name === 'somfythermostat:HeatingModeState');
					const { value: stateHeatingMode } = modeState || {};
					if (HeatingModes.includes(stateHeatingMode))
					{
						this.heatingMode = stateHeatingMode;
					}
				}
			}
		}

		await this.syncEventsList(events, CapabilitiesXRef, local);
	}
}

module.exports = SomfyThermostatDevice;
