/* jslint node: true */

'use strict';

const ioWindowCoveringsDriver = require('../ioWindowCoveringsDriver');

/**
 * Driver class for exterior venetian blinds with the io:DiscreteGarageOpenerWithPartialPositionIOComponent controllable name in TaHoma
 * @extends {ioWindowCoveringsDriver}
 */
class GarageDoorPartialIOdDriver extends ioWindowCoveringsDriver
{

	async onInit()
	{
		this.deviceType = ['io:DiscreteGarageOpenerWithPartialPositionIOComponent', 'io:DiscreteGarageOpenerIOComponent', 'ogp:GarageDoor', 'io:DynamicGarageDoor'];

		await super.onInit();
	}

}

module.exports = GarageDoorPartialIOdDriver;
