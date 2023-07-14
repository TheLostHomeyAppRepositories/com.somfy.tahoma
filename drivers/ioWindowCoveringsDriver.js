/* jslint node: true */

'use strict';

const Driver = require('./Driver');

class ioWindowCoveringsDriver extends Driver
{

    async onInit()
    {
        super.onInit();
    }

    triggerLockStateChange(device, tokens, state)
    {
        if (this.lock_state_changedTrigger)
        {
            this.triggerFlow(this.lock_state_changedTrigger, device, tokens, state);
        }
        return this;
    }

}

module.exports = ioWindowCoveringsDriver;
