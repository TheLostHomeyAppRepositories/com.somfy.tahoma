/* jslint node: true */

'use strict';

const Device = require('../Device');

/**
 * Device class for the remote controller with the "eliot:RemoteEliotComponent" controllable name in TaHoma
 * @extends {Device}
 */

// eslint-disable-next-line camelcase
class eliot_remoteDevice extends Device
{

    async onInit()
    {
        this.registerCapabilityListener('eliot_remote_state', this.onCapabilityRemoteState.bind(this));

        await super.onInit();
    }

    onCapabilityRemoteState(value)
    {
        const oldState = this.getState().remote_state;
        if (oldState !== value)
        {
            this.setCapabilityValue('eliot_remote_state', value).catch(this.error);

            const device = this;
            const tokens = {
                remote_state: value,
            };
            const state = {
                expected_state: value,
            };

            // trigger flows
            this.driver.triggerRemoteSateChange(device, tokens, state);
            this.driver.triggerRemoteSateChangeTo(device, tokens, state);
        }

        return Promise.resolve();
    }

    /**
     * Gets the data from the TaHoma cloud
     */
    async sync()
    {
        try
        {
            let states = await super.getStates();
            if (states)
            {
                const remoteState = states.find((state) => (state && (state.name === 'core:RockerSwitchPushWayState')));
                if (remoteState)
                {
                    this.homey.app.logStates(`${this.getName()}: core:RockerSwitchPushWayState = ${remoteState.value}`);
                    this.triggerCapabilityListener('eliot_remote_state', remoteState.value).catch(this.error);
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
                        if (deviceState.name === 'core:RockerSwitchPushWayState')
                        {
                            this.homey.app.logStates(`${this.getName()}: core:RockerSwitchPushWayState = ${deviceState.value}`);
                            const oldState = this.getState().remote_state;
                            const newSate = deviceState.value;
                            if (oldState !== newSate)
                            {
                                this.triggerCapabilityListener('eliot_remote_state', newSate).catch(this.error);
                            }
                        }
                    }
                }
            }
        }
    }

}

// eslint-disable-next-line camelcase
module.exports = eliot_remoteDevice;
