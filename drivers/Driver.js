/* jslint node: true */

'use strict';

const Homey = require('homey');
/**
 * Base class for drivers
 * @class
 * @extends {Homey.Driver}
 */
class Driver extends Homey.Driver
{

    async onInit()
    {
        /** * Command Complete ** */
        this._triggerCommandComplete = this.homey.flow.getDeviceTriggerCard('device_command_complete');
    }

    triggerDeviceCommandComplete(device, commandName, success)
    {
        const tokens = { state: success, name: commandName };
        this.triggerFlow(this._triggerCommandComplete, device, tokens);
        return this;
    }

    async onPair(session)
    {
        let username = this.homey.settings.get('username');
        let password = this.homey.settings.get('password');
        let region = this.homey.settings.get('region');

        session.setHandler('showView', async (view) =>
        {
            if (view === 'login_credentials')
            {
                if (username && password && this.homey.app.isLoggedIn())
                {
                    await session.nextView();
                }
            }
            else if (view === 'select_region')
            {
                if (region)
                {
                    await session.nextView();
                }
            }
        });

        session.setHandler('select_region_setup', async () =>
        {
            this.log('Select Region Setup');
            const result = { region };
            return result;
        });

        session.setHandler('select_region', async (regionObj) =>
        {
            this.log('Select Region', regionObj);
            region = regionObj.region;
            session.nextView().catch(this.error);
        });

        session.setHandler('login', async (data) =>
        {
            username = data.username;
            password = data.password;
            const credentialsAreValid = await this.homey.app.newLogin_2(username, password, region);

            // return true to continue adding the device if the login succeeded
            // return false to indicate to the user the login attempt failed
            // thrown errors will also be shown to the user
            return credentialsAreValid;
        });

        session.setHandler('list_devices', async () =>
        {
            this.log('list_devices');
            const username = this.homey.settings.get('username');
            const password = this.homey.settings.get('password');
            if (!username || !password)
            {
                throw new Error(this.homey.__('errors.on_pair_login_failure'));
            }
            return this.onReceiveSetupData();
        });
    }

    async onRepair(session, device)
    {
        let username = this.homey.settings.get('username');
        let password = this.homey.settings.get('password');
        const region = this.homey.settings.get('region');

        // session.setHandler('showView', async view =>
        // {
        //     if (view === 'login_credentials')
        //     {
        //         if (username && password && this.homey.app.isLoggedIn())
        //         {
        //             await session.nextView();
        //         }
        //     }
        // });

        session.setHandler('login', async (data) =>
        {
            username = data.username;
            password = data.password;
            const credentialsAreValid = await this.homey.app.newLogin_2(username, password, region);

            // return true to continue adding the device if the login succeeded
            // return false to indicate to the user the login attempt failed
            // thrown errors will also be shown to the user
            return credentialsAreValid;
        });
    }

    async onReceiveSetupData()
    {
        try
        {
            let devices = await this.homey.app.getDeviceData();
            if (devices.devices && devices.devices.cloud)
            {
                const cloudDevices = devices.devices.cloud;
                const localDevices = devices.devices.local;

                // Merge the arrays into one
                if (cloudDevices && localDevices)
                {
                    devices = cloudDevices.concat(localDevices);
                }
                else if (cloudDevices)
                {
                    devices = cloudDevices;
                }
                else if (localDevices)
                {
                    devices = localDevices;
                }
            }

            this.homey.app.logInformation('OnReceiveSetupData', devices);
            if (devices)
            {
                this.log('setup resolve');
                const homeyDevices = devices.filter((device) => this.deviceType.indexOf(device.controllableName) !== -1).map((device) => (
                {
                    name: device.label,
                    data:
                    {
                        id: device.oid,
                        deviceURL: device.deviceURL,
                        label: device.label,
                        controllableName: device.controllableName,
                    },
                }));
                return homeyDevices;
            }
        }
        catch (error)
        {
            this.homey.app.logInformation('OnReceiveSetupData', error);
            throw new Error(error.message);
        }

        return null;
    }

    /**
     * Triggers a flow
     * @param {this.homey.flow.getDeviceTriggerCard} trigger - A this.homey.flow.getDeviceTriggerCard instance
     * @param {Device} device - A Device instance
     * @param {Object} tokens - An object with tokens and their typed values, as defined in the app.json
     */
    triggerFlow(trigger, device, tokens, state)
    {
        if (trigger)
        {
            trigger.trigger(device, tokens, state)
                .then((result) =>
                {
                    if (result)
                    {
                        this.log(result);
                    }
                })
                .catch((error) =>
                {
                    this.homey.app.logInformation(`triggerFlow (${trigger.id})`, error);
                });
        }
    }

    /**
     * Returns the io controllable name(s) of TaHoma
     * @return {Array} deviceType
     */
    getDeviceType()
    {
        return this.deviceType ? this.deviceType : false;
    }

}
module.exports = Driver;
