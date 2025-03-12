/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:DimmableRGBLightIOComponent controllable name in TaHoma
 * @extends {Driver}
 */
class ColorLightControllerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['io:DimmableRGBLightIOComponent'];
		await super.onInit();
	}

}

module.exports = ColorLightControllerDriver;
