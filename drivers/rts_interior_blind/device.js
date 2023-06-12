/* jslint node: true */

'use strict';

const WindowCoveringsDevice = require('../WindowCoveringsDevice');

/**
 * @extends {WindowCoveringsDevice}
 */
class InteriorBlindDevice extends WindowCoveringsDevice {

    async onInit() {
        if (this.hasCapability('lock_state'))
        {
            this.removeCapability('lock_state').catch(this.error);
        }

        if (this.hasCapability('windowcoverings_state.rts'))
        {
            this.removeCapability('windowcoverings_state.rts').catch(this.error);
            this.addCapability('windowcoverings_state').catch(this.error);
        }
        const dd = this.getData();
        let controllableName = '';
        if (dd.controllableName)
        {
            controllableName = dd.controllableName.toString().toLowerCase();
        }

        if (controllableName === 'ogp:blind')
        {
            if (this.hasCapability('my_position'))
            {
                this.removeCapability('my_position').catch(this.error);
            }
        }
        else
        {
            if (controllableName === 'profalux868:profalux868rollershutter')
            {
                this.myCommand = 'goToMemorized1Position';
            }

            if (!this.hasCapability('my_position'))
            {
                this.addCapability('my_position').catch(this.error);
            }
        }

        await super.onInit();

        this.positionStateName = '';
        this.openClosedStateName = '';
        this.boostSync = true;
    }

    async sync() {
        // No states are available so no need to call anything
    }

}

module.exports = InteriorBlindDevice;
