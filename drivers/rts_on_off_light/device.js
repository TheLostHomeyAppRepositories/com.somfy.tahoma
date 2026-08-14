/* jslint node: true */

'use strict';

const LightControllerDevice = require('../LightControllerDevice');

/**
 * Device class for the light controller with the rts:LightRTSComponent
 * @extends {LightControllerDevice}
 */

class onOffLightRTSControllerDevice extends LightControllerDevice
{

	async onInit()
	{
		this.registerCapabilityListener('on_button', this.onCapabilityOn.bind(this));
		this.registerCapabilityListener('on_with_timer', this.sendOnWithTimer.bind(this));
		this.registerCapabilityListener('off_button', this.onCapabilityOff.bind(this));

		await super.onInit();
	}

}

module.exports = onOffLightRTSControllerDevice;
