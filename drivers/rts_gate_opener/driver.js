/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the remote controller with the "rts:GateOpenerRTSComponent" controllable name in TaHoma
 * @extends {Driver}
 */
class rtsGateOpenerDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['rts:GateOpenerRTSComponent', 'rts:GarageDoorRTSComponent', 'ogp:GarageDoor', 'ogp:Gate'];
        await super.onInit();
    }

}

module.exports = rtsGateOpenerDriver;
