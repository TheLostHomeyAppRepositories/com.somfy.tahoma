/* jslint node: true */

'use strict';

const WindowCoveringsDevice = require('../WindowCoveringsDevice');

/**
 * Device class for exterior venetian blinds with the io:SimpleBioclimaticPergolaIOComponent controllable name in TaHoma
 * @extends {WindowCoveringsDevice}
 */
class PergolaDevice extends WindowCoveringsDevice {

	async onInit() {
		if (this.hasCapability('lock_state')) {
			this.removeCapability('lock_state').catch(this.error);
		}

		await super.onInit();

		const dd = this.getData();
		this.controllableName = '';
		if (dd.controllableName)
		{
			this.controllableName = dd.controllableName.toString().toLowerCase();
		}

		if (this.controllableName === 'ogp:pergola')
		{
			if (this.hasCapability('windowcoverings_state')) {
				this.removeCapability('windowcoverings_state').catch(this.error);
			}
			this.positionStateName = 'core:SlateOrientationState';
			this.setPositionActionName = 'core:TiltState';
			this.openClosedStateName = '';
		}
		else
		{
			this.windowcoveringsActions = {
				up: 'openSlats',
				idle: null,
				down: 'closeSlats',
			};

			this.positionStateName = 'core:SlatsOrientationState';
			this.setPositionActionName = 'setOrientation';
			this.openClosedStateName = 'core:SlatsOpenClosedState';
		}
	}

}

module.exports = PergolaDevice;
