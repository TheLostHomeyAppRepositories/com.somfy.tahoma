/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
{
	homeyName: 'alarm_rain',
	somfyNameGet: 'core:RainState',
	somfyNameSet: ['notDetected', 'detected'],
	compare: ['notDetected', 'detected'],
	parameters: '',
}];

class LightSensorDevice extends SensorDevice
{

	async onInit()
	{
		await super.onInit(CapabilitiesXRef);
	}

	onAdded()
	{
		this.log('device added');
		this.getStates();
	}

	// Update the capabilities
	async syncEvents(events, local)
	{
		await this.syncEventsList(events, CapabilitiesXRef, local);
	}

}
module.exports = LightSensorDevice;
