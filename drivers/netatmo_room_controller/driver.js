/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class NetatmoRoomControllerDriver extends Driver
{
	async onInit()
	{
		this.deviceType = ['netatmo:NetatmoRoomController'];
	}
}

module.exports = NetatmoRoomControllerDriver;
