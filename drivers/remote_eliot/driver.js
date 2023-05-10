/* jslint node: true */

'use strict';

const Driver = require('../Driver');

/**
 * Driver class for the remote controller with the "eliot:RemoteEliotComponent" controllable name in TaHoma
 * @extends {Driver}
 */
// eslint-disable-next-line camelcase
class eliot_remoteDriver extends Driver
{

    async onInit()
    {
        this.deviceType = ['eliot:RemoteEliotComponent'];
        await super.onInit();

        this._remoteStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('eliot_remote_state_changed');

        this._remoteStateChangedTriggerTo = this.homey.flow.getDeviceTriggerCard('eliot_remote_state_changed_to')
            .registerRunListener((args, state) =>
            {
                // If true, this flow should run
                return Promise.resolve(args.expected_state === state.expected_state);
            });
    }

    triggerRemoteStateChange(device, tokens, state)
    {
        this.triggerFlow(this._remoteStateChangedTrigger, device, tokens, state);
        return this;
    }

    triggerRemoteStateChangeTo(device, tokens, state)
    {
        this.triggerFlow(this._remoteStateChangedTriggerTo, device, tokens, state);
        return this;
    }

}

// eslint-disable-next-line camelcase
module.exports = eliot_remoteDriver;
