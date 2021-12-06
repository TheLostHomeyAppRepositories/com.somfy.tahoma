/* jslint node: true */

'use strict';

const Driver = require('../Driver');

const IoValveHeating = require('../io_valve_heating/device');
const Siren = require('../siren/device');

const somfyMap = { 'io:HeatingValveIOComponent': 'io_valve_heating', 'io:SomfyIndoorSimpleSirenIOComponent': 'siren' };

/**
 * Driver class for the opening detector with the hue:GenericExtendedColorLightHUEComponent controllable name in TaHoma
 * @extends {Driver}
 */
class AllDevicesDriver extends Driver
{

    async onInit()
    {
        await super.onInit();

        this._derogation_mode_changed = this.homey.flow.getDeviceTriggerCard('derogation_mode_changed');
        this._valve_heating_mode_state_changed = this.homey.flow.getDeviceTriggerCard('valve_heating_mode_state_changed');
        this._defect_state_changed = this.homey.flow.getDeviceTriggerCard('defect_state_changed');
    }

    onMapDeviceClass(device)
    {
        const dd = device.getData();
        switch (somfyMap[dd.controllableName])
        {
            case 'io_valve_heating':
                return IoValveHeating;

            case 'siren':
                return Siren;

            default:
                return null;
        }
    }

    async onPair(session)
    {
        let username = this.homey.settings.get('username');
        let password = this.homey.settings.get('password');
        const linkurl = 'default';

        session.setHandler('showView', async view =>
        {
            if (view === 'login_credentials')
            {
                if (username && password && this.homey.app.loggedIn)
                {
                    await session.nextView();
                }
            }
        });

        session.setHandler('login', async data =>
        {
            username = data.username;
            password = data.password;
            const credentialsAreValid = await this.homey.app.newLogin_2(username, password, linkurl, true);

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

    async onReceiveSetupData()
    {
        try
        {
            const somfyDevices = await this.homey.app.tahoma.getDeviceData();
            if (somfyDevices)
            {
                this.log('setup resolve');

                const homeyDevices = [];

                for (const somfyDevice of somfyDevices)
                {
                    if (somfyMap[somfyDevice.controllableName])
                    {
                        const manifest = this.homey.manifest.drivers.find(entry => entry.id === somfyMap[somfyDevice.controllableName]);
                        if (manifest)
                        {
                            const homeyDevice = {
                                name: somfyDevice.label,
                                icon: manifest.icon,
                                class: manifest.class,
                                data:
                                {
                                    id: somfyDevice.oid,
                                    deviceURL: somfyDevice.deviceURL,
                                    label: somfyDevice.label,
                                    controllableName: somfyDevice.controllableName,
                                },
                                capabilities: manifest.capabilities,
                                capabilitiesOptions: manifest.capabilitiesOptions,
                                settings: manifest.settings,
                            };

                            this.log(homeyDevice);

                            homeyDevices.push(homeyDevice);
                        }
                    }
                }

                // const homeyDevices = devices.filter(device => this.somfyMap[device.controllableName]).map(device => (
                // {
                //     const manifest = this.homey.manifest.drivers.find( entry => entry.id === this.somfyMap[device.controllableName]);
                //     return {
                //         name: device.label,
                //         icon: this.homey.manifest.drivers[this.somfyMap[device.controllableName]].icon,
                //         data:
                //         {
                //             id: device.oid,
                //             deviceURL: device.deviceURL,
                //             label: device.label,
                //             controllableName: device.controllableName,
                //         },
                //     }
                // }));
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

}

module.exports = AllDevicesDriver;
