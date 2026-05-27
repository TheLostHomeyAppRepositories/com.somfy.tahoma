/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'measure_co2',
		somfyNameGet: 'core:CO2ConcentrationState',
		somfyNameSet: [],
	},
];

class CO2SensorDevice extends SensorDevice
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

module.exports = CO2SensorDevice;
