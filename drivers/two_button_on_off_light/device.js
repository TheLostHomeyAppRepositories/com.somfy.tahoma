/* jslint node: true */

'use strict';

const Device = require('../Device');

// eslint-disable-next-line camelcase
class two_button_on_offDevice extends Device
{

	async onInit()
	{
		await super.onInit();
		this.boostSync = true;
		this.registerCapabilityListener('on_button', this.onCapabilityOn.bind(this));
		this.registerCapabilityListener('off_button', this.onCapabilityOff.bind(this));
		this.registerCapabilityListener('on_with_timer', this.sendOnWithTimer.bind(this));

		this.setCapabilityValue('on_with_timer', 0).catch(this.error);
	}

	async onCapabilityOn(value)
	{
		if (this.commandExecuting === 'on')
		{
			// This command is still processing
			return;
		}

		this.sendOnOff(true);
	}

	async onCapabilityOff(value)
	{
		if (this.commandExecuting === 'off')
		{
			// This command is still processing
			return;
		}

		this.sendOnOff(false);
	}

	async sendOnOff(value)
	{
		if (this.onTime)
		{
			clearTimeout(this.onTime);
			this.setCapabilityValue('on_with_timer', 0).catch(this.error);
		}

		const deviceData = this.getData();
		if (this.executionId !== null)
		{
			// Wait for previous command to complete
			let retries = 20;
			while ((this.executionId !== null) && (retries-- > 0))
			{
				await this.homey.app.asyncDelay(500);
			}
		}

		let action;
		if (value === false)
		{
			action = {
				name: 'off',
				parameters: [],
			};
		}
		else
		{
			action = {
				name: 'on',
				parameters: [],
			};
		}
		const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
		this.commandExecuting = action.name;
		this.executionCmd = action.name;
		this.executionId = { id: result.execId, local: result.local };
	}

	async sendOnWithTimer(value)
	{
		if (value === 0)
		{
			this.onCapabilityOff(false);
			return;
		}

		if (this.onTime)
		{
			clearTimeout(this.onTime);
		}

		const deviceData = this.getData();
		if (this.executionId !== null)
		{
			// Wait for previous command to complete
			let retries = 20;
			while ((this.executionId !== null) && (retries-- > 0))
			{
				await this.homey.app.asyncDelay(500);
			}
		}

		const action = {
			name: 'onWithTimer',
			parameters: [value],
		};

		const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
		this.commandExecuting = action.name;
		this.executionCmd = action.name;
		this.executionId = { id: result.execId, local: result.local };

		this.doOnTimer();
	}

	doOnTimer()
	{
		this.onTime = this.homey.setTimeout(() =>
		{
			const timeRemaining = this.getCapabilityValue('on_with_timer');

			if (timeRemaining > 0)
			{
				this.setCapabilityValue('on_with_timer', timeRemaining - 1).catch(this.error);
				this.doOnTimer();
			}
		}, 60000);
	}

	// look for updates in the events array
	async syncEvents(events, local)
	{
		if (events === null)
		{
			return this.sync();
		}

		const myURL = this.getDeviceUrl();
		if (!local && this.homey.app.isLocalDevice(myURL))
		{
			// This device is handled locally so ignore cloud updates
			return myURL;
		}

		// Process events sequentially so they are in the correct order
		for (let i = 0; i < events.length; i++)
		{
			const element = events[i];
			if (element.name === 'ExecutionRegisteredEvent')
			{
				for (let x = 0; x < element.actions.length; x++)
				{
					if (myURL === element.actions[x].deviceURL)
					{
						if (!this.executionId || (this.executionId.id !== element.execId))
						{
							this.executionId = { id: element.execId, local };
							if (element.actions[x].commands)
							{
								this.executionCmd = element.actions[x].commands[0].name;
							}
							else
							{
								this.executionCmd = element.actions[x].command;
							}
							if (!local && this.boostSync)
							{
								if (!await this.homey.app.boostSync())
								{
									this.executionCmd = '';
									this.executionId = null;
								}
							}
						}
					}
				}
			}
			else if (element.name === 'ExecutionStateChangedEvent')
			{
				if ((element.newState === 'COMPLETED') || (element.newState === 'FAILED'))
				{
					if (this.executionId && (this.executionId.id === element.execId))
					{
						if (!local && this.boostSync)
						{
							await this.homey.app.unBoostSync();
						}

						this.homey.app.triggerCommandComplete(this, this.executionCmd, (element.newState === 'COMPLETED'));
						this.commandExecuting = '';
						this.executionId = null;
						this.executionCmd = '';
					}
				}
			}
		}

		return myURL;
	}

}

// eslint-disable-next-line camelcase
module.exports = two_button_on_offDevice;
