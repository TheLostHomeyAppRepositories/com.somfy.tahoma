/* jslint node: true */

'use strict';

const Device = require('../Device');

const CapabilitiesXRef = [
	{
		homeyName: 'ergonomics_mode',
		somfyNameGet: 'zigbee:SomfyErgonomicsState',
		somfyNameSet: [],
	},
];

class ZigbeeRemoteErgonomicsDevice extends Device
{

	async onInit()
	{
		await super.onInit(CapabilitiesXRef);

		if (!this.hasCapability('ergonomics_mode'))
		{
			try
			{
				await this.addCapability('ergonomics_mode');
			}
			catch (error)
			{
				this.error(error);
			}
		}

		this.boostSync = true;
	}

	async syncEvents(events, local)
	{
		await this.syncEventsList(events, CapabilitiesXRef, local);
	}

	async syncEventsList(events, CapabilitiesXRef, local)
	{
		if (events === null)
		{
			return this.syncList(CapabilitiesXRef);
		}

		const myURL = this.getDeviceUrl();
		if (!local && this.homey.app.isLocalDevice(myURL))
		{
			return;
		}

		const oldCapabilityStates = this.getState();

		for (const event of events)
		{
			if (event.name === 'DeviceStateChangedEvent')
			{
				if (this.isRelatedDeviceURL(event.deviceURL, myURL) && Array.isArray(event.deviceStates))
				{
					if (this.homey.app.infoLogEnabled)
					{
						this.homey.app.logInformation(this.getName(),
							{
								message: 'Processing device state change event',
								stack: event,
							});
					}

					for (const tahomaState of event.deviceStates)
					{
						if (tahomaState.name === 'zigbee:SomfyErgonomicsState')
						{
							this.homey.app.logStates(`${this.getName()}: ${tahomaState.name} = ${tahomaState.value}`);
							const oldState = oldCapabilityStates.ergonomics_mode;
							const newState = tahomaState.value;

							if (oldState !== newState)
							{
								this.triggerCapabilityListener('ergonomics_mode', newState, { fromCloudSync: true }).catch(this.error);

								if (this.driver.triggerErgonomicsModeChange)
								{
									const tokens = { mode: newState };
									this.driver.triggerErgonomicsModeChange(this, tokens);
								}

								if (this.driver.triggerErgonomicsModeChangeTo)
								{
									const tokens = { mode: newState };
									const state = { expected_mode: newState };
									this.driver.triggerErgonomicsModeChangeTo(this, tokens, state);
								}
							}
						}
						else if ((tahomaState.name === 'core:BatteryLevelState') || (tahomaState.name === 'core:BatteryState'))
						{
							await this.updateBatteryLevelCapability(tahomaState);
						}
					}
				}
			}
		}

		await this.syncBatteryLevelCapability(event?.deviceStates || [], CapabilitiesXRef);
	}

	async syncList(CapabilitiesXRef)
	{
		try
		{
			let tahomaStates = await this.getStates();
			if (tahomaStates)
			{
				for (const xRefEntry of CapabilitiesXRef)
				{
					const tahomaState = tahomaStates.find((state) => (state && (state.name === xRefEntry.somfyNameGet)));
					if (tahomaState)
					{
						this.homey.app.logStates(`${this.getName()}: ${xRefEntry.somfyNameGet} = ${tahomaState.value}`);
						this.triggerCapabilityListener(xRefEntry.homeyName, tahomaState.value, { fromCloudSync: true }).catch(this.error);
					}
				}

				await this.syncBatteryLevelCapability(tahomaStates, CapabilitiesXRef);
			}
		}
		catch (error)
		{
			this.homey.app.logInformation(this.getName(),
				{
					message: error.message,
					stack: error.stack,
				});
		}
	}

}

module.exports = ZigbeeRemoteErgonomicsDevice;
