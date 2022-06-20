/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
    {
        homeyName: 'meter_power',
        somfyNameGet: 'core:ElectricEnergyConsumptionState',
        somfyNameSet: [],
        scale: 1000,
    },
];
class EnergySensorDevice extends SensorDevice
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
module.exports = EnergySensorDevice;
