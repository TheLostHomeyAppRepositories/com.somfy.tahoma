/* jslint node: true */

'use strict';

const Device = require('../Device');

class rtsDimmableLightDevice extends Device
{

	async onInit()
	{
		await super.onInit();

		// Register the capability listeners
		this.registerCapabilityListener('on_button', this.onCapabilityOn.bind(this));
		this.registerCapabilityListener('off_button', this.onCapabilityOff.bind(this));
		this.registerCapabilityListener('on_with_timer', this.sendOnWithTimer.bind(this));
		this.setCapabilityValue('on_with_timer', 0).catch(this.error);

		this.registerCapabilityListener('my_position', this.onCapabilityMyPosition.bind(this));

		this.registerCapabilityListener('dim_up_button', this.onCapabilityDimUp.bind(this));
		this.registerCapabilityListener('dim_down_button', this.onCapabilityDimDown.bind(this));
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

	async onCapabilityMyPosition(value)
	{
		if (this.commandExecuting === 'my')
		{
			// This command is still processing
			return;
		}

		this.sendMyPosition();
	}

	async sendMyPosition()
	{
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
			name: 'my',
			parameters: [],
		};

		const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
		this.commandExecuting = action.name;
		this.executionCmd = action.name;
		this.executionId = { id: result.execId, local: result.local };
	}

	async onCapabilityDimUp(value)
	{
		if (this.commandExecuting === 'up')
		{
			// This command is still processing
			return;
		}

		this.sendDimUp();
	}

	async onCapabilityDimDown(value)
	{
		if (this.commandExecuting === 'down')
		{
			// This command is still processing
			return;
		}

		this.sendDimDown();
	}

	async sendDimUpDown(value)
	{
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
				name: 'down',
				parameters: [],
			};
		}
		else
		{
			action = {
				name: 'up',
				parameters: [],
			};
		}

		const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
		this.commandExecuting = action.name;
		this.executionCmd = action.name;
		this.executionId = { id: result.execId, local: result.local };
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
module.exports = rtsDimmableLightDevice;
