/* jslint node: true */

'use strict';

const Device = require('../Device');

/**
 * Device class for a light controller
 * @extends {Device}
 */

class ColorLightControllerDevice extends Device
{

	async onInit()
	{
		this.commandExecuting = '';

		this.lightState = {
			off: false,
			on: true,
		};

		this.lastRed = 0;
		this.lastGreen = 0;
		this.lastBlue = 0;
		this.lastDim = 0;
		this.updateHSL = false;

		this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
		this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
		this.registerMultipleCapabilityListener(['light_hue', 'light_saturation'], this.onCapabilityHueSat.bind(this), 500);

		await super.onInit();

		this.boostSync = true;
	}

	onAdded()
	{
		this.log('device added');
		this.getStates();
	}

	async onCapabilityOnOff(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			if (this.commandExecuting === 'onOff')
			{
				// This command is still processing
				return;
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
				this.executionCmd = '';
				this.executionId = null;
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
			this.commandExecuting = 'onOff';
			this.executionCmd = action.name;
			this.executionId = { id: result.execId, local: result.local };
		}
		else
		{
			this.setCapabilityValue('onoff', (value === true)).catch(this.error);
		}
	}

	async onCapabilityDim(value, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			if (this.commandExecuting === 'setIntensity')
			{
				// This command is still processing
				return;
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
				this.executionCmd = '';
				this.executionId = null;
			}

			const action = {
				name: 'setIntensity',
				parameters: [value * 100],
			};
			const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
			this.commandExecuting = 'setIntensity';
			this.executionCmd = action.name;
			this.executionId = { id: result.execId, local: result.local };
		}
		else
		{
			this.setCapabilityValue('dim', value / 100).catch(this.error);
		}
	}

	async onCapabilityHueSat(capabilityValues, opts)
	{
		if (!opts || !opts.fromCloudSync)
		{
			if (this.commandExecuting === 'setRGB')
			{
				// This command is still processing
				return;
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

			const rgb = this.hslToRgb(capabilityValues.light_hue, capabilityValues.light_saturation, 0.5);
			const action = {
				name: 'setRGB',
				parameters: [rgb[0], rgb[1], rgb[2]],
			};
			const result = await this.homey.app.executeDeviceAction(deviceData.label, deviceData.deviceURL, action, this.boostSync);
			this.commandExecuting = 'setRGB';
			this.executionCmd = action.name;
			this.executionId = { id: result.execId, local: result.local };
		}
		else
		{
			// this.setCapabilityValue('light_hue', value).catch(this.error);
		}
	}

	/**
	 * Gets the data from the TaHoma cloud
	 */
	async sync()
	{
		try
		{
			let states = await super.getStates();
			if (states)
			{
				// Hue level
				const redState = states.find((state) => (state && (state.name === 'core:RedColorIntensityState')));
				const blueState = states.find((state) => (state && (state.name === 'core:BlueColorIntensityState')));
				const greenState = states.find((state) => (state && (state.name === 'core:GreenColorIntensityState')));
				if (redState && blueState && greenState)
				{
					// Convert RGB to HSL
					const hsl = this.rgbToHsl(redState.value, greenState.value, blueState.value);
					this.homey.app.logStates(`${this.getName()}: core:RedColorIntensityState = ${redState.value}`);
					this.homey.app.logStates(`${this.getName()}: core:GreenColorIntensityState = ${greenState.value}`);
					this.homey.app.logStates(`${this.getName()}: core:BlueColorIntensityState = ${blueState.value}`);
					this.homey.app.logStates(`${this.getName()}: HSL = ${hsl}`);

					this.triggerCapabilityListener('light_hue', (hsl[0]),
					{
						fromCloudSync: true,
					}).catch(this.error);

					this.triggerCapabilityListener('light_saturation', (hsl[1] / 100),
					{
						fromCloudSync: true,
					}).catch(this.error);
				}

				const dimState = states.find((state) => (state && (state.name === 'core:LightIntensityState')));
				if (dimState)
				{
					this.triggerCapabilityListener('dim', dimState.value).catch(this.error);
				}

				states = null;
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

	// look for updates in the events array
	async syncEvents(events, local)
	{
		if (events === null)
		{
			return this.getStates();
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
			if (element.name === 'DeviceStateChangedEvent')
			{
				if ((element.deviceURL === myURL) && Array.isArray(element.deviceStates))
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
						if (this.checkForDuplicatesEvents(events, i, x + 1, myURL, deviceState.name))
						{
							break;
						}
						await this.processEventState(deviceState);
					}
				}
			}
			else if (element.name === 'ExecutionRegisteredEvent')
			{
				if (!Array.isArray(element.actions))
				{
					continue;
				}
				for (let x = 0; x < element.actions.length; x++)
				{
					if (myURL === element.actions[x].deviceURL)
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
							await this.homey.app.boostSync();
							this.commandExecuting = '';
							this.executionId = null;
							this.executionCmd = '';
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

		if (this.updateHSL)
		{
			this.updateHSL = false;
			const hsl = this.rgbToHsl(this.lastRed, this.lastGreen, this.lastBlue);
			this.triggerCapabilityListener('light_hue', (hsl[0]),
			{
				fromCloudSync: true,
			}).catch(this.error);

			this.triggerCapabilityListener('light_saturation', (hsl[1] / 100),
			{
				fromCloudSync: true,
			}).catch(this.error);
		}

		return myURL;
	}

	async processEventState(deviceState)
	{
		if (super.processEventState(deviceState))
		{
			return true;
		}

		if (deviceState.name === 'core:RedColorIntensityState')
		{
			this.homey.app.logStates(`${this.getName()}: core:RedColorIntensityState = ${deviceState.value}`);
			this.lastRed = parseInt(deviceState.value, 10);
			this.updateHSL = true;
			return true;
		}

		if (deviceState.name === 'core:GreenColorIntensityState')
		{
			this.homey.app.logStates(`${this.getName()}: core:GreenColorIntensityState = ${deviceState.value}`);
			this.lastGreen = parseInt(deviceState.value, 10);
			this.updateHSL = true;
			return true;
		}

		if (deviceState.name === 'core:BlueColorIntensityState')
		{
			this.homey.app.logStates(`${this.getName()}: core:BlueColorIntensityState = ${deviceState.value}`);
			this.lastBlue = parseInt(deviceState.value, 10);
			this.updateHSL = true;
			return true;
		}

		if (deviceState.name === 'core:LightIntensityState')
		{
			this.homey.app.logStates(`${this.getName()}: core:LightIntensityState = ${deviceState.value}`);
			this.lastDim = (parseInt(deviceState.value, 10) / 100);
			this.triggerCapabilityListener('dim', this.lastDim,
			{
				fromCloudSync: true,
			}).catch(this.error);
			return true;
		}

		return false;
	}

	hslToRgb(h, s, l)
	{
		h *= 360;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		let r = 0;
		let g = 0;
		let b = 0;

		if (h >= 0 && h < 60)
		{
			r = c;
			g = x;
			b = 0;
		}
		else if (h >= 60 && h < 120)
		{
			r = x;
			g = c;
			b = 0;
		}
		else if (h >= 120 && h < 180)
		{
			r = 0;
			g = c;
			b = x;
		}
		else if (h >= 180 && h < 240)
		{
			r = 0;
			g = x;
			b = c;
		}
		else if (h >= 240 && h < 300)
		{
			r = x;
			g = 0;
			b = c;
		}
		else if (h >= 300 && h < 360)
		{
			r = c;
			g = 0;
			b = x;
		}
		r = Math.round((r + m) * 255);
		g = Math.round((g + m) * 255);
		b = Math.round((b + m) * 255);

		return [r, g, b];
	}

	rgbToHsl(r, g, b)
	{
		// Make r, g, and b fractions of 1
		r /= 255;
		g /= 255;
		b /= 255;

		// Find greatest and smallest channel values
		const cMin = Math.min(r, g, b);
		const cMax = Math.max(r, g, b);
		const delta = cMax - cMin;
		let h = 0;
		let s = 0;
		let l = 0;
		// Calculate hue
		// No difference
		if (delta === 0)
		{
			h = 0;
		}
		// Red is max
		else if (cMax === r)
		{
			h = ((g - b) / delta) % 6;
		}
		// Green is max
		else if (cMax === g)
		{
			h = (b - r) / delta + 2;
		}
		// Blue is max
		else
		{
			h = (r - g) / delta + 4;
		}

		h = Math.round(h * 60);

		// Make negative hues positive behind 360°
		if (h < 0)
		{
			h += 360;
		}

		// Calculate lightness
		l = (cMax + cMin) / 2;

		// Calculate saturation
		s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

		// Multiply l and s by 100
		s = +(s * 100).toFixed(1);
		l = +(l * 100).toFixed(1);

		return [h, s, l];
	}

}

module.exports = ColorLightControllerDevice;
