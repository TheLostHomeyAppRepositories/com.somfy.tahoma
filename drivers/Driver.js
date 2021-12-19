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

    async onRepair(session, device)
    {
        let username = this.homey.settings.get('username');
        let password = this.homey.settings.get('password');
        const linkurl = 'default';

        // session.setHandler('showView', async view =>
        // {
        //     if (view === 'login_credentials')
        //     {
        //         if (username && password && this.homey.app.loggedIn)
        //         {
        //             await session.nextView();
        //         }
        //     }
        // });

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
    }

    async onReceiveSetupData()
    {
        try
        {
            const devices = await this.homey.app.tahoma.getDeviceData();
            if (devices)
            {
                this.log('setup resolve');
                const homeyDevices = devices.filter(device => this.deviceType.indexOf(device.controllableName) !== -1).map(device => (
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
     * Returns the io controllable name(s) of TaHoma
     * @return {Array} deviceType
     */
    getDeviceType()
    {
        return this.deviceType ? this.deviceType : false;
    }

}
module.exports = Driver;
