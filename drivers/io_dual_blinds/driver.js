/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:DualRollerShutterIOComponent controllable name in TaHoma
 * @extends {Driver}
 */
class DualBlindDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:DualRollerShutterIOComponent'];
    }

}

module.exports = DualBlindDriver;
