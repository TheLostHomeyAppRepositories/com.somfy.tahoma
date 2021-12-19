/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the remote controller with the "io:IORemoteController" controllable name in TaHoma
 * @extends {Driver}
 */
// eslint-disable-next-line camelcase
class key_go_remoteDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['io:KeygoController'];
        await super.onInit();
    }

    async onReceiveSetupData(callback)
    {
        try
        {
            const devices = await this.homey.app.tahoma.getDeviceData();
            if (devices)
            {
                this.log('setup resolve');
                const homeyDevices = devices.filter(device => this.deviceType.indexOf(device.controllableName) !== -1).map(device => (
                {
                    name: `${device.label}: ${device.attributes[0].name === 'core:GroupIndex' ? device.attributes[0].value : device.attributes[1].value}`,
                    data:
                    {
                        id: device.oid,
                        deviceURL: device.deviceURL,
                        label: device.label,
                        controllableName: device.controllableName,
                    },
                }));
                callback(null, homeyDevices);
            }
        }
        catch (error)
        {
            this.homey.app.logInformation('OnReceiveSetupData', error);
            callback(error);
        }
    }

}

// eslint-disable-next-line camelcase
module.exports = key_go_remoteDriver;
