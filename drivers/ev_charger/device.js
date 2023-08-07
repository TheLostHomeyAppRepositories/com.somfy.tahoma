/* jslint node: true */

'use strict';

const LightControllerDevice = require('../LightControllerDevice');

/**
 * Device class for the light controller with the eliot:ElectricVehicleChargerComponent controllable name in TaHoma
 * @extends {LightControllerDevice}
 */

class evChargerDevice extends LightControllerDevice
{

    async onInit()
    {
        this.registerCapabilityListener('on_with_timer', this.sendOnWithTimer.bind(this));

        await super.onInit();
    }

}

module.exports = evChargerDevice;
