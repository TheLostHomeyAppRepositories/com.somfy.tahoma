/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
    {
        homeyName: 'alarm_motion',
        somfyNameGet: 'core:OccupancyState',
        somfyNameSet: [],
        compare: ['', 'personInside'],
    },
];
class OccupancyDetectorDevice extends SensorDevice
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

module.exports = OccupancyDetectorDevice;
