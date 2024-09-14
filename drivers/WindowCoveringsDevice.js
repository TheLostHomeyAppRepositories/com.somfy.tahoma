/* jslint node: true */

'use strict';

const Device = require('./Device');

/**
 * Base class for window coverings devices
 * @extends {Device}
 */
class WindowCoveringsDevice extends Device
{

	async onInit()
	{
		this.requiresQuietMode = false;

		if (this.hasCapability('lock_state'))
		{
			this.driver.lock_state_changedTrigger = this.homey.flow.getDeviceTriggerCard('lock_state_changed');
		}

		const classType = this.getSetting('classType');
		if (classType === null)
		{
			this.setSetting('classType', this.getClass());
		}

		this.invertPosition = this.getSetting('invertPosition');
		if (this.invertPosition === null)
		{
			this.invertPosition = false;
		}

		this.invertTile = this.getSetting('invertTile');
		if (this.invertTile === null)
		{
			this.invertTile = false;
		}

		this.invertUpDown = this.getSetting('invertUpDown');
		if (this.invertUpDown === null)
		{
			this.invertUpDown = false;
		}

		if (this.invertUpDown)
		{
			// Homey capability to Somfy command map
			this.windowcoveringsActions = {
				up: 'close',
				idle: 'stop',
				down: 'open',
			};

			// Somfy state to Homey capability map
			this.windowcoveringsStatesMap = {
				open: 'down',
				closed: 'up',
				unknown: 'idle',
			};
		}
		else
		{
			this.windowcoveringsActions = {
				up: 'open',
				idle: 'stop',
				down: 'close',
			};

			this.windowcoveringsStatesMap = {
				open: 'up',
				closed: 'down',
				unknown: 'idle',
			};
		}

		this.clearStateTimer = null;
		this.positionStateName = 'core:ClosureState'; // Name of state to get the current position
		this.setPositionActionName = 'setClosure'; // Name of the command to set the current position
		this.openClosedStateName = 'core:OpenClosedState'; // Name of the state to get open / closed state
		this.myCommand = 'my'; // Name of the command to set the My position

		this.quietMode = false;

		this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoveringsState.bind(this));
		this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoveringsSet.bind(this));
		this.registerCapabilityListener('windowcoverings_tilt_up', this.onCapabilityWindowcoveringsTiltUp.bind(this));
		this.registerCapabilityListener('windowcoverings_tilt_down', this.onCapabilityWindowcoveringsTiltDown.bind(this));
		this.registerCapabilityListener('my_position', this.onCapabilityMyPosition.bind(this));
		this.registerCapabilityListener('quick_open', this.onCapabilityWindowcoveringsClosed.bind(this));
		this.registerCapabilityListener('windowcoverings_tilt_set', this.onCapabilityWindowcoveringsTiltSet.bind(this));

		await super.onInit();

		this.boostSync = true;
	}

	onAdded()
	{
		this.log('device added');
		this.sync();
	}

	async onSettings({ oldSettings, newSettings, changedKeys })
	{
		if (changedKeys.indexOf('invertUpDown') >= 0)
		{
			this.invertUpDown = newSettings.invertUpDown;

			if (this.invertUpDown)
			{
				this.windowcoveringsActions = {
					up: 'close',
					idle: 'stop',
					down: 'open',
				};

				this.windowcoveringsStatesMap = {
					open: 'down',
					closed: 'up',
					unknown: 'idle',
				};
			}
			else
			{
				this.windowcoveringsActions = {
					up: 'open',
					idle: 'stop',
					down: 'close',
				};

				this.windowcoveringsStatesMap = {
					open: 'up',
					closed: 'down',
					unknown: 'idle',
				};
			}
		}

		if (changedKeys.indexOf('invertTile') >= 0)
		{
			this.invertTile = newSettings.invertTile;
		}

		if (changedKeys.indexOf('invertPosition') >= 0)
		{
			this.invertPosition = newSettings.invertPosition;
		}

		if (changedKeys.indexOf('classType') >= 0)
		{
			this.setClass(newSettings.classType);
		}
	}

	async onCapabilityWindowcoveringsState(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			if (this.windowcoveringsActions[value] === null)
			{
				// Action is not supported
				this.homey.app.logInformation(`${this.getName()}: onCapabilityWindowcoveringsState`, 'option not supported');
				return;
			}

			try
			{
				const deviceData = this.getData();

				if (value === 'idle' && (this.executionId !== null))
				{
					await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
					this.executionCmd = '';
					this.executionId = null;
				}

				if (this.executionCmd !== null)
				{
					if (this.executionCmd === this.windowcoveringsActions[value])
					{
						// Already executing this command so ignore it
						this.homey.app.logInformation(`${this.getName()}: onCapabilityWindowcoveringsState`, `command ${this.executionCmd} already executing`);
						return;
					}

					if (this.executionId !== null)
					{
						await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
						this.executionCmd = '';
						this.executionId = null;
					}
				}
				this.executionCmd = this.windowcoveringsActions[value];

				const action = {
					name: this.executionCmd,
					parameters: [],
				};

				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.executionCmd = '';
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}
			finally
			{
				if (!this.openClosedStateName)
				{
					this.clearStateTimer = this.homey.setTimeout(() =>
					{
						this.clearStateTimer = null;
						this.setCapabilityValue('windowcoverings_state', null).catch(this.error);
					}, 40000);
				}
			}
		}
		else
		{
			// New value from Tahoma
			if (this.homey.app.infoLogEnabled)
			{
				const oldValue = this.getCapabilityValue('windowcoverings_state');
				this.homey.app.logInformation(`${this.getName()}: onCapabilityWindowcoveringsState`, `Old Value: ${oldValue}, New Value: ${value}`);
			}

			this.setCapabilityValue('windowcoverings_state', value).catch(this.error);
			if (this.hasCapability('quick_open'))
			{
				if (this.invertTile)
				{
					this.setCapabilityValue('quick_open', value !== 'up').catch(this.error);
				}
				else
				{
					this.setCapabilityValue('quick_open', value !== 'down').catch(this.error);
				}
			}
		}
	}

	async onCapabilityWindowcoveringsSet(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			const deviceData = this.getData();

			try
			{
				if (this.executionCmd !== null)
				{
					if (this.executionCmd === `${this.setPositionActionName}, ${value}`)
					{
						// Already executing this command so ignore it
						this.homey.app.logInformation(`${this.getName()}: onCapabilityWindowcoveringsSet`, `command ${this.executionCmd} already executing`);
						return;
					}

					if (this.executionId !== null)
					{
						await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
						this.executionCmd = '';
						this.executionId = null;
					}
				}
				this.executionCmd = `${this.setPositionActionName}, ${value}`;

				if (this.invertPosition)
				{
					value = 1 - value;
				}
				const action = {
					name: this.setPositionActionName, // Anders pull request
					parameters: [Math.round((1 - value) * 100)],
				};

				if (this.setPositionActionName === 'setPositionAndLinearSpeed')
				{
					// Add low speed option if quiet mode is selected
					action.parameters.push('lowspeed');
				}

				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.executionCmd = '';
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}
		}
		else
		{
			// New value from Tahoma
			if (this.homey.app.infoLogEnabled)
			{
				const oldValue = this.getCapabilityValue('windowcoverings_set');
				this.homey.app.logInformation(`${this.getName()}: onCapabilityWindowcoveringsSet`, `Old Value ${oldValue}, New Value: ${value}`);
			}

			this.setCapabilityValue('windowcoverings_set', value).catch(this.error);
		}
	}

	async onCapabilityWindowcoveringsTiltSet(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			const deviceData = this.getData();
			try
			{
				if (this.executionId !== null)
				{
					await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
					this.executionCmd = '';
					this.executionId = null;
				}

				const action = {
					name: 'setOrientation',
					parameters: [Math.round((1 - value) * 100)],
				};

				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionCmd = action.name;
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}
		}
		else
		{
			// New value from Tahoma
			this.setCapabilityValue('windowcoverings_tilt_set', value).catch(this.error);

			// trigger flows
			const tokens = {
				windowcoverings_tilt: value,
			};
			this.driver.triggerTiltChange(this, tokens);
		}
	}

	async onCapabilityWindowcoveringsTiltUp(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			const deviceData = this.getData();
			try
			{
				if (this.executionId !== null)
				{
					await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
					this.executionCmd = '';
					this.executionId = null;
				}

				const action = {
					name: 'tiltPositive',
					parameters: [3, 1],
				};
				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionCmd = action.name;
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}
		}
	}

	async onCapabilityWindowcoveringsTiltDown(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			const deviceData = this.getData();
			try
			{
				if (this.executionId !== null)
				{
					await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
					this.executionCmd = '';
					this.executionId = null;
				}

				const action = {
					name: 'tiltNegative',
					parameters: [3, 1],
				};
				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionCmd = action.name;
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}
		}
	}

	async onCapabilityMyPosition(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			const deviceData = this.getData();
			try
			{
				if (this.executionId !== null)
				{
					await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
				}

				const action = {
					name: this.myCommand,
					parameters: [],
				};
				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionCmd = action.name;
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}
		}
	}

	async onCapabilityPedestrian(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			const deviceData = this.getData();
			try
			{
				if (this.executionId !== null)
				{
					await this.homey.app.cancelExecution(this.executionId.id, this.executionId.local);
				}

				const action = {
					name: 'setPedestrianPosition',
					parameters: [],
				};
				const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
				this.executionCmd = action.name;
				this.executionId = { id: result.execId, local: result.local };

				this.setWarning(null).catch(this.error);
			}
			catch (err)
			{
				this.setWarning(err.message).catch(this.error);
				throw (err);
			}

			this.setWarning(null).catch(this.error);
		}
		else
		{
			// New value from Tahoma
			this.setCapabilityValue('pedestrian', value).catch(this.error);

			// trigger flows
			const tokens = {
				pedestrian: value,
			};
			this.driver.triggerPedestrianChange(this, tokens);
		}
	}

	async onCapabilityWindowcoveringsClosed(value, opts)
	{
		if (this.invertTile)
		{
			return this.onCapabilityWindowcoveringsState(value ? 'down' : 'up', null);
		}

			return this.onCapabilityWindowcoveringsState(value ? 'up' : 'down', null);
	}

	/**
	 * Sync the state of the devices from the TaHoma cloud with Homey
	 */
	async sync()
	{
		try
		{
			let foundActiveOptionstate = false;

			let states = await super.getStates();
			if (states)
			{
				if (this.hasCapability('lock_state'))
				{
					const lockState = states.find((state) => (state && (state.name === 'io:PriorityLockOriginatorState')));
					if (lockState)
					{
						this.homey.app.logStates(`${this.getName()}: io:PriorityLockOriginatorState = ${lockState.value}`);
						this.setCapabilityValue('lock_state', lockState.value).catch(this.error);
						if (this.driver.triggerLockStateChange)
						{
							const tokens = {
								lock_state: lockState.value,
							};
							this.driver.triggerLockStateChange(this, tokens);
						}

						if (this.checkLockSate)
						{
							clearTimeout(this.checkLockStateTimer);
							this.checkLockStateTimer = this.homey.setTimeout(this.checkLockSate, 60 * 30000);
						}
					}
					else
					{
						const lockStateTimer = states.find((state) => (state && (state.name === 'core:PriorityLockTimerState')));
						if (lockStateTimer)
						{
							this.homey.app.logStates(`${this.getName()}: core:PriorityLockTimerState = ${lockStateTimer.value}`);
							if ((lockStateTimer.value === '0') || (lockStateTimer.value === 0))
							{
								this.setCapabilityValue('lock_state', '').catch(this.error);
								if (this.driver.triggerLockStateChange)
								{
									const tokens = {
										lock_state: '',
									};
									this.driver.triggerLockStateChange(this, tokens);
								}
							}
							else if (this.checkLockSate)
							{
								clearTimeout(this.checkLockStateTimer);
								this.checkLockStateTimer = this.homey.setTimeout(this.checkLockSate, (60 * parseInt(lockStateTimer.value, 10)));
							}
						}
					}
				}

				const myPosition = states.find((state) => (state && (state.name === 'core:Memorized1PositionState')));
				if (myPosition)
				{
					if (!this.hasCapability('my_value'))
					{
						await this.addCapability('my_value');
					}

					this.homey.app.logStates(`${this.getName()}: core:Memorized1PositionState = ${myPosition.value}`);
					this.setCapabilityValue('my_value', myPosition.value).catch(this.error);
				}

				// device exists -> let's sync the state of the device
				const closureState = states.find((state) => (state && (state.name === this.positionStateName)));
				const openClosedState = states.find((state) => (state && (state.name === this.openClosedStateName)));
				const tiltState = states.find((state) => (state && (state.name === 'core:SlateOrientationState')));

				if (this.unavailable)
				{
					this.unavailable = false;
					this.setAvailable().catch(this.error);
				}

				if (openClosedState)
				{
					this.homey.app.logStates(`${this.getName()}: ${this.openClosedStateName} = ${openClosedState.value}`);

					// Convert Tahoma states to Homey equivalent
					if (closureState && (closureState.value !== 0) && (closureState.value !== 100))
					{
						// Not fully open or closed
						openClosedState.value = 'idle';
					}
					else
					{
						if (this.openClosedStateName === 'core:OpenClosedPedestrianState')
						{
							// Special state = My Position
							this.triggerCapabilityListener('pedestrian', (openClosedState.value === 'pedestrian'),
							{
								fromCloudSync: true,
							}).catch(this.error);
						}

						openClosedState.value = this.windowcoveringsStatesMap[openClosedState.value];
					}

					this.triggerCapabilityListener('windowcoverings_state', openClosedState.value,
					{
						fromCloudSync: true,
					}).catch(this.error);
				}

				if (closureState)
				{
					this.homey.app.logStates(`${this.getName()}: ${this.positionStateName} = ${closureState.value}`);

					if (this.invertPosition)
					{
						closureState.value = 100 - closureState.value;
					}
					this.triggerCapabilityListener('windowcoverings_set', 1 - (closureState.value / 100),
					{
						fromCloudSync: true,
					}).catch(this.error);
				}

				if (tiltState)
				{
					this.homey.app.logStates(`${this.getName()}: core:SlateOrientationState = ${tiltState.value}`);

					this.triggerCapabilityListener('windowcoverings_tilt_set', 1 - (tiltState.value / 100),
					{
						fromCloudSync: true,
					}).catch(this.error);
				}

				if (this.hasCapability('measure_battery'))
				{
					const batteryState = states.find((state) => (state && (state.name === 'core:BatteryState')));
					if (batteryState)
					{
						const batteryStates = ['verylow', 'low', 'normal', 'full'];
						const batteryLevel = batteryStates.findIndex((state) => state === batteryState.value);
						if (batteryLevel >= 0)
						{
							this.setCapabilityValue('measure_battery', (batteryLevel * 100) / 3).catch(this.error);
						}
					}
				}

				const silentState = states.find((state) => (state && (state.name === 'core:ActivatedOptionsState')));
				if (silentState)
				{
					this.homey.app.logStates(`${this.getName()}: core:ActivatedOptionsState = ${silentState.value}`);
					if (!this.hasCapability('quiet_mode'))
					{
						await this.addCapability('quiet_mode');
					}
					this.setCapabilityValue('quiet_mode', silentState.value.includes('silence')).catch(this.error);
					foundActiveOptionstate = true;
				}

				states = null;
			}
			else if (this.openClosedStateName === '')
			{
				// RTS devices have no feedback
				if (this.unavailable)
				{
					this.unavailable = false;
					this.setAvailable().catch(this.error);
				}

				this.log(this.getName(), ' No device status');

				this.setCapabilityValue('windowcoverings_state', null).catch(this.error);
			}

			if (!this.requiresQuietMode && !foundActiveOptionstate && this.hasCapability('quiet_mode'))
			{
				this.removeCapability('quiet_mode').catch(this.error);
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

	/**
	 * Sync the state of the devices from the TaHoma cloud with Homey
	 */
	async syncEvents(events, local)
	{
		if (events === null)
		{
			this.sync();
			return;
		}

		try
		{
			const myURL = this.getDeviceUrl();

			let lastPosition = null;

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
						if (this.unavailable)
						{
							this.unavailable = false;
							this.setAvailable().catch(this.error);
						}

						for (let x = 0; x < element.deviceStates.length; x++)
						{
							const deviceState = element.deviceStates[x];

							// Device lock state
							if (deviceState.name === 'io:PriorityLockOriginatorState')
							{
								if (this.hasCapability('lock_state') && (deviceState.value))
								{
									this.homey.app.logStates(`${this.getName()}: io:PriorityLockOriginatorState = ${deviceState.value}`);
									this.setCapabilityValue('lock_state', deviceState.value).catch(this.error);
									if (this.driver.triggerLockStateChange)
									{
										const tokens = {
											lock_state: deviceState.value,
										};
										this.driver.triggerLockStateChange(this, tokens);
									}
									if (this.checkLockSate)
									{
										// Setup timer to call a function to check if it can be cleared
										clearTimeout(this.checkLockStateTimer);
										this.checkLockStateTimer = this.homey.setTimeout(this.checkLockSate, (60 * 30000));
									}
								}
							}
							else if (deviceState.name === 'core:PriorityLockTimerState')
							{
								if (this.hasCapability('lock_state') && (deviceState.value))
								{
									this.homey.app.logStates(`${this.getName()}: core:PriorityLockTimerState = ${deviceState.value}`);
									if ((deviceState.value === '0') || (deviceState.value === 0))
									{
										this.setCapabilityValue('lock_state', '').catch(this.error);
										if (this.driver.triggerLockStateChange)
										{
											const tokens = {
												lock_state: '',
											};
											this.driver.triggerLockStateChange(this, tokens);
										}
									}
									else if (this.checkLockSate)
									{
										clearTimeout(this.checkLockStateTimer);
										this.checkLockStateTimer = this.homey.setTimeout(this.checkLockSate, (60 * parseInt(deviceState.value, 10)));
									}
								}
							}
							else if (deviceState.name === this.positionStateName)
							{
								// Check for more message that are the same
								if (!this.checkForDuplicatesEvents(events, i, x + 1, myURL, this.positionStateName))
								{
									// Device position
									let closureStateValue = parseInt(deviceState.value, 10);
									this.homey.app.logStates(`${this.getName()}: ${this.positionStateName} = ${closureStateValue}`);

									if (this.invertPosition)
									{
										closureStateValue = 100 - closureStateValue;
									}

									this.triggerCapabilityListener('windowcoverings_set', 1 - (closureStateValue / 100),
									{
										fromCloudSync: true,
									}).catch(this.error);

									if ((closureStateValue !== 0) && (closureStateValue !== 100))
									{
										// Not fully open or closed
										this.triggerCapabilityListener('windowcoverings_state', 'idle',
										{
											fromCloudSync: true,
										}).catch(this.error);

										lastPosition = closureStateValue;
									}
									else
									{
										lastPosition = null;
									}
								}
							}
							else if (deviceState.name === this.openClosedStateName)
							{
								// Check for more message that are the same
								if (!this.checkForDuplicatesEvents(events, i, x + 1, myURL, this.openClosedStateName))
								{
									// Device Open / Closed state. Only process if the last position was 0 or 100
									if (lastPosition === null)
									{
										let openClosedStateValue = deviceState.value;
										this.homey.app.logStates(`${this.getName()}: ${this.openClosedStateName} = ${openClosedStateValue}`);

										// Convert Tahoma states to Homey equivalent
										openClosedStateValue = this.windowcoveringsStatesMap[openClosedStateValue];

										this.triggerCapabilityListener('windowcoverings_state', openClosedStateValue,
										{
											fromCloudSync: true,
										}).catch(this.error);
									}

									lastPosition = null;
								}
							}
							else if (deviceState.name === 'core:SlateOrientationState')
							{
								// Device tilt position
								// Check for more message that are the same
								if (!this.checkForDuplicatesEvents(events, i, x + 1, myURL, 'core:SlateOrientationState'))
								{
									const tiltStateValue = parseInt(deviceState.value, 10);
									this.homey.app.logStates(`${this.getName()}: core:SlateOrientationState = ${tiltStateValue}`);

									this.triggerCapabilityListener('windowcoverings_tilt_set', 1 - (tiltStateValue / 100),
									{
										fromCloudSync: true,
									}).catch(this.error);
								}
							}
							else if (deviceState.name === 'core:BatteryState')
							{
								// Device tilt position
								// Check for more message that are the same
								if (!this.checkForDuplicatesEvents(events, i, x + 1, myURL, 'core:BatteryState'))
								{
									const batteryStateValue = deviceState.value;
									this.homey.app.logStates(`${this.getName()}: core:BatteryState = ${batteryStateValue}`);
									const batteryStates = ['verylow', 'low', 'normal', 'full'];
									const batteryLevel = batteryStates.findIndex((state) => state === batteryStateValue);
									if (batteryLevel >= 0)
									{
										this.triggerCapabilityListener('measure_battery', ((batteryLevel * 100) / 3),
										{
											fromCloudSync: true,
										}).catch(this.error);
									}
								}
							}
							else if (deviceState.name === 'core:ActivatedOptionsState')
							{
								// Check for more message that are the same
								if (!this.checkForDuplicatesEvents(events, i, x + 1, myURL, 'core:ActivatedOptionsState'))
								{
									const silentStateValue = deviceState.value;
									this.homey.app.logStates(`${this.getName()}: core:ActivatedOptionsState = ${silentStateValue}`);
									if (!this.hasCapability('quiet_mode'))
									{
										await this.addCapability('quiet_mode');
									}
									this.triggerCapabilityListener('quiet_mode', silentStateValue.includes('silence'),
									{
										fromCloudSync: true,
									}).catch(this.error);
								}
							}
						}
					}
				}
				else if (element.name === 'ExecutionRegisteredEvent')
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

								this.lastCommandFailed = false;

								if (!local && this.boostSync)
								{
									if (!await this.homey.app.boostSync())
									{
										this.executionId = null;
										this.executionCmd = '';
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

							if (this.clearStateTimer && ((this.executionCmd === 'up') || (this.executionCmd === 'down') || (this.executionCmd === 'idle') || (this.executionCmd === 'close') || (this.executionCmd === 'open')) && !this.openClosedStateName)
							{
								clearTimeout(this.clearStateTimer);
								this.clearStateTimer = null;
								this.setCapabilityValue('windowcoverings_state', null).catch(this.error);
							}

							this.homey.app.triggerCommandComplete(this, this.executionCmd, (element.newState === 'COMPLETED'));
							this.driver.triggerDeviceCommandComplete(this, this.executionCmd, (element.newState === 'COMPLETED'));
							this.executionId = null;
							this.executionCmd = '';
							this.lastCommandFailed = (element.newState === 'FAILED');
						}
					}
				}
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

	async waitForActionToFinish(timeout)
	{
		let retries = timeout;
		while ((this.executionId !== null) && (retries-- > 0))
		{
			await this.homey.app.asyncDelay(1000);
		}

		if (this.lastCommandFailed)
		{
			throw new Error('Command failed');
		}

		if (retries <= 0)
		{
			throw new Error('Timeout waiting for action to finish');
		}
	}

}

module.exports = WindowCoveringsDevice;
