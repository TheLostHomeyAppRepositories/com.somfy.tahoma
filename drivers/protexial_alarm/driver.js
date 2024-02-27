/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:AlarmIOComponent controllable name in TaHoma
 * @extends {Driver}
 */
class OneAlarmDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:AlarmIOComponent'];
		this._triggerStateChange = this.homey.flow.getDeviceTriggerCard('alarm_zone_state_changed');
	}

	async triggerAlarmStateChanged(device, tokens, state)
	{
		this.triggerFlow(this._triggerStateChange, device, tokens, state);
		return this;
	}

}

module.exports = OneAlarmDriver;
