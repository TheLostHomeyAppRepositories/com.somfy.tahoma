/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
    {
        homeyName: 'alarm_generic',
        somfyNameGet: 'internal:IntrusionDetectedState',
        somfyNameSet: [],
        compare: ['notDetected', 'detected'],
    },
    {
        homeyName: 'tahoma_alarm_state',
        somfyNameGet: 'internal:CurrentAlarmModeState',
        somfyNameSet: ['setTargetAlarmMode'],
        conversions: { zone1: 'partial1', zone2: 'partial2' },
        secondaryCommand: { sos: { name: 'setIntrusionDetected', parameters: ['detected'] } },
    },
];

class TahomaAlarmDevice extends SensorDevice
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

    async triggerAlarmAction(state)
    {
        const deviceData = this.getData();
        const action = {
            name: 'setIntrusionDetected',
            parameters: [state],
        };

        await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
        return true;
    }

}

module.exports = TahomaAlarmDevice;
