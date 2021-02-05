'use strict';

const SensorDevice = require('../SensorDevice');
const Tahoma = require('../../lib/Tahoma');
const Homey = require('homey');

/**
 * Device class for the opening detector with the io:AtlanticDomesticHotWaterProductionV2_AEX_IOComponent controllable name in TaHoma
 * @extends {SensorDevice}
 */

/**
  List of capabilities to look for
 * CapabilitiesXRef {
        somfyNameGet: 'name of the Somfy capability to get the value',
        somfyNameSet: 'name of the Somfy capability to set the value',
        homeyName: 'name of the Homey capability',
        compare: 'text for true value or not specified if real value',
        scale: scale factor
    }
*/
const CapabilitiesXRef = [
    { somfyNameGet: '', somfyNameSet: 'cancelAbsence', homeyName: 'cancel_absence' },
    { somfyNameGet: 'core:ErrorCodeState', somfyNameSet: '', homeyName: 'error_code_state' },
    { somfyNameGet: 'core:HeatingDerogationAvailabilityState', somfyNameSet: '', homeyName: 'heating_derogation_availability_state' },
    { somfyNameGet: 'io:LastPassAPCOperatingModeState', somfyNameSet: '', homeyName: 'last_pass_apc_operating_mode_state' },
    { somfyNameGet: 'io:PassAPCProductTypeState', somfyNameSet: '', homeyName: 'pass_apc_product_type_state' },
    { somfyNameGet: 'io:ThermalSchedulingModeState', somfyNameSet: '', homeyName: 'thermal_scheduling_mode_state' },
    { somfyNameGet: 'core:AbsenceCoolingTargetTemperatureState', somfyNameSet: 'setAbsenceCoolingTargetTemperature', homeyName: 'target_temperature.absence_cooling' },
    { somfyNameGet: 'core:AbsenceHeatingTargetTemperatureState', somfyNameSet: 'setAbsenceHeatingTargetTemperature', homeyName: 'target_temperature.absence_heating' },
    { somfyNameGet: 'core:HeatingCoolingAutoSwitchState', somfyNameSet: 'setHeatingCoolingAutoSwitch', homeyName: 'heating_cooling_auto_switch', compare: ['off', 'on']},
    { somfyNameGet: 'io:PassAPCOperatingModeState', somfyNameSet: 'setPassAPCOperatingMode', homeyName: 'pass_apc_operating_mode' },
];

class AtlanticZoneControllerDevice extends SensorDevice
{
    async onInit()
    {
        this.boostSync = true;

        CapabilitiesXRef.forEach(element =>
        {
            this.registerCapabilityListener(element.homeyName, this.onCapability.bind(this, element));
        });


        await super.onInit();
    }

    /**
     * Gets the sensor data from the TaHoma cloud
     */
    async sync()
    {
        super.syncList(CapabilitiesXRef);
    }

    async getSync()
    {
        return super.sync();
    }

    // look for updates in the events array
    async syncEvents(events)
    {
        if (events === null)
        {
            return this.sync();
        }

        this.syncEventsList(CapabilitiesXRef);
    }
}

module.exports = AtlanticZoneControllerDevice;