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
		await this.syncEventsList(events, this.CapabilitiesXRef, local);
	}

}
module.exports = LightSensorDevice;
