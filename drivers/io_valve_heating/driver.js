/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the opening detector with the io:HeatingValveIOComponent controllable name in TaHoma
 * @extends {Driver}
 */
class ValveHeaterDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:HeatingValveIOComponent'];
    }

}

module.exports = ValveHeaterDriver;
