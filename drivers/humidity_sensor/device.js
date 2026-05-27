/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'measure_humidity',
		somfyNameGet: 'core:RelativeHumidityState',
		somfyNameSet: [],
	},
];

class HumiditySensorDevice extends SensorDevice
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

module.exports = HumiditySensorDevice;
