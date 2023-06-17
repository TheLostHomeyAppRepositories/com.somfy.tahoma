/* eslint-disable max-len */
/* jslint node: true */

'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9223, '0.0.0.0', true);
}

const Homey = require('homey');
const nodemailer = require('nodemailer');
const Tahoma = require('./lib/Tahoma');

const LOCAL_INTERVAL = 3;
const CLOUD_INTERVAL = 30;
class myApp extends Homey.App
{

    /**
     * Initializes the app
     */
    async onInit()
    {
        this.log(`${Homey.manifest.id} running...`);

        this.syncing = false;
        this.syncTimerId = null;
        this.loginTimerId = null;
        this.boostTimerId = null;
        this.unBoostTimerID = null;
        this.unBoosting = false;
        this.commandsQueued = 0;
        this.lastSync = 0;
        this.lastLogTime = new Date(Date.now());

        this.localBridgeInfo = this.homey.settings.get('localBridge');
        this.localBearer = this.homey.settings.get('localBearer');
        this.usingDebugData = false;

        if (process.env.DEBUG === '1')
        {
            this.homey.settings.set('debugMode', true);
            const simData = this.homey.settings.get('simData');
            if (simData)
            {
                this.usingDebugData = true;
            }
        }
        else
        {
            this.homey.settings.set('debugMode', false);
        }

        this.syncLoop = this.syncLoop.bind(this);
        this.homey.settings.unset('errorLog'); // Clean out obsolete entry
        this.homey.settings.unset('diagLog');
        this.homey.settings.unset('logEnabled');

        this.homey.settings.set('deviceLog', '');
        this.homey.settings.set('infoLog', '');
        this.homey.settings.set('statusLogEnabled', false);
        this.homey.settings.set('statusLog', '');

        this.homeyHash = await this.homey.cloud.getHomeyId();
        this.homeyHash = this.hashCode(this.homeyHash).toString();

        this.infoLogEnabled = this.homey.settings.get('infoLogEnabled');
        if (this.infoLogEnabled === null)
        {
            this.infoLogEnabled = false;
            this.homey.settings.set('infoLogEnabled', this.infoLogEnabled);
        }

        this.eventLogEnabled = this.homey.settings.get('eventLogEnabled');
        if (this.eventLogEnabled === null)
        {
            this.eventLogEnabled = false;
            this.homey.settings.set('eventLogEnabled', this.eventLogEnabled);
        }

        process.on('unhandledRejection', (reason, promise) =>
        {
            this.log('Unhandled Rejection at:', promise, 'reason:', reason);
            this.logInformation('Unhandled Rejection',
            {
                message: promise,
                stack: reason,
            });
        });

        this.homey.on('unload', async () =>
        {
            await this.logOut(false);
        });

        this.homey.settings.on('set', (setting) =>
        {
            if (setting === 'infoLogEnabled')
            {
                this.infoLogEnabled = this.homey.settings.get('infoLogEnabled');
            }
            else if (setting === 'eventLogEnabled')
            {
                this.eventLogEnabled = this.homey.settings.get('eventLogEnabled');
            }
            else if (setting === 'simData')
            {
                const simData = this.homey.settings.get('simData');
                if (simData)
                {
                    this.usingDebugData = true;
                }
                else
                {
                    this.usingDebugData = false;
                }

                this.syncEvents(null);
            }
        });

        try
        {
            this.homeyIP = await this.homey.cloud.getLocalAddress();
            if (this.homeyIP)
            {
                this.tahomaLocal = new Tahoma(this.homey, true);
            }
        }
        catch (err)
        {
            // Homey cloud or Bridge so no LAN access
            this.tahomaLocal = null;
            this.homeyIP = null;

            // Enable logging for Homey cloud
            this.infoLogEnabled = true;
        }

        this.tahomaCloud = new Tahoma(this.homey, false);

        // Setup the flow listeners
        this.addScenarioActionListeners();
        this.addPollingSpeedActionListeners();
        this.addPollingActionListeners();

        /** * TEMPERATURE CONDITIONS ** */
        this._conditionTemperatureMoreThan = this.homey.flow.getConditionCard('has_temperature_more_than');
        this._conditionTemperatureMoreThan.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = device.getState().measure_temperature > args.temperature;
            return Promise.resolve(conditionMet);
        });

        this._conditionTemperatureLessThan = this.homey.flow.getConditionCard('has_temperature_less_than');
        this._conditionTemperatureLessThan.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = device.getState().measure_temperature < args.temperature;
            return Promise.resolve(conditionMet);
        });

        this._conditionTemperatureBetween = this.homey.flow.getConditionCard('has_temperature_between');
        this._conditionTemperatureBetween.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = device.getState().measure_temperature > args.temperature_from && device.getState().measure_temperature < args.temperature_to;
            return Promise.resolve(conditionMet);
        });

        /** * LUMINANCE CONDITIONS ** */
        this._conditionLuminanceMoreThan = this.homey.flow.getConditionCard('has_luminance_more_than');
        this._conditionLuminanceMoreThan.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = device.getState().measure_luminance > args.luminance;
            return Promise.resolve(conditionMet);
        });

        this._conditionLuminanceLessThan = this.homey.flow.getConditionCard('has_luminance_less_than');
        this._conditionLuminanceLessThan.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = device.getState().measure_luminance < args.luminance;
            return Promise.resolve(conditionMet);
        });

        this._conditionLuminanceBetween = this.homey.flow.getConditionCard('has_luminance_between');
        this._conditionLuminanceBetween.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = device.getState().measure_luminance > args.luminance_from && device.getState().measure_luminance < args.luminance_to;
            return Promise.resolve(conditionMet);
        });

        /** * IS MOVING CONDITION ** */
        this._conditionIsMoving = this.homey.flow.getConditionCard('is_moving');
        this._conditionIsMoving.registerRunListener((args) =>
        {
            const { device } = args;
            const conditionMet = (device.executionId !== null);
            return Promise.resolve(conditionMet);
        });

        /** * COMMAND COMPLETE TRIGGER ** */
        this.commandCompleteTrigger = this.homey.flow.getTriggerCard('command_complete');
        this.commandCompleteTrigger
            .registerRunListener(async (args, state) =>
            {
                return (args.device.getAppId() === state.device.appId);
            });

        this.registerActionFlowCards();

        this.syncTimerId = this.homey.setTimeout(() => this.initSync(), 30000);

        this.discoveryStrategy = this.homey.discovery.getStrategy('somfy_tahoma');
        this.discoveryStrategy.on('result', (discoveryResult) =>
        {
            if (this.infoLogEnabled)
            {
                this.logInformation('mDNS: Got mDNS result', this.varToString(discoveryResult));
            }
            this.mDNSBridgesUpdate(discoveryResult);
        });

        const results = this.discoveryStrategy.getDiscoveryResults();
        for (const result of Object.values(results))
        {
            this.log('Got mDNS result:', this.varToString(result));
            this.mDNSBridgesUpdate(result);
        }

        this.log(`${Homey.manifest.id} Initialised`);
    }

    async restartLogin()
    {
        try
        {
            await this.logOut(false);
            const username = this.homey.settings.get('username');
            const password = this.homey.settings.get('password');
            const region = this.homey.settings.get('region');

            if (!await this.doLocalLogin(username, password, region))
            {
                this.discoveryStrategy = this.homey.discovery.getStrategy('somfy_tahoma');
                this.discoveryStrategy.on('result', (discoveryResult) =>
                {
                    if (this.infoLogEnabled)
                    {
                        this.logInformation('mDNS: Got mDNS result', this.varToString(discoveryResult));
                    }
                    this.mDNSBridgesUpdate(discoveryResult);
                });

                const results = this.discoveryStrategy.getDiscoveryResults();
                for (const result of Object.values(results))
                {
                    if (this.infoLogEnabled)
                    {
                        this.logInformation('Got mDNS result', this.varToString(result));
                    }
                    this.mDNSBridgesUpdate(result);
                }
            }

            this.syncTimerId = this.homey.setTimeout(() => this.initSync(), 10000);
        }
        catch (err)
        {
            this.logInformation('Restart login failed', err.message);
        }
    }

    async mDNSBridgesUpdate(discoveryResult)
    {
        if (!discoveryResult.txt)
        {
            this.logInformation('mDNS', 'No txt field in discovery');
            return;
        }

        this.localBridgeInfo = {
            pin: discoveryResult.txt.gateway_pin,
            address: discoveryResult.address,
            url: discoveryResult.fullname,
            port: discoveryResult.port,
            api_version: discoveryResult.txt.api_version,
            fw_version: discoveryResult.txt.fw_version,
        };

        if (!this.localBridgeInfo.pin)
        {
            this.logInformation('mDNS', 'No local pin discovered');
            return;
        }

        if (this.syncTimerId)
        {
            this.homey.clearTimeout(this.syncTimerId);
            this.syncTimerId = null;
        }

        this.homey.settings.set('localBridge', this.localBridgeInfo);
        this.logInformation('mDNS Found a local bridge',
        {
            pin: '####-####-####',
            address: this.localBridgeInfo.address,
            port: this.localBridgeInfo.port,
            api_version: this.localBridgeInfo.api_version,
            fw_version: this.localBridgeInfo.fw_version,
        });

        const username = this.homey.settings.get('username');
        const password = this.homey.settings.get('password');
        let region = this.homey.settings.get('region');
        if (!region && username && password)
        {
            region = 'europe';
            this.homey.settings.set('region', region);
        }

        try
        {
            await this.doLocalLogin(username, password, region);
        }
        catch (err)
        {
            this.logInformation('Local login failed', err.message);
        }

        this.syncTimerId = this.homey.setTimeout(() => this.initSync(), 5000);
    }

    async doLocalLogin(username, password, region)
    {
        if (this.tahomaLocal === null)
        {
            return false;
        }

        if (username && password && this.localBridgeInfo)
        {
            if (this.infoLogEnabled)
            {
                this.logInformation('Doing local login');
            }

            this.localBearer = await this.tahomaLocal.getLocalAuthCode(username, password, region, this.localBridgeInfo.pin, this.localBridgeInfo.port, this.localBearer, await this.homey.cloud.getHomeyId());
        }
        else
        {
            if (this.localBridgeInfo)
            {
                this.logInformation('Local login', 'Missing credentials');
            }
            else
            {
                this.logInformation('Local login', 'No local bridge detected yet');
            }
            return false;
        }

        if (this.localBearer)
        {
            // Login was successful
            this.homey.settings.set('username', username);
            this.homey.settings.set('password', password);
            this.homey.settings.set('region', region);
            this.homey.settings.set('localBearer', this.localBearer);

            try
            {
                if (this.infoLogEnabled)
                {
                    const apiVer = await this.tahomaLocal.getLocalAPIVersion();
                    this.logInformation('Local login', apiVer);
                }
                await this.tahomaLocal.getDeviceData();
            }
            catch (error)
            {
                if (error.message)
                {
                    this.logInformation('Local login', `Error: ${error.message}`);
                }
                else
                {
                    this.logInformation('Local login', error);
                }
            }

            return true;
        }

        this.logInformation('No local Bearer token');
        return false;
    }

    async getLocalTokens()
    {
        if (!this.localBridgeInfo)
        {
            throw new Error('No Somfy bridges have been detected.\n'
                            + 'Make sure the Developer mode has been enabled on you Somfy account.\n'
                            + 'The Somfy bridge should broadcast it\'s IP and PIN via mDNS once the option is enabled.');
        }
        try
        {
            const tokens = await this.tahomaCloud.getLocalTokens(this.localBridgeInfo.pin);
            return this.varToString(tokens);
        }
        catch (err)
        {
            this.logInformation('getLocalTokens failed', err.message);
            throw (err);
        }
    }

    async deleteLocalToken(uuid)
    {
        try
        {
            const tokens = await this.tahomaCloud.deleteLocalToken(this.localBridgeInfo.pin, uuid);
            return this.varToString(tokens);
        }
        catch (err)
        {
            this.logInformation('getLocalTokens failed', err.message);
            throw (err);
        }
    }

    onUninit()
    {
        // Log out but don't clear the credentials
        this.logOut(false);
    }

    registerActionFlowCards()
    {
        this.homey.flow.getActionCard('absence_heating_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('absence_heating_temperature_set');
                await args.device.onCapabilityTargetTemperatureEco(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.absence_cooling', args.target_temperature);
            });

        this.homey.flow.getActionCard('cancel_absence_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('cancel_absence_set');
                await args.device.onCapabilityBoilerMode(args.state, null);
            });

        this.homey.flow.getActionCard('set_auto_heat_cool')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_auto_heat_cool');
                await args.device.onCapabilityBoostState(args.state, null);
                return args.device.setCapabilityValue('heating_cooling_auto_switch', args.state);
            });

        this.homey.flow.getActionCard('set_pac_operating_mode')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_pac_operating_mode');
                await args.device.onCapabilityBoostState(args.state, null);
                return args.device.setCapabilityValue('pass_apc_operating_mode', args.state);
            });

        this.homey.flow.getActionCard('eco_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('eco_temperature_set');
                await args.device.onCapabilityTargetTemperatureEco(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.eco', args.target_temperature);
            });

        this.homey.flow.getActionCard('comfort_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('comfort_temperature_set');
                await args.device.onCapabilityTargetTemperatureComfort(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.comfort', args.target_temperature);
            });

        this.homey.flow.getActionCard('boiler_mode_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('boiler_mode_set');
                await args.device.onCapabilityBoilerMode(args.state, null);
                return args.device.setCapabilityValue('boiler_mode', args.state);
            });

        this.homey.flow.getActionCard('boost_on_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('boost_on_off');
                await args.device.onCapabilityBoostState(args.state, null);
                return args.device.setCapabilityValue('boost', args.state);
            });

        this.homey.flow.getActionCard('calendar_state_on')
            .registerRunListener(async (args, state) =>
            {
                this.log('calendar_state_on');
                return args.device.triggerCapabilityListener('calendar_state_on', true, null);
            });

        this.homey.flow.getActionCard('calendar_state_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('calendar_state_off');
                return args.device.triggerCapabilityListener('calendar_state_off', true, null);
            });

        this.homey.flow.getActionCard('windowcoverings_tilt')
            .registerRunListener(async (args, state) =>
            {
                this.log('windowcoverings_tilt');
                return args.device.onCapabilityWindowcoveringsTiltSet(args.windowcoverings_set, null);
            });

        this.homey.flow.getActionCard('set_quiet_mode')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_quiet_mode');
                await args.device.onCapabilityQuietMode(args.newQuietMode === 'on', null);
                return args.device.setCapabilityValue('quiet_mode', args.newQuietMode === 'on');
            });

        this.homey.flow.getActionCard('set_my_position')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_my_position');
                return args.device.onCapabilityMyPosition(true, null);
            });

        this.homey.flow.getActionCard('set_my_heat_level')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_my_heat_level');
                return args.device.triggerCapabilityListener('my_heat_level', true, null);
            });

        this.homey.flow.getActionCard('set_heat_level')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_heat_level');
                return args.device.triggerCapabilityListener('heat_level', args.heat_level, null);
            });

        this.homey.flow.getActionCard('set_on')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_on');
                return args.device.triggerCapabilityListener('on_button', true, null);
            });

        this.homey.flow.getActionCard('set_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_off');
                return args.device.triggerCapabilityListener('off_button', true, null);
            });

        this.homey.flow.getActionCard('set_open_window_activation')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_open_window_activation');
                return args.device.triggerCapabilityListener('open_window_activation', args.open_window_activation === 'on', null);
            });

        this.homey.flow.getActionCard('set_valve_auto_mode')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_valve_auto_mode');
                return args.device.triggerCapabilityListener('valve_auto_mode', args.set_valve_auto === 'on', null);
            });

        this.homey.flow.getActionCard('set_derogation_mode')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_derogation_mode');
                await args.device.setCapabilityValue('derogation_type', args.type);
                return args.device.triggerCapabilityListener('derogation_mode', args.derogation_mode, null);
            });

        this.homey.flow.getActionCard('set_open_close_stop')
            .registerRunListener(async (args, state) =>
            {
                this.log('open_close_stop');
                return args.device.sendOpenCloseStop(args.state, null);
            });

        this.homey.flow.getActionCard('start_siren')
            .registerRunListener(async (args, state) =>
            {
                this.log('start_siren');
                return args.device.triggerCapabilityListener('ring_button', null);
            });

        this.homey.flow.getActionCard('sound_alarm1')
            .registerRunListener(async (args, state) =>
            {
                this.log('sound_alarm1');
                const parameters = [args.duration * 1000, args.on_off_ratio, args.repeats - 1, args.volume];
                return args.device.triggerCapabilityListener('soundAlarm_1_button', null, parameters);
            });

        this.homey.flow.getActionCard('stop_siren')
            .registerRunListener(async (args, state) =>
            {
                this.log('stop_siren');
                return args.device.triggerCapabilityListener('stop_button', null);
            });

        this.homey.flow.getActionCard('trigger_tahoma_alarm')
            .registerRunListener(async (args, state) =>
            {
                this.log('trigger_tahoma_alarm');
                return args.device.triggerAlarmAction(args.state);
            });

        this.homey.flow.getActionCard('set_on_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_on_off');
                return args.device.sendOnOff(args.state === 'on', null);
            });

        this.homey.flow.getActionCard('set_on_with_timer')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_on_with_timer');
                return args.device.sendOnWithTimer(args.onTime, null);
            });

        this.homey.flow.getActionCard('eco_cooling_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('eco_cooling_temperature_set');
                await args.device.onCapabilityTargetTemperatureEcoCooling(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.eco_cooling', args.target_temperature);
            });

        this.homey.flow.getActionCard('eco_heating_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('eco_heating_temperature_set');
                await args.device.onCapabilityTargetTemperatureEcoHeating(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.eco_heating', args.target_temperature);
            });

        this.homey.flow.getActionCard('comfort_cooling_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('comfort_cooling_temperature_set');
                await args.device.onCapabilityTargetTemperatureComfortCooling(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.comfort_cooling', args.target_temperature);
            });

        this.homey.flow.getActionCard('comfort_heating_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('comfort_heating_temperature_set');
                await args.device.onCapabilityTargetTemperatureComfortHeating(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.comfort_heating', args.target_temperature);
            });

        this.homey.flow.getActionCard('derogation_temperature_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('derogation_temperature_set');
                await args.device.onCapabilityTargetTemperatureDerogated(args.target_temperature, null);
                return args.device.setCapabilityValue('target_temperature.derogated', args.target_temperature);
            });

        this.homey.flow.getActionCard('cooling_on_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('cooling_on_off');
                await args.device.onCapabilityOnOffCooling(args.state, null);
                return args.device.setCapabilityValue('boost.cooling', args.state === 'on');
            });

        this.homey.flow.getActionCard('heating_on_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('heating_on_off');
                await args.device.onCapabilityOnOffHeating(args.state, null);
                return args.device.setCapabilityValue('boost.heating', args.state === 'on');
            });

        this.homey.flow.getActionCard('derogation_on_off')
            .registerRunListener(async (args, state) =>
            {
                this.log('derogation_on_off');
                await args.device.onCapabilityOnOffDerogated(args.state, null);
                return args.device.setCapabilityValue('boost.derogated', args.state === 'on');
            });

        this.homey.flow.getActionCard('cool_mode_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('cool_mode_set');
                await args.device.onCapabilityHeatCoolModeCool(args.state, null);
                return args.device.setCapabilityValue('heat_cool_mode.cool', args.state);
            });

        this.homey.flow.getActionCard('heat_mode_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('heat_mode_set');
                await args.device.onCapabilityHeatCoolModeHeat(args.state, null);
                return args.device.setCapabilityValue('heat_cool_mode.heat', args.state);
            });

        this.homey.flow.getActionCard('set_heating_mode')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_heating_mode');
                await args.device.onCapabilityHeatingModeState(args.state, null);
                return args.device.setCapabilityValue('heating_mode', args.state);
            });

        this.homey.flow.getActionCard('set_heating_level2_state')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_heating_level2_state');
                return args.device.triggerCapabilityListener('heating_level2_state', args.state);
            });

        this.homey.flow.getActionCard('windowcoverings_upper_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('windowcoverings_set.upper');
                return args.device.triggerCapabilityListener('windowcoverings_set.upper', args.windowcoverings_set);
            });

        this.homey.flow.getActionCard('windowcoverings_lower_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('windowcoverings_set.lower');
                return args.device.triggerCapabilityListener('windowcoverings_set.lower', args.windowcoverings_set);
            });

        this.homey.flow.getActionCard('set_pedestrian')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_open');
                return args.device.triggerCapabilityListener('pedestrian');
            });

        this.homey.flow.getActionCard('set_open')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_open');
                return args.device.triggerCapabilityListener('open_button');
            });

        this.homey.flow.getActionCard('set_close')
            .registerRunListener(async (args, state) =>
            {
                this.log('set_open');
                return args.device.triggerCapabilityListener('close_button');
            });

        this.homey.flow.getActionCard('target_temperature_manual_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('target_temperature_manual_set');
                return args.device.triggerCapabilityListener('target_temperature.manual', args.target_temperature, { derogation_type: args.derogation_type });
            });

        this.homey.flow.getActionCard('target_temperature_manual_set_for')
            .registerRunListener(async (args, state) =>
            {
                this.log('target_temperature_manual_set_for');

                const duration = (args.days * 86400) + (args.hours * 3600) + (args.minutes * 60);
                return args.device.triggerCapabilityListener('target_temperature.manual', args.target_temperature, { derogation_type: duration });
            });

        this.homey.flow.getActionCard('target_temperature_comfort_heating_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('target_temperature_comfort_heating_set');
                return args.device.triggerCapabilityListener('target_temperature.comfort_heating', args.target_temperature);
            });

        this.homey.flow.getActionCard('target_temperature_eco_heating_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('target_temperature_eco_heating_set');
                return args.device.triggerCapabilityListener('target_temperature.eco_heating', args.target_temperature);
            });

        this.homey.flow.getActionCard('target_temperature_away_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('target_temperature_away_set');
                return args.device.triggerCapabilityListener('target_temperature.away', args.target_temperature);
            });

        this.homey.flow.getActionCard('target_temperature_frost_protection_set')
            .registerRunListener(async (args, state) =>
            {
                this.log('target_temperature_frost_protection_set');
                return args.device.triggerCapabilityListener('target_temperature.frost_protection', args.target_temperature);
            });
    }

    hashCode(s)
    {
        let h = 0;
        for (let i = 0; i < s.length; i++)
        {
            h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        }
        return h;
    }

    // Throws an exception if the login fails
    async newLogin(args)
    {
        await this.newLogin_2(args.username, args.password, args.region);
    }

    // Throws an exception if the login fails
    async newLogin_2(username, password, region)
    {
        // Stop the timer so periodic updates don't happen while changing login
        await this.stopSync();
        if (this.loginTimerId)
        {
            this.homey.clearTimeout(this.loginTimerId);
            this.loginTimerId = null;
        }

        if (this.localBridgeInfo && this.localBridgeInfo.pin)
        {
            try
            {
                // Need to get a local bearer token
                await this.doLocalLogin(username, password, region);
            }
            catch (error)
            {
                if (error.message)
                {
                    this.logInformation('Login doLocal', `Error: ${error.message}`);
                }
                else
                {
                    this.logInformation('Login doLocal', error);
                }
            }
        }

        // make sure we logout from old method first
        await this.tahomaCloud.logout();

        // Allow a short delay before logging back in
        await new Promise((resolve) => this.homey.setTimeout(resolve, 1000));

        let loginMethod = true; // Start with new method

        // Login with supplied credentials. An error is thrown if the login fails
        try
        {
            await this.tahomaCloud.login(username, password, region, loginMethod, this.homeyIP);
        }
        catch (error)
        {
            if (error.message)
            {
                this.logInformation('Login OAuth', `Error: ${error.message}`);
            }
            else
            {
                this.logInformation('Login OAuth', error);
            }

            // Try other log in method
            loginMethod = !loginMethod;
        }

        if (!this.tahomaCloud.authenticated)
        {
            // Try once more with the alternative method but let an error break us out of here
            await this.tahomaCloud.login(username, password, region, loginMethod, this.homeyIP);
        }

        if (this.tahomaCloud.authenticated)
        {
            // All good so save the credentials
            this.homey.settings.set('username', username);
            this.homey.settings.set('password', password);
            this.homey.settings.set('region', region);

            const setupInfo = await this.tahomaCloud.getSetupOID();
            this.somfySetupOID = setupInfo.result;

            this.startSync();
        }
        return this.tahomaCloud.authenticated;
    }

    async logOut(ClearCredentials = true)
    {
        if (this.unBoostTimerID)
        {
            this.homey.clearTimeout(this.unBoostTimerID);
            this.unBoostTimerID = null;
        }

        let maxLoops = 50;
        while (this.unBoosting && (maxLoops-- > 0))
        {
            await this.homey.app.asyncDelay(1000);
        }

        await this.stopSync();
        if (this.tahomaCloud)
        {
            await this.tahomaCloud.logout();
        }

        if (ClearCredentials)
        {
            this.homey.settings.unset('username');
            this.homey.settings.unset('password');
        }
        return true;
    }

    async logDevices()
    {
        if (this.infoLogEnabled)
        {
            this.logInformation('logDevices', 'Fetching devices');
        }

        const devices = { cloud: {}, local: { ip: this.localBridgeInfo ? this.localBridgeInfo.address : null } };
        let cloudDevices = null;
        let localDevices = null;
        if (this.tahomaCloud.authenticated)
        {
            cloudDevices = await this.tahomaCloud.getDeviceData();
        }
        if (this.tahomaLocal && this.tahomaLocal.authenticated)
        {
            localDevices = await this.tahomaLocal.getDeviceData();
        }

        if (cloudDevices && localDevices)
        {
            // Filter cloud devices to remove local devices
            const unique = cloudDevices.filter((cloud) =>
            {
                const isDuplicate = (localDevices.findIndex((local) => local.deviceURL === cloud.deviceURL) >= 0);

                if (!isDuplicate)
                {
                    return true;
                }

                return false;
            });

            devices.cloud.devices = unique;
            devices.local.devices = localDevices;
        }
        else
        {
            if (cloudDevices)
            {
                devices.cloud = cloudDevices;
            }
            if (localDevices)
            {
                devices.local = localDevices;
            }
        }

        // Do a deep copy
        const logData = JSON.parse(JSON.stringify(devices));

        if (devices && this.infoLogEnabled)
        {
            this.logInformation('logDevices', `Log contains ${devices.length} devices`);
        }

        if (this.homey.settings.get('debugMode'))
        {
            if (this.infoLogEnabled)
            {
                this.logInformation('logDevices', 'Debug Mode');
            }
        }
        else
        {
            // Remove personal device information
            if (logData.local.devices)
            {
                logData.local.devices.forEach((element) =>
                {
                    delete element.creationTime;
                    delete element.lastUpdateTime;
                    delete element.shortcut;
                    delete element.placeOID;
                });
            }

            if (logData.cloud.devices)
            {
                logData.cloud.devices.forEach((element) =>
                {
                    delete element.creationTime;
                    delete element.lastUpdateTime;
                    delete element.shortcut;
                    delete element.placeOID;
                });
            }
        }

        this.homey.settings.set('deviceLog',
        {
            devices: logData,
        });
    }

    logInformation(source, error)
    {
        let data = '';
        if (error)
        {
            data = this.varToString(error);
        }

        this.homey.error(`${source}, ${data}`);

        if (this.homeyIP)
        {
            try
            {
                if (error)
                {
                    if (error.stack)
                    {
                        data = {
                            message: error.message,
                            stack: error.stack,
                        };
                    }
                    else if (error.message)
                    {
                        data = error.message;
                    }
                    else
                    {
                        data = error;
                    }
                }

                let logData = this.homey.settings.get('infoLog');
                if (!Array.isArray(logData))
                {
                    logData = [];
                }

                // Calculate time since last log message
                const nowTime = new Date(Date.now());
                const timeDiff = (nowTime.getTime() - this.lastLogTime.getTime()) / 1000;
                this.lastLogTime = nowTime;

                logData.push(
                    {
                        time: nowTime.toJSON(),
                        elapsed: timeDiff,
                        source,
                        data,
                    },
                );

                if (logData && logData.length > 500)
                {
                    logData.splice(0, 1);
                }
                this.homey.settings.set('infoLog', logData);
            }
            catch (err)
            {
                this.log(err);
            }
        }
    }

    logStates(txt)
    {
        if (this.homey.settings.get('stateLogEnabled'))
        {
            const log = `${this.homey.settings.get('stateLog') + txt}\n`;
            if (log && (log.length > 30000))
            {
                this.homey.settings.set('stateLogEnabled', false);
            }
            else
            {
                this.homey.settings.set('stateLog', log);
            }
        }
    }

    logEvents(txt)
    {
        const nowTime = new Date(Date.now());
        let log = `${this.homey.settings.get('eventLog') + nowTime.toJSON()}\r\n${txt}\r\n`;
        if (log.length > 30000)
        {
            log = log.substring(log.length - 1000);
            const n = log.indexOf('\n');
            if (n >= 0)
            {
                // Remove up to and including the first \n so the log starts on a whole line
                log = log.substring(n + 1);
            }
        }
        this.homey.settings.set('eventLog', log);
    }

    async sendLog(logType)
    {
        let tries = 5;
        this.log('Send Log');
        while (tries-- > 0)
        {
            try
            {
                let subject = '';
                let text = '';
                if (logType === 'infoLog')
                {
                    subject = 'Tahoma Information log';
                    text = this.varToString(this.homey.settings.get('infoLog'));
                }
                else if (logType === 'deviceLog')
                {
                    subject = 'Tahoma device log';
                    text = this.varToString(this.homey.settings.get('deviceLog'));
                }
                else if (logType === 'eventLog')
                {
                    subject = 'Tahoma event log';
                    text = this.varToString(this.homey.settings.get('eventLog'));
                }

                subject += `(${this.homeyHash} : ${Homey.manifest.version})`;

                // create reusable transporter object using the default SMTP transport
                const transporter = nodemailer.createTransport(
                    {
                        host: Homey.env.MAIL_HOST, // Homey.env.MAIL_HOST,
                        port: 465,
                        ignoreTLS: false,
                        secure: true, // true for 465, false for other ports
                        auth:
                        {
                            user: Homey.env.MAIL_USER, // generated ethereal user
                            pass: Homey.env.MAIL_SECRET, // generated ethereal password
                        },
                        tls:
                        {
                            // do not fail on invalid certs
                            rejectUnauthorized: false,
                        },
                    },
                );

                // send mail with defined transport object
                const response = await transporter.sendMail(
                    {
                        from: `"Homey User" <${Homey.env.MAIL_USER}>`, // sender address
                        to: Homey.env.MAIL_RECIPIENT, // list of receivers
                        subject, // Subject line
                        text, // plain text body
                    },
                );

                return {
                    error: response.err,
                    message: response.err ? null : 'OK',
                };
            }
            catch (err)
            {
                this.logInformation('Send log error', err);
                return {
                    error: err,
                    message: null,
                };
            }
        }
        return {
            message: 'Failed 5 attempts',
        };
    }

    /**
     * Initializes synchronization between Homey and TaHoma
     * with the interval as defined in the settings.
     */
    async initSync()
    {
        const username = this.homey.settings.get('username');
        const password = this.homey.settings.get('password');
        const region = this.homey.settings.get('region');
       if (!username || !password)
        {
            return;
        }

        let timeout = 15000;

        try
        {
            if (this.infoLogEnabled)
            {
                this.logInformation('initSync', 'Starting');
            }

            await this.newLogin_2(username, password, region);
            return;
        }
        catch (error)
        {
            if (error.message)
            {
                this.logInformation('initSync', `Error: ${error.message}`);

                if (error.message.indexOf('Far Too many') >= 0)
                {
                    this.homey.clearTimeout(this.boostTimerId);
                    this.boostTimerId = null;
                    this.commandsQueued = 0;
                    timeout = this.homeyIP ? 910000 : 86410000;
                }
                else if (error.message === 'Please leave 1 minutes between login attempts')
                {
                    this.homey.clearTimeout(this.boostTimerId);
                    this.boostTimerId = null;
                    this.commandsQueued = 0;
                    timeout = 61000;
                }
            }
            else
            {
                this.logInformation('initSync', error);
            }
        }

        // Try again later
        this.loginTimerId = this.homey.setTimeout(() => this.initSync(), timeout);
    }

    // Boost the sync speed when a command is executed that has status feedback
    async boostSync()
    {
        if (this.tahomaCloud.authenticated)
        {
            if (this.unBoostTimerID)
            {
                this.homey.clearTimeout(this.unBoostTimerID);
                this.unBoostTimerID = null;
            }

            let maxLoops = 50;
            while (this.unBoosting && (maxLoops-- > 0))
            {
                await this.homey.app.asyncDelay(1000);
            }

            this.commandsQueued++;

            if (this.boostTimerId)
            {
                this.homey.clearTimeout(this.boostTimerId);
                this.boostTimerId = null;
            }

            // Set a time limit in case the command complete signal is missed
            this.boostTimerId = this.homey.setTimeout(() => this.unBoostSync(true), 45000);

            if (this.infoLogEnabled)
            {
                this.logInformation('Boost Sync',
                {
                    message: 'Increased Polling',
                    stack: { syncInterval: 3, queSize: this.commandsQueued },
                });
            }

            if (this.commandsQueued === 1)
            {
                this.nextCloudInterval = 0;
                if (this.syncTimerId)
                {
                    this.homey.clearTimeout(this.syncTimerId);
                    this.syncTimerId = null;
                }

                if (!this.tahomaCloud.eventsRegistered())
                {
                    // The events are not currently registered so do that now
                    try
                    {
                        await this.tahomaCloud.getEvents();
                    }
                    catch (error)
                    {
                        this.logInformation('Boost Sync register events: ', error.message);
                        this.commandsQueued = 0;
                        return false;
                    }
                }

                this.nextCloudInterval = LOCAL_INTERVAL * 1000;
                if (!this.syncing)
                {
                    // We can't run the sync loop from here so fire it from a timer
                    this.syncTimerId = this.homey.setTimeout(this.syncLoop, LOCAL_INTERVAL * 1000);
                }
            }
            else
            {
                let maxDelay = 6;
                while ((maxDelay > 0) && (this.commandsQueued > 0) && (!this.tahomaCloud.eventsRegistered()))
                {
                    await this.asyncDelay(500);
                    maxDelay--;
                }

                if ((!this.tahomaCloud.eventsRegistered()))
                {
                    return false;
                }
            }
        }
        return true;
    }

    async unBoostSync(immediate = false)
    {
        this.unBoosting = true;

        if (immediate)
        {
            if (this.unBoostTimerID)
            {
                this.homey.clearTimeout(this.unBoostTimerID);
                this.unBoostTimerID = null;
            }
            this.commandsQueued = 0;
        }

        if (this.infoLogEnabled)
        {
            this.logInformation('UnBoost Sync',
            {
                message: 'Reverting to previous Polling',
                stack:
                {
                    timeOut: immediate,
                    syncInterval: CLOUD_INTERVAL,
                    queSize: this.commandsQueued,
                },
            });
        }

        if (this.commandsQueued > 0)
        {
            this.commandsQueued--;
        }

        if (this.commandsQueued === 0)
        {
            this.homey.clearTimeout(this.boostTimerId);
            this.boostTimerId = null;
            this.startSync();
        }
        this.unBoosting = false;
    }

    async stopSync()
    {
        if (this.infoLogEnabled)
        {
            this.logInformation('Stop sync requested');
        }

        if (this.commandsQueued > 0)
        {
            this.commandsQueued = 0;
            this.homey.clearTimeout(this.boostTimerId);
            this.boostTimerId = null;
        }

        this.nextCloudInterval = 0;

        if (this.syncTimerId)
        {
            this.homey.clearTimeout(this.syncTimerId);
            this.syncTimerId = null;
        }

        if (this.infoLogEnabled)
        {
            this.logInformation('stopSync', 'Stopping Event Polling');
        }

        if (this.tahomaCloud)
        {
            await this.tahomaCloud.eventsClearRegistered();
        }
        if (this.tahomaLocal)
        {
            await this.tahomaLocal.eventsClearRegistered();
        }
    }

    async startSync()
    {
        if (this.commandsQueued > 0)
        {
            // Boost already running
            return;
        }

        this.nextCloudInterval = 0;

        if (this.syncTimerId)
        {
            this.homey.clearTimeout(this.syncTimerId);
            this.syncTimerId = null;
        }

        if (this.infoLogEnabled)
        {
            this.logInformation(`Restart sync in: ${CLOUD_INTERVAL} seconds`);
        }

        this.nextCloudInterval = CLOUD_INTERVAL * 1000;
        if (!this.syncing)
        {
            this.syncTimerId = this.homey.setTimeout(this.syncLoop, LOCAL_INTERVAL * 1000);
        }
    }

    // The main polling loop that fetches events and sends them to the devices
    async syncLoop()
    {
        if (this.syncTimerId)
        {
            // make sure any existing timer is canceled
            this.homey.clearTimeout(this.syncTimerId);
            this.syncTimerId = null;
        }

        let nextInterval = 0;

        if (this.nextCloudInterval !== 0)
        {
            if (this.tahomaLocal && this.tahomaLocal.authenticated)
            {
                nextInterval = await this.syncWorker(this.tahomaLocal);
            }
            else
            {
                nextInterval = LOCAL_INTERVAL * 1000;
            }

            if ((this.nextCloudInterval - (LOCAL_INTERVAL * 1000)) <= 0)
            {
                nextInterval = await this.syncWorker(this.tahomaCloud);
                this.nextCloudInterval = nextInterval;
            }
            else
            {
                this.nextCloudInterval -= (LOCAL_INTERVAL * 1000);
            }
        }

        if (nextInterval > 0)
        {
            // Setup timer for next sync
            this.syncTimerId = this.homey.setTimeout(this.syncLoop, LOCAL_INTERVAL * 1000);
        }
        else
        {
            if (this.infoLogEnabled)
            {
                this.logInformation('Not renewing sync');
            }

            this.syncTimerId = this.homey.setTimeout(() => this.initSync(), 10000);
        }
    }

    async syncWorker(tahomaConnection)
    {
        let nextInterval = CLOUD_INTERVAL * 1000;
        if (this.boostTimerId)
        {
            nextInterval = LOCAL_INTERVAL * 1000;
        }

        if (this.infoLogEnabled)
        {
            if (tahomaConnection.localLogin)
            {
                this.logInformation('syncLoop',
                 `Logged in = ${tahomaConnection.authenticated}, Local = ${tahomaConnection.localLogin}, Old Sync State = ${this.syncing}, Next cloud sync in ${this.nextCloudInterval / 1000}s`);
            }
            else
            {
                this.logInformation('syncLoop', `Logged in = ${tahomaConnection.authenticated}, Local = ${tahomaConnection.localLogin}, Old Sync State = ${this.syncing}`);
            }
        }

        if (!this.syncing)
        {
            this.syncing = true;

            // Make sure it has been about 30 seconds since last sync unless boost is on
            if (tahomaConnection.localLogin || this.boostTimerId || ((Date.now() - this.lastSync) > 28000))
            {
                if (!tahomaConnection.localLogin)
                {
                    this.lastSync = Date.now();
                }

                try
                {
                    let events = await tahomaConnection.getEvents();
                    if ((events === null && this.boostTimerId === null) || (events && events.length > 0))
                    {
                        // If events === null and boostTimer === null then refresh all the devices, but don't do that if the boost is on
                        if (events !== null && this.eventLogEnabled)
                        {
                            this.logEvents(this.varToString(events));
                        }
                        await this.syncEvents(events, tahomaConnection.localLogin);
                    }
                    events = null;
                }
                catch (error)
                {
                    // this.logInformation('syncLoop', error.message);
                    if (error.message)
                    {
                        if (error.message.indexOf('Far Too many') >= 0)
                        {
                            this.homey.clearTimeout(this.boostTimerId);
                            this.boostTimerId = null;
                            this.commandsQueued = 0;
                            if (error.message.indexOf('15 minutes') >= 0)
                            {
                                nextInterval = 900000;
                                this.logInformation('syncLoop', 'Postponed for 15 minutes');
                            }
                            else
                            {
                                nextInterval = 86400000;
                                this.logInformation('syncLoop', 'Postponed for 24 hours');
                            }
                        }
                        else if (error.message === 'Please leave 1 minutes between login attempts')
                        {
                            this.homey.clearTimeout(this.boostTimerId);
                            this.boostTimerId = null;
                            this.commandsQueued = 0;
                            this.logInformation('syncLoop', 'Postponed for 1 minute');
                            nextInterval = 61000;
                        }
                        else if (tahomaConnection.local && error.message === 'Request failed with status code 400')
                        {
                            await this.syncEvents(null, true);
                        }
                    }
                    else
                    {
                        this.logInformation('syncLoop', error);
                    }
                }
            }
            else if (this.infoLogEnabled)
            {
                this.logInformation('Skipping sync: too soon');
            }

            // Signal that the sync has completed
            this.syncing = false;
        }
        else if (!tahomaConnection.authenticated)
        {
            if (this.infoLogEnabled)
            {
                this.logInformation('Skipping sync: Not logged in');
            }
        }
        else if (this.infoLogEnabled)
        {
            this.logInformation('Skipping sync: Previous sync active');
        }

        return nextInterval;
    }

    // Pass the new events to each device so they can update their status
    async syncEvents(events, local)
    {
        try
        {
            if (events)
            {
                if (this.infoLogEnabled)
                {
                    this.logInformation('Device status update', 'Refreshing');
                }
            }
            else if (this.infoLogEnabled)
            {
                this.logInformation('Device status update', 'Renewing');
            }

            let drivers = this.homey.drivers.getDrivers();
            for (const driver of Object.values(drivers))
            {
                let devices = driver.getDevices();
                for (let device of Object.values(devices))
                {
                    if (device.syncEvents)
                    {
                        try
                        {
                            await device.syncEvents(events, local);
                        }
                        catch (error)
                        {
                            this.logInformation('Sync Devices error', error.message);
                        }
                    }

                    device = null;
                }
                devices = null;
            }

            drivers = null;

            if (this.infoLogEnabled)
            {
                this.logInformation('Device status update', 'Complete');
            }
        }
        catch (error)
        {
            this.logInformation(error.message, error.stack);
        }
    }

    // Trigger command complete
    triggerCommandComplete(device, commandName, success)
    {
        // trigger the card
        const tokens = { state: success, name: commandName };
        const state = { device };

        this.commandCompleteTrigger.trigger(tokens, state)
            .then(this.log)
            .catch(this.error);
    }

    /**
     * Adds a listener for flowcard scenario actions
     */
    addScenarioActionListeners()
    {
        /** * ADD FLOW ACTION LISTENERS ** */
        this.homey.flow.getActionCard('activate_scenario')
            .registerRunListener(async (args, state) =>
            {
                return this.tahomaCloud.executeScenario(args.scenario.oid);
            })
            .getArgument('scenario').registerAutocompleteListener((query) =>
            {
                return this.tahomaCloud.getActionGroups().then((data) => data.map(({ oid, label }) => (
                {
                    oid,
                    name: label,
                })).filter(({ name }) => name.toLowerCase().indexOf(query.toLowerCase()) > -1)).catch((error) =>
                {
                    this.logInformation('addScenarioActionListeners', error.message);
                });
            });
    }

    /**
     * Adds a listener for polling speed flowcard actions
     */
    addPollingSpeedActionListeners()
    {
        // Deprecated so do nothing
    }

    /**
     * Adds a listener for polling mode flowcard actions
     */
    addPollingActionListeners()
    {
        // Deprecated so do nothing
    }

    async asyncDelay(period)
    {
        await new Promise((resolve) => this.homey.setTimeout(resolve, period));
    }

    varToString(source)
    {
        try
        {
            if (source === null)
            {
                return 'null';
            }
            if (source === undefined)
            {
                return 'undefined';
            }
            if (source instanceof Error)
            {
                const stack = source.stack.replace('/\\n/g', '\n');
                return `${source.message}\n${stack}`;
            }
            if (typeof (source) === 'object')
            {
                const getCircularReplacer = () =>
                {
                    const seen = new WeakSet();
                    return (key, value) =>
                    {
                        if (typeof value === 'object' && value !== null)
                        {
                            if (seen.has(value))
                            {
                                return '';
                            }
                            seen.add(value);
                        }
                        return value;
                    };
                };

                return JSON.stringify(source, getCircularReplacer(), 2);
            }
            if (typeof (source) === 'string')
            {
                return source;
            }
        }
        catch (err)
        {
            this.homey.app.updateLog(`VarToString Error: ${err}`, 0);
        }

        return source.toString();
    }

    async cancelExecution(id, local)
    {
        if (local && this.tahomaLocal && this.tahomaLocal.authenticated)
        {
            try
            {
                await this.tahomaLocal.cancelExecution(id);
            }
            catch (err)
            {

            }
        }

        if (!local && this.tahomaCloud.authenticated)
        {
            try
            {
                await this.tahomaCloud.cancelExecution(id);
            }
            catch (err)
            {

            }
        }
    }

    async executeDeviceAction(label, deviceURL, action, boostSync, action2 = null, forceCloud = false)
    {
        if (this.infoLogEnabled)
        {
            this.logInformation(`${label}: Send command ${deviceURL}`, `command: ${this.varToString(action)}`);
        }

        if (!forceCloud && this.tahomaLocal && this.tahomaLocal.authenticated && this.tahomaLocal.supportedDevices)
        {
            if (this.tahomaLocal.supportedDevices.findIndex((element) => element.deviceURL === deviceURL) >= 0)
            {
                const data = await this.tahomaLocal.executeDeviceAction(label, deviceURL, action, action2);
                data.local = true;
                return data;
            }
        }

        if (this.tahomaCloud.authenticated && !this.usingDebugData)
        {
            const data = this.tahomaCloud.executeDeviceAction(label, deviceURL, action, action2);
            data.local = false;
            if (boostSync)
            {
                this.boostSync();
            }
            return data;
        }

        return null;
    }

    async getDeviceStates(deviceURL)
    {
        if (this.tahomaLocal && this.tahomaLocal.authenticated && this.tahomaLocal.supportedDevices)
        {
            // Check if the local connection supports the device
            if (this.tahomaLocal.supportedDevices.findIndex((element) => element.deviceURL === deviceURL) >= 0)
            {
                return this.tahomaLocal.getDeviceStates(deviceURL);
            }
        }
        if (this.tahomaCloud.authenticated && !this.usingDebugData)
        {
            return this.tahomaCloud.getDeviceStates(deviceURL);
        }

        return null;
    }

    async getDeviceData()
    {
        let data = null;
        if (this.tahomaLocal && this.tahomaLocal.authenticated)
        {
            // Always try to get local data so it populates the supported list
            data = await this.tahomaLocal.getDeviceData();
        }
        if (this.tahomaCloud.authenticated)
        {
            // Get the cloud data as it will support all devices
            return this.tahomaCloud.getDeviceData();
        }

        return data;
    }

    isLocalDevice(deviceURL, combineSubURLs)
    {
        if (this.tahomaLocal && this.tahomaLocal.authenticated && this.tahomaLocal.supportedDevices)
        {
            // Check if the local connection supports the device
            if (combineSubURLs)
            {
                if (this.tahomaLocal.supportedDevices.findIndex((element) => element.deviceURL.startsWith(deviceURL)))
                {
                    return true;
                }
            }
            else
            if (this.tahomaLocal.supportedDevices.findIndex((element) => element.deviceURL === deviceURL) >= 0)
            {
                return true;
            }
        }

        return false;
    }

    isLoggedIn()
    {
        return (this.tahomaCloud.authenticated | (this.tahomaLocal && this.tahomaLocal.authenticated));
    }

}
module.exports = myApp;
