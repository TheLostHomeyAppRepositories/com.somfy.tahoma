/* jslint node: true */

'use strict';

const ioWindowCoveringsDriver = require('../ioWindowCoveringsDriver');

/**
 * Driver class for roller shutters with the io:RollerShutterWithLowSpeedManagementIOComponent controllable name in TaHoma
 * @extends {ioWindowCoveringsDriver}
 */
class RollerShutterQuietDriver extends ioWindowCoveringsDriver
{

    async onInit()
    {
        // Added 'io:DynamicRollerShutterIOComponent' here as it supports the quiet mode, but I have left it in io_roller_shutter for backward compatibility
        this.deviceType = [
            'io:RollerShutterWithLowSpeedManagementIOComponent',
            'io:DynamicRollerShutterIOComponent'
        ];

        await super.onInit();
    }

}

module.exports = RollerShutterQuietDriver;