/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'heating_level_state',
		somfyNameGet: 'io:TargetHeatingLevelState',
		somfyNameSet: ['setHeatingLevel'],
	},
	{
		homeyName: 'onoff',
		somfyNameGet: 'core:OnOffState',
		somfyNameSet: ['off', ''],
		compare: ['off', 'on'],
		parameters: '',
	},
];
class ElectricHeaterDevice extends SensorDevice
{

	async onInit()
	{
		await super.onInit(CapabilitiesXRef);
		this.boostSync = true;
	}

	// Update the capabilities
	async syncEvents(events, local)
	{
		this.syncEventsList(events, CapabilitiesXRef, local);
	}

}

module.exports = ElectricHeaterDevice;
