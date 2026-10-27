/* jslint node: true */

'use strict';

const Driver = require('../Driver');

class AudioPlayerDriver extends Driver
{

	async onInit()
	{
		this.deviceType = ['ogp:AudioPlayer'];
		await super.onInit();
	}

}

module.exports = AudioPlayerDriver;
