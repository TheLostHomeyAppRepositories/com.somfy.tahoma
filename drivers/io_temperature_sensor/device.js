/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'defect_state',
		somfyNameGet: 'core:SensorDefectState',
		somfyNameSet: [],
		allowNull: true,
	},
	{
		homeyName: 'alarm_battery',
		somfyNameGet: 'core:SensorDefectState',
		somfyNameSet: [],
		allowNull: true,
		compare: ['nodefect', 'lowbattery'],
	},
	{
		homeyName: 'measure_temperature',
		somfyNameGet: 'core:TemperatureState',
		somfyNameSet: [],
	},
];

const netatmoCapabilitiesXRef = [
	{
		homeyName: 'measure_temperature',
		somfyNameGet: 'core:TemperatureState',
		somfyNameSet: [],
	},
];
class TemperatureSensorDevice extends SensorDevice
{

	async onInit()
	{
		this.CapabilitiesXRef = CapabilitiesXRef;
		const dd = this.getData();
		let controllableName = '';
		if (dd.controllableName)
		{
			controllableName = dd.controllableName.toString().toLowerCase();
		}
		if ((controllableName === 'netatmo:temperaturecomponent') || (controllableName === 'io:temperaturemeasurementsensor'))
		{
			if (this.hasCapability('alarm_battery'))
			{
				this.removeCapability('alarm_battery').catch(this.error);
			}
			if (this.hasCapability('defect_state'))
			{
				this.removeCapability('defect_state').catch(this.error);
			}
			this.CapabilitiesXRef = netatmoCapabilitiesXRef;
		}

		await super.onInit(this.CapabilitiesXRef);
	}

	// Update the capabilities
	async syncEvents(events, local)
	{
		if (this.homey.app.infoLogEnabled && Array.isArray(events))
		{
			const controllableName = (this.getData().controllableName || '').toString();
			for (const event of events)
			{
				if ((event.name === 'DeviceStateChangedEvent') && this.isRelatedDeviceURL(event.deviceURL, this.getDeviceUrl()) && Array.isArray(event.deviceStates))
				{
					const stateNames = event.deviceStates.map((state) => state && state.name).filter(Boolean);
					this.homey.app.logInformation(this.getName(), {
						message: `${controllableName} state names`,
						stack: stateNames,
					});
				}
			}
		}

		this.syncEventsList(events, this.CapabilitiesXRef, local);
	}

}

module.exports = TemperatureSensorDevice;
