'use strict';

const SensorDevice = require('../SensorDevice');
const Tahoma = require('../../lib/Tahoma');
const Homey = require('homey');

/**
 * Device class for the light controller with the myfox:LightController controllable name in TaHoma
 * @extends {SensorDevice}
 */

class myFoxLightControllerDevice extends SensorDevice {
    async onInit() {
        await super.onInit();
        this.lightState = {
            off: false,
            on: true
        };

        this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    }

    onCapabilityOnOff(value, opts, callback) {
        const deviceData = this.getData();
        if (!opts || !opts.fromCloudSync) {
            var action;
            if (value == false) {
                action = {
                    name: 'off',
                    parameters: []
                };
            } else {
                action = {
                    name: 'on',
                    parameters: []
                };
            }
            Tahoma.executeDeviceAction(deviceData.label, deviceData.deviceURL, action)
                .then(result => {
                    this.setStoreValue('executionId', result.execId);
                    this.setCapabilityValue('onoff', (value == true));
                    if (callback) callback(null, value);
                })
                .catch(error => {
                    Homey.app.logError(this.getName() + ": onCapabilityOnOff", error);
                });
        } else {
            this.setCapabilityValue('onoff', (value == true));
        }

        //return Promise.resolve();
    }

    /**
     * Gets the data from the TaHoma cloud
     */
    async sync() {
        try {
            const states = await super.sync();
            if (states) {
                const OnOffState = states.find(state => state.name === 'core:OnOffState');
                if (OnOffState) {
                    Homey.app.logStates(this.getName() + ": core:OnOffState = " + OnOffState.value);
                    this.triggerCapabilityListener('onoff', (OnOffState.value === 'on'), {
                        fromCloudSync: true
                    });
                }
            }
        } catch (error) {
            this.setUnavailable(null);
            Homey.app.logError(this.getName(), {
                message: error.message,
                stack: error.stack
            });
        }
    }
}

module.exports = myFoxLightControllerDevice;