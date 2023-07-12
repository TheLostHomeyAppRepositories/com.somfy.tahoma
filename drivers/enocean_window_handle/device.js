/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

/**
 * Device class for the opening detector with the enocean:EnOceanWindowHandle controllable name in TaHoma
 * @extends {SensorDevice}
 */
class WindowHandleDevice extends SensorDevice
{

    async onInit()
    {
        if (!this.hasCapability('tilted_state'))
        {
            this.addCapability('tilted_state');
        }
        
        if (!this.hasCapability('open_window_state'))
        {
            this.addCapability('open_window_state');
        }

        this.registerCapabilityListener('alarm_contact', this.onCapabilityAlarmContact.bind(this));
        this.registerCapabilityListener('tilted_state', this.onCapabilityTiltedState.bind(this));
        this.registerCapabilityListener('open_window_state', this.onCapabilityOpenWindowState.bind(this));

        await super.onInit();
    }

    onCapabilityAlarmContact(value)
    {
        const oldContactState = this.getState().alarm_contact;
        if (oldContactState !== value)
        {
            this.setCapabilityValue('alarm_contact', value).catch(this.error);

            const device = this;
            const tokens = {
                isOpen: value,
            };

            const state = {
                alarm_contact: value,
            };

            // trigger flows
            return this.driver.triggerContactChange(device, tokens, state);
        }

        return Promise.resolve();
    }

    onCapabilityTiltedState(value)
    {
        const oldTiltedState = this.getState().tilted_state;
        if (oldTiltedState !== value)
        {
            this.setCapabilityValue('tilted_state', value).catch(this.error);

            const device = this;
            const tokens = {
                isTilted: value,
            };

            const state = {
                tilted_state: value,
            };

            // trigger flows
            return this.driver.triggerTiltedStateChange(device, tokens, state);
        }

        return Promise.resolve();
    }

    onCapabilityOpenWindowState(value)
    {
        const oldOpenWindowState = this.getState().open_window_state;
        if (oldOpenWindowState !== value)
        {
            this.setCapabilityValue('open_window_state', value).catch(this.error);

            const device = this;
            const tokens = {
                isWindowOpen: value,
            };

            const state = {
                open_window_state: value,
            };

            // trigger flows
            return this.driver.triggerOpenWindowStateChange(device, tokens, state);
        }

        return Promise.resolve();
    }

    
    /**
     * Gets the sensor data from the TaHoma cloud
     * @param {Array} data - device data from all the devices in the TaHoma cloud
     */
    async sync()
    {
        try
        {
            let states = await super.getStates();
            if (states)
            {
                const handleState = states.find(state => (state && (state.name === 'core:ThreeWayHandleDirectionState')));
                if (handleState)
                {
                    this.homey.app.logStates(`${this.getName()}: core:ThreeWayHandleDirectionState = ${handleState.value}`);
                    this.triggerCapabilityListener('alarm_contact', handleState.value !== 'closed').catch(this.error);
                }

                const tiltedState = states.find(state => (state && (state.name === 'core:TiltedState')));
                if (tiltedState)
                {
                    this.homey.app.logStates(`${this.getName()}: core:TiltedState = ${tiltedState.value}`);
                    this.triggerCapabilityListener('tilted_state', tiltedState.value).catch(this.error);
                }

                const openState = states.find(state => (state && (state.name === 'core:OpenClosedState')));
                if (openState)
                {
                    this.homey.app.logStates(`${this.getName()}: core:OpenClosedState = ${openState.value}`);
                    this.triggerCapabilityListener('open_window_state', openState.value !== 'closed').catch(this.error);
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
                        if (deviceState.name === 'core:ThreeWayHandleDirectionState')
                        {
                            this.homey.app.logStates(`${this.getName()}: core:ThreeWayHandleDirectionState = ${deviceState.value}`);
                            const oldState = this.getState().alarm_contact;
                            const newState = (deviceState.value !== 'closed');
                            if (oldState !== newState)
                            {
                                this.triggerCapabilityListener('alarm_contact', newState).catch(this.error);
                            }
                        }

                        if (deviceState.name === 'core:TiltedState')
                        {
                            this.homey.app.logStates(`${this.getName()}: core:TiltedState = ${deviceState.value}`);
                            const oldState = this.getState().tilted_state;
                            const newState = deviceState.value;
                            if (oldState !== newState)
                            {
                                this.triggerCapabilityListener('tilted_state', newState).catch(this.error);
                            }
                        }

                        if (deviceState.name === 'core:OpenClosedState')
                        {
                            this.homey.app.logStates(`${this.getName()}: core:OpenClosedState = ${deviceState.value}`);
                            const oldState = this.getState().tilted_state;
                            const newState = (deviceState.value !== 'closed');
                            if (oldState !== newState)
                            {
                                this.triggerCapabilityListener('open_window_state', newState).catch(this.error);
                            }
                        }
                    }
                }
            }
        }
    }

}

module.exports = WindowHandleDevice;
