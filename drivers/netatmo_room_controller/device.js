/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
	{
		homeyName: 'target_temperature',
		somfyNameGet: 'core:TargetTemperatureState',
		somfyNameSet: ['setTargetTemperature'],
	},
	{
		homeyName: 'eh_operating_mode',
		somfyNameGet: 'core:OperatingModeState',
		somfyNameSet: ['setOperatingMode'],
	},
	{
		homeyName: 'netatmo_cooling_operating_mode',
		somfyNameGet: 'core:OperatingModeState',
		somfyNameSet: ['setCoolingOperatingMode'],
	},
	{
		homeyName: 'netatmo_pilot_wire_mode',
		somfyNameGet: 'netatmo:NetatmoPilotWireModeState',
		somfyNameSet: ['setPilotWireMode'],
	},
	{
		homeyName: 'open_window_state',
		somfyNameGet: 'core:OpenWindowDetectionState',
		somfyNameSet: [],
		conversions: {
			true: 'true',
			false: 'false',
		},
		compare: ['false', 'true'],
	},
];

class NetatmoRoomControllerDevice extends SensorDevice
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

module.exports = NetatmoRoomControllerDevice;
