/* jslint node: true */

'use strict';

const WindowCoveringsDevice = require('../WindowCoveringsDevice');

/**
 * Device class for exterior venetian blinds with the io:ExteriorVenetianBlindIOComponent controllable name in TaHoma
 * @extends {WindowCoveringsDevice}
 */
class ExteriorVenetianBlindDevice extends WindowCoveringsDevice
{

	async onInit()
	{
		if (this.hasCapability('lock_state'))
		{
			this.removeCapability('lock_state').catch(this.error);
		}

		if (!this.hasCapability('windowcoverings_closed'))
		{
			this.addCapability('windowcoverings_closed').catch(this.error);
		}

		if (!this.hasCapability('windowcoverings_tilt_set'))
		{
			this.addCapability('windowcoverings_tilt_set').catch(this.error);
		}

		await super.onInit();

		const dd = this.getData();
		let controllableName = '';
		if (dd.controllableName)
		{
			controllableName = dd.controllableName.toString().toLowerCase();
		}

		if ((controllableName === 'ogp:venetianblind') || (controllableName === 'io:dynamicexteriorvenetianblind') || (controllableName === 'zigbee:somfyvenetianblindcomponent'))
		{
			if (!this.hasCapability('my_position'))
			{
				this.addCapability('my_position').catch(this.error);
			}

			if (controllableName === 'ogp:venetianblind')
			{
				this.myCommand = 'goToAlias'; // Name of the command to set the My position
			}
			else
			{
				this.myCommand = 'my'; // Name of the command to set the My position
			}
		}
		else if (this.hasCapability('my_position'))
		{
			this.removeCapability('my_position').catch(this.error);
		}
	}

}

module.exports = ExteriorVenetianBlindDevice;
