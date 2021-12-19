/* jslint node: true */

'use strict';

const ioWindowCoveringsDriver = require('../ioWindowCoveringsDriver');

/**
 * Driver class for exterior venetian blinds with the io:SlidingDiscreteGateOpenerIOComponent and "io:DiscreteGateOpenerIOComponent" controllable name in TaHoma
 * @extends {ioWindowCoveringsDriver}
 */
class SlidingGateDriver extends ioWindowCoveringsDriver
{

    async onInit()
    {
        this.deviceType = ['io:SlidingDiscreteGateOpenerIOComponent', 'io:DiscreteGateOpenerIOComponent'];

        await super.onInit();
    }

}

module.exports = SlidingGateDriver;
