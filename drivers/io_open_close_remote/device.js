/* jslint node: true */

'use strict';

const Device = require('../Device');

/**
 * Device class for the remote controller with the "io:IORemoteController" controllable name in TaHoma
 * @extends {Device}
 */

// eslint-disable-next-line camelcase
class io_open_close_remoteDevice extends Device
{

	async onInit()
	{
		this.registerCapabilityListener('remote_state', this.onCapabilityRemoteState.bind(this));

		await super.onInit();
	}

	onCapabilityRemoteState(value)
	{
		// const oldState = this.getState().remote_state;
		// if (oldState !== value)
		// {
			this.setCapabilityValue('remote_state', null).catch(this.error);

			const device = this;
			const tokens = {
				remote_state: value,
			};
			const state = {
				expected_state: value,
			};

			// trigger flows
			this.driver.triggerRemoteSateChange(device, tokens, state);
			this.driver.triggerRemoteSateChangeTo(device, tokens, state);
		// }

		return Promise.resolve();
	}

	/**
	 * Gets the data from the TaHoma cloud
	 */
	async sync()
	{
		// Nothing to do here
	}

	// look for updates in the events array
	async syncEvents(events, local)
	{
		if (events === null)
		{
			this.sync();
			return;
		}

		const myURL = this.getDeviceUrl();
		if (!local && this.homey.app.isLocalDevice(myURL))
		{
			// This device is handled locally so ignore cloud updates
			return;
		}

		// Process events sequentially so they are in the correct order
		for (let i = 0; i < events.length; i++)
		{
			const element = events[i];
			if (element.name === 'DeviceStateChangedEvent')
			{
				if ((element.deviceURL === myURL) && element.deviceStates)
				{
					if (this.homey.app.infoLogEnabled)
					{
						this.homey.app.logInformation(this.getName(),
						{
							message: 'Processing device state change event',
							stack: element,
						});
					}
					// Got what we need to update the device so lets find it
					for (let x = 0; x < element.deviceStates.length; x++)
					{
						const deviceState = element.deviceStates[x];
						if (deviceState.name === 'io:OneWayControllerButtonState')
						{
							this.homey.app.logStates(`${this.getName()}: io:OneWayControllerButtonState = ${deviceState.value}`);
							const newSate = deviceState.value;
							this.triggerCapabilityListener('remote_state', newSate).catch(this.error);
							this.homey.setTimeout(() =>
							{
								this.setCapabilityValue('remote_state', null).catch(this.error);
							}, 500);
						}
					}
				}
			}
		}
	}

}

// eslint-disable-next-line camelcase
module.exports = io_open_close_remoteDevice;
