/* jslint node: true */

'use strict';

const ioWindowCoveringsDriver = require('../ioWindowCoveringsDriver');

/**
 * Driver class for roller shutters with the io:RollerShutterGenericIOComponent or io:Re3js3W69CrGF8kKXvvmYtT4zNGqicXRjvuAnmmbvPZXnt or
 *  MicroModuleRollerShutterSomfyIOComponent or io:RollerShutterUnoIOComponent or io:ScreenReceiverUnoIOComponent controllable name in TaHoma
 * @extends {ioWindowCoveringsDriver}
 */
class RollerShutterDriver extends ioWindowCoveringsDriver
{

    async onInit()
    {
        // 'io:DynamicRollerShutterIOComponent' supports the quiet mode, so copied it to io_roller_shutter_quiet, but I have left it here for backward compatibility
        this.deviceType = [
            'io:RollerShutterGenericIOComponent',
            'io:Re3js3W69CrGF8kKXvvmYtT4zNGqicXRjvuAnmmbvPZXnt',
            'io:MicroModuleRollerShutterSomfyIOComponent',
            'io:RollerShutterUnoIOComponent',
            'io:ScreenReceiverUnoIOComponent',
            'io:RollerShutterWithBatterySomfyIOComponent',
            'io:DynamicRollerShutterIOComponent',
            'eliot:RollerShutterEliotComponent',
            'zigbee:ProfaluxRollerShutterComponent',
            'zigbee:RollerShutterGenericComponent',
        ];

        await super.onInit();
    }

}

module.exports = RollerShutterDriver;
