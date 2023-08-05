/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

/**
 * Device class for the opening detector with the ovp:SomfyPilotWireHeatingInterfaceOVPComponent controllable name in TaHoma
 * @extends {SensorDevice}
 */

class PilotWireProgrammerDevice extends SensorDevice
{

    async onInit()
    {
        this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
        this.registerCapabilityListener('heating_mode', this.onCapabilityHeatingModeState.bind(this));

        await super.onInit();
        this.boostSync = true;
    }

    async onCapabilityOnOff(value, opts)
    {
        if (!opts || !opts.fromCloudSync)
        {
            const deviceData = this.getData();
            if (this.executionId !== null)
            {
                // Wait for previous command to complete
                let retries = 20;
                while ((this.executionId !== null) && (retries-- > 0))
                {
                    await this.homey.app.asyncDelay(500);
                }
            }

            let action;
            if (value === false)
            {
                action = {
                    name: 'setOnOff',
                    parameters: ['off'],
                };
            }
            else
            {
                action = {
                    name: 'setOnOff',
                    parameters: ['on'],
                };
            }
            const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
            this.executionCmd = action.name;
            this.executionId = { id: result.execId, local: result.local };
        }
        else
        {
            this.setCapabilityValue('onoff', (value === 'on')).catch(this.error);
        }
    }

    async onCapabilityHeatingModeState(value, opts)
    {
        const deviceData = this.getData();
        if (!opts || !opts.fromCloudSync)
        {
            let action;
            if (value === 'auto')
            {
                action = {
                    name: 'setActiveMode',
                    parameters: ['auto'],
                };
            }
            else if (value === 'comfort')
            {
                action = {
                    name: 'setSetPointMode',
                    parameters: ['comfort'],
                };
            }
            else if (value === 'eco')
            {
                action = {
                    name: 'setSetPointMode',
                    parameters: ['eco'],
                };
            }
            else if (value === 'free')
            {
                action = {
                    name: 'setSetPointMode',
                    parameters: ['free'],
                };
            }
            else if (value === 'secured')
            {
                action = {
                    name: 'setSetPointMode',
                    parameters: ['secured'],
                };
            }

            // Send the command. Throws an error if it fails
            let result = null;
            result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
            this.executionCmd = action.name;
            this.executionId = { id: result.execId, local: result.local };
        }
        else
        {
            this.setCapabilityValue('heating_mode', value).catch(this.error);
        }
    }

    /**
     * Gets the sensor data from the TaHoma cloud
     */
    async sync()
    {
        try
        {
            let states = await super.getStates();
            if (states)
            {
                const onOffState = states.find((state) => (state && (state.name === 'core:OnOffState')));
                if (onOffState)
                {
                    this.homey.app.logStates(`${this.getName()}: core:OnOffState = ${onOffState.value}`);
                    this.triggerCapabilityListener('onoff', (onOffState.value === 'on'),
                    {
                        fromCloudSync: true,
                    }).catch(this.error);
                }

                const heatingMode = states.find((state) => (state && (state.name === 'ovp:HeatingTemperatureInterfaceActiveModeState')));
                if (heatingMode)
                {
                    this.homey.app.logStates(`${this.getName()}: ovp:HeatingTemperatureInterfaceActiveModeState = ${heatingMode.value}`);
                    this.triggerCapabilityListener('heating_mode', heatingMode.value,
                    {
                        fromCloudSync: true,
                    }).catch(this.error);
                }

                states = null;
            }
        }
        catch (error)
        {
            this.homey.app.logInformation(this.getName(),
            {
                message: error.message,
                stack: error.stack,
            });
        }
    }

    // look for updates in the events array
    async syncEvents(events, local)
    {
        if (events === null)
        {
            this.sync();
            return;
        }

        const myURL = this.getDeviceUrl();
        if (!local && this.homey.app.isLocalDevice(myURL))
        {
            // This device is handled locally so ignore cloud updates
            return;
        }

        // Process events sequentially so they are in the correct order
        for (let i = 0; i < events.length; i++)
        {
            const element = events[i];
            if (element.name === 'DeviceStateChangedEvent')
            {
                if ((element.deviceURL === myURL) && element.deviceStates)
                {
                    if (this.homey.app.infoLogEnabled)
                    {
                        this.homey.app.logInformation(this.getName(),
                        {
                            message: 'Processing device state change event',
                            stack: element,
                        });
                    }
                    // Got what we need to update the device so lets find it
                    for (let x = 0; x < element.deviceStates.length; x++)
                    {
                        const deviceState = element.deviceStates[x];
                        if (deviceState.name === 'core:OnOffState')
                        {
                            this.homey.app.logStates(`${this.getName()}: core:OnOffState = ${deviceState.value}`);
                            const oldState = this.getState().onoff;
                            const newState = (deviceState.value === 'on');
                            if (oldState !== newState)
                            {
                                this.triggerCapabilityListener('onoff', deviceState.value).catch(this.error);
                            }
                        }
                        else if (deviceState.name === 'ovp:HeatingTemperatureInterfaceActiveModeState')
                        {
                            this.homey.app.logStates(`${this.getName()}: ovp:HeatingTemperatureInterfaceActiveModeState = ${deviceState.value}`);
                            const oldState = this.getState().heating_mode;
                            const newState = deviceState.value;
                            if (oldState !== newState)
                            {
                                this.triggerCapabilityListener('heating_mode', newState,
                                {
                                    fromCloudSync: true,
                                }).catch(this.error);
                            }
                        }
                    }
                }
            }
        }
    }

}

module.exports = PilotWireProgrammerDevice;
