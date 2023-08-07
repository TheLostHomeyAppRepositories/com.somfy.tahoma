/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

const CapabilitiesXRef = [
{
    homeyName: 'defect_state',
    somfyNameGet: 'core:SensorDefectState',
    somfyNameSet: [],
    allowNull: true,
},
{
    homeyName: 'alarm_battery',
    somfyNameGet: 'core:SensorDefectState',
    somfyNameSet: [],
    allowNull: true,
    compare: ['nodefect', 'lowbattery'],
},
{
    homeyName: 'measure_luminance',
    somfyNameGet: 'core:LuminanceState',
    somfyNameSet: [],
}];

class LightSensorDevice extends SensorDevice
{

    async onInit()
    {
        const dd = this.getData();
        let controllableName = '';
        if (dd.controllableName)
        {
            controllableName = dd.controllableName.toString().toLowerCase();
        }
        if (controllableName === 'io:sunenergyactuatorsensor')
        {
            if (this.hasCapability('alarm_battery'))
            {
                this.removeCapability('alarm_battery').catch(this.error);
            }
        }

        await super.onInit(CapabilitiesXRef);
    }

    onAdded()
    {
        this.log('device added');
        this.getStates();
    }

    // Update the capabilities
    async syncEvents(events, local)
    {
        await this.syncEventsList(events, CapabilitiesXRef, local);
    }

}
module.exports = LightSensorDevice;
