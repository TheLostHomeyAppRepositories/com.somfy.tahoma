/* jslint node: true */

'use strict';

const WindowCoveringsDevice = require('../WindowCoveringsDevice');

class VeluxInteriorBlindDevice extends WindowCoveringsDevice {

	async onInit() {
		if (this.hasCapability('lock_state')) {
			this.removeCapability('lock_state').catch(this.error);
		}

		await super.onInit();

		if (!this.hasCapability('windowcoverings_closed')) {
			this.addCapability('windowcoverings_closed').catch(this.error);
		}
	}

}

module.exports = VeluxInteriorBlindDevice;
