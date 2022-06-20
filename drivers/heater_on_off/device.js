/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
    {
        homeyName: 'onoff',
        somfyNameGet: 'core:OnOffState',
        somfyNameSet: ['off', 'on'],
        compare: ['off', 'on'],
        parameters: '',
    },
];
class HeaterOnOffDevice extends SensorDevice
{

    async onInit()
    {
        await super.onInit(CapabilitiesXRef);
    }

    // Update the capabilities
    async syncEvents(events, local)
    {
        this.syncEventsList(events, CapabilitiesXRef, local);
    }

}

module.exports = HeaterOnOffDevice;
