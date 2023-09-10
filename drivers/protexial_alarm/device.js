/* jslint node: true */

'use strict';

const SensorDevice = require('../SensorDevice');

/**
 * Device class for the opening detector with the io:AlarmIOComponent controllable name in TaHoma
 * @extends {SensorDevice}
 */

class OneAlarmDevice extends SensorDevice
{

    async onInit()
    {
        this.registerCapabilityListener('off_button', this.onCapabilityAlarmOff.bind(this));
        this.registerCapabilityListener('on_button', this.onCapabilityAlarmOn.bind(this));
        this.registerCapabilityListener('zone_button.a', this.onCapabilityZone.bind(this, 'A'));
        this.registerCapabilityListener('zone_button.b', this.onCapabilityZone.bind(this, 'B'));
        this.registerCapabilityListener('zone_button.c', this.onCapabilityZone.bind(this, 'C'));

        await super.onInit();
        this.boostSync = true;
    }

    async onCapabilityAlarmOn(value, opts)
    {
        const deviceData = this.getData();
        if (!opts || !opts.fromCloudSync)
        {
            let action;
            if (value === true)
            {
                action = {
                    name: 'alarmOn',
                    parameters: [],
                };
            }
            const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
            this.executionCmd = action.name;
            this.executionId = { id: result.execId, local: result.local };
        }
        else
        {
            this.setCapabilityValue('on_button', value).catch(this.error);
        }
    }

    async onCapabilityAlarmOff(value, opts)
    {
        const deviceData = this.getData();
        if (!opts || !opts.fromCloudSync)
        {
            let action;
            if (value === true)
            {
                action = {
                    name: 'alarmOff',
                    parameters: [],
                };
            }
            const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
            this.executionCmd = action.name;
            this.executionId = { id: result.execId, local: result.local };
        }
        else
        {
            this.setCapabilityValue('off_button', value).catch(this.error);
        }
    }

    async onCapabilityZone(zone, value, opts)
    {
        const deviceData = this.getData();
        const capabilityZone = zone.toLowerCase();
        zone = zone.toUpperCase();
        if (!opts || !opts.fromCloudSync)
        {
            let action;
            if (value === true)
            {
                action = {
                    name: 'core:alarmZoneOn',
                    parameters: [zone],
                };
                const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
                this.executionCmd = action.name;
                this.executionId = { id: result.execId, local: result.local };
            }
            else
            {
                // The zones can only be switched on so use the Off button to turn them off
                this.setWarning('Use the Off button to switch off the zones').catch(this.error);

                // Turn the button on again on immediately
                setImmediate(() =>
                {
                    this.setCapabilityValue(`zone_button.${capabilityZone}`, true, { fromCloud: true }).catch(this.error);
                });
            }
        }
        else
        {
            this.setCapabilityValue(`zone_button.${capabilityZone}`, value).catch(this.error);
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
                const zoneState = states.find((state) => (state && (state.name === 'core:ActiveZonesState')));
                if (zoneState)
                {
                    this.homey.app.logStates(`${this.getName()}: core:ActiveZonesState = ${zoneState.value}`);

                    // Check if the zonestate contains a A
                    this.triggerCapabilityListener('zone_button.a', (zoneState.value.indexOf('A') > -1), { fromCloud: true }).catch(this.error);

                    // Check if the zonestate contains a B
                    this.triggerCapabilityListener('zone_button.b', (zoneState.value.indexOf('B') > -1), { fromCloud: true }).catch(this.error);

                    // Check if the zonestate contains a C
                    this.triggerCapabilityListener('zone_button.c', (zoneState.value.indexOf('C') > -1), { fromCloud: true }).catch(this.error);
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
                        if (deviceState.name === 'core:ActiveZonesState')
                        {
                            this.homey.app.logStates(`${this.getName()}: core:ActiveZonesState = ${deviceState.value}`);

                            this.triggerCapabilityListener('zone_button.a', (deviceState.value.indexOf('A') > -1), { fromCloudSync: true }).catch(this.error);

                            // Check if the deviceState contains a B
                            this.triggerCapabilityListener('zone_button.b', (deviceState.value.indexOf('B') > -1), { fromCloudSync: true }).catch(this.error);

                            // Check if the deviceState contains a C
                            this.triggerCapabilityListener('zone_button.c', (deviceState.value.indexOf('C') > -1), { fromCloudSync: true }).catch(this.error);
                        }
                    }
                }
            }
        }
    }

}

module.exports = OneAlarmDevice;
