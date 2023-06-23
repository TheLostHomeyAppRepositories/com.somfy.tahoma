/* jslint node: true */

'use strict';

const WindowCoveringsDevice = require('../WindowCoveringsDevice');

/**
 * Device class for exterior venetian blinds with the io:DiscreteGarageOpenerWithPartialPositionIOComponent controllable name in TaHoma
 * @extends {WindowCoveringsDevice}
 */
class GarageDoorPartialIODevice extends WindowCoveringsDevice
{

    async onInit()
    {
        if (this.hasCapability('lock_state'))
        {
            this.removeCapability('lock_state').catch(this.error);
        }

        await super.onInit();

        this.positionStateName = ''; // Device is not positionable
        this.setPositionActionName = ''; // Device is not positionable

        const dd = this.getData();

        this.controllableName = '';
        if (dd.controllableName)
        {
            this.controllableName = dd.controllableName.toString().toLowerCase();
        }

        if (this.controllableName === 'io:discretegarageopeneriocomponent')
        {
            if (this.hasCapability('my_position'))
            {
                this.removeCapability('my_position').catch(this.error);
            }
            this.openClosedStateName = 'core:OpenClosedUnknownState';
        }
        else
        {
            this.openClosedStateName = 'core:OpenClosedPartialState';
            this.myCommand = 'partialPosition'; // Name of the command to set the My position
        }

        if (this.invertUpDown)
        {
            // Homey capability to Somfy command map
            this.windowcoveringsActions = {
                up: 'close',
                idle: null,
                down: 'open',
            };

            // Somfy state to Homey capability map
            this.windowcoveringsStatesMap = {
                open: 'down',
                closed: 'up',
                unknown: 'idle',
                partial: 'idle',
            };
        }
        else
        {
            this.windowcoveringsActions = {
                up: 'open',
                idle: null,
                down: 'close',
            };

            this.windowcoveringsStatesMap = {
                open: 'up',
                closed: 'down',
                unknown: 'idle',
                partial: 'idle',
            };
        }
    }

}

module.exports = GarageDoorPartialIODevice;
