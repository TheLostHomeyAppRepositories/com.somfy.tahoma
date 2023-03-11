/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

/**
 * Device class for the opening detector with the zigbee:DanfossHeatingFloorComponent controllable name in TaHoma
 * @extends {SensorDevice}
 */

const CapabilitiesXRef = [
    {
        somfyNameGet: 'core:UpperClosureState',
        somfyNameSet: ['setUpperClosure'],
        homeyName: 'windowcoverings_set.upper',
        invert: true,
        scale: 100,
    },
    {
        somfyNameGet: 'core:LowerClosureState',
        somfyNameSet: ['setLowerClosure'],
        homeyName: 'windowcoverings_set.lower',
        invert: true,
        scale: 100,
    },
    {
        somfyNameGet: '',
        somfyNameSet: ['open'],
        homeyName: 'open_button',
        ignoreValue: true,
    },
    {
        somfyNameGet: '',
        somfyNameSet: ['close'],
        homeyName: 'close_button',
        ignoreValue: true,
    },
];

class DualBlindsDevice extends SensorDevice
{

    async onInit()
    {
        await super.onInit(CapabilitiesXRef);
        this.boostSync = true;
    }

    // Update the capabilities
    async syncEvents(events, local)
    {
        this.syncEventsList(events, CapabilitiesXRef, local);
    }

}

module.exports = DualBlindsDevice;
