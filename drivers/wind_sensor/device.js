/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'measure_wind_angle',
		somfyNameGet: 'core:WindDirectionState',
		somfyNameSet: [],
	},
	{
		homeyName: 'measure_wind_strength',
		somfyNameGet: 'core:WindSpeedState',
		somfyNameSet: [],
	},
];

class WindSensorDevice extends SensorDevice
{
	async onInit()
	{
		await super.onInit(CapabilitiesXRef);
	}

	// Update the capabilities
	async syncEvents(events, local)
	{
		await this.syncEventsList(events, CapabilitiesXRef, local);
	}
}

module.exports = WindSensorDevice;
