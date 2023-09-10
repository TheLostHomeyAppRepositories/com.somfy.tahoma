/* jslint node: true */

'use strict';

const WindowCoveringsDevice = require('../WindowCoveringsDevice');

/**
 * Device class for vertical exterior blinds with the io:VerticalExteriorAwningIOComponent controllable name in TaHoma
 * @extends {WindowCoveringsDevice}
 */
class VerticalExteriorBlindDevice extends WindowCoveringsDevice
{

    async onInit()
    {
        if (!this.hasCapability('lock_state'))
        {
            this.addCapability('lock_state');
        }

        await super.onInit();

        if (!this.hasCapability('quick_open'))
        {
            this.addCapability('quick_open').catch(this.error);
        }

        const dd = this.getData();

        this.controllableName = '';
        if (dd.controllableName)
        {
            this.controllableName = dd.controllableName.toString().toLowerCase();
        }

        if (!this.hasCapability('my_position'))
        {
            this.addCapability('my_position').catch(this.error);
        }
    }

}

module.exports = VerticalExteriorBlindDevice;
