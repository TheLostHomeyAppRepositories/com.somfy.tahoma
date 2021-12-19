/* jslint node: true */

'use strict';

const ioWindowCoveringsDriver = require('../ioWindowCoveringsDriver');

/**
 * Driver class for exterior venetian blinds with the io:ExteriorVenetianBlindIOComponent controllable name in TaHoma
 * @extends {ioWindowCoveringsDriver}
 */
class ExteriorVenetianBlindDriver extends ioWindowCoveringsDriver
{

    async onInit()
    {
        this.deviceType = ['io:ExteriorVenetianBlindIOComponent'];

        await super.onInit();
    }

}

module.exports = ExteriorVenetianBlindDriver;
