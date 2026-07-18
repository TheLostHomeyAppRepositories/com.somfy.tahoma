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
		homeyName: 'measure_luminance',
		somfyNameGet: 'core:LuminanceState',
		somfyNameSet: [],
	}];

const CapabilitiesXRefNoBat = [
	{
		homeyName: 'defect_state',
		somfyNameGet: 'core:SensorDefectState',
		somfyNameSet: [],
		allowNull: true,
	},
	{
		homeyName: 'measure_luminance',
		somfyNameGet: 'core:LuminanceState',
		somfyNameSet: [],
	}];

const CapabilitiesXRefOnlyLum = [
	{
		homeyName: 'measure_luminance',
		somfyNameGet: 'core:LuminanceState',
		somfyNameSet: [],
	}];

class LightSensorDevice extends SensorDevice
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
		if (controllableName === 'io:sunenergyactuatorsensor')
		{
			if (this.hasCapability('alarm_battery'))
			{
				this.removeCapability('alarm_battery').catch(this.error);
			}

			this.CapabilitiesXRef = CapabilitiesXRefNoBat;
		}
		else if (controllableName === 'io:lightsensor')
		{
			if (this.hasCapability('alarm_battery'))
			{
				this.removeCapability('alarm_battery').catch(this.error);
			}

			if (this.hasCapability('defect_state'))
			{
				this.removeCapability('defect_state').catch(this.error);
			}
			this.CapabilitiesXRef = CapabilitiesXRefOnlyLum;
		}

		await super.onInit(this.CapabilitiesXRef);
	}

	onAdded()
	{
		this.log('device added');
		this.getStates();
	}

	// Update the capabilities
	async syncEvents(events, local)
	{
		if (this.homey.app.infoLogEnabled && Array.isArray(events) && this.getData().controllableName === 'io:SunEnergyActuatorSensor')
		{
			for (const event of events)
			{
				if ((event.name === 'DeviceStateChangedEvent') && this.isRelatedDeviceURL(event.deviceURL, this.getDeviceUrl()) && Array.isArray(event.deviceStates))
				{
					const stateNames = event.deviceStates.map((state) => state && state.name).filter(Boolean);
					this.homey.app.logInformation(this.getName(), {
						message: 'SunEnergyActuatorSensor state names',
						stack: stateNames,
					});
				}
			}
		}

		await this.syncEventsList(events, this.CapabilitiesXRef, local);
	}

}
module.exports = LightSensorDevice;
