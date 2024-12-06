/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the zigbee:ThermostatAndFanComponent controllable name in TaHoma
 * @extends {Driver}
 */
class zigbeeACDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['zigbee:ThermostatAndFanComponent'];
	}

}

module.exports = zigbeeACDriver;
