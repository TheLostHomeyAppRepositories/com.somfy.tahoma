/* jslint node: true */

'use strict';

const Device = require('../Device');

const CapabilitiesXRef = [
	{
		homeyName: 'volume_set',
		somfyNameGet: 'core:VolumeLevelState',
		somfyNameSet: ['setVolume'],
		scale: 100,
	},
	{
		homeyName: 'volume_mute',
		somfyNameGet: 'core:MuteState',
		somfyNameSet: ['unmute', 'mute'],
	},
];

class AudioPlayerDevice extends Device
{

	async onInit()
	{
		await super.onInit(CapabilitiesXRef);
		this.boostSync = true;
	}

	async syncEvents(events, local)
	{
		return this.syncEventsList(events, CapabilitiesXRef, local);
	}

}

module.exports = AudioPlayerDevice;
