/* jslint node: true */

'use strict';

const LightControllerDevice = require('../LightControllerDevice');

/**
 * Device class for the light controller with the io_dimmable_light controllable name in TaHoma
 * @extends {LightControllerDevice}
 */

class AllDevicesDevice extends LightControllerDevice
{

    async onInit()
    {
        // Device is not required as this is only a temporary driver
    }

}
module.exports = AllDevicesDevice;
