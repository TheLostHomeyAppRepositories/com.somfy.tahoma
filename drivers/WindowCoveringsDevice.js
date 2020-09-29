'use strict';

const Homey = require('homey');
const Device = require('./Device');
const Tahoma = require('../lib/Tahoma');

/**
 * Base class for window coverings devices
 * @extends {Device}
 */
class WindowCoveringsDevice extends Device {
    async onInit() {

        this._driver = this.getDriver();

        if (this.hasCapability("lock_state")) {
            this._driver.lock_state_changedTrigger = new Homey.FlowCardTriggerDevice('lock_state_changed')
                .register()
        }

        this.invertPosition = this.getSetting('invertPosition');
        if (this.invertPosition === null) {
            this.invertPosition = false;
        }

        this.invertUpDown = this.getSetting('invertUpDown');
        if (this.invertUpDown === null) {
            this.invertUpDown = false;
        }

        if (this.invertUpDown) {
            this.windowcoveringsActions = {
                up: 'close',
                idle: null,
                down: 'open'
            };

            this.windowcoveringsStatesMap = {
                open: 'down',
                closed: 'up'
            };
        } else {
            this.windowcoveringsActions = {
                up: 'open',
                idle: null,
                down: 'close'
            };

            this.windowcoveringsStatesMap = {
                open: 'up',
                closed: 'down',
                unknown: 'idle'
            };
        }

        this.closureStateName = 'core:ClosureState';
        this.setPositionActionName = 'setClosure';
        this.openClosedStateName = 'core:OpenClosedState';
        this.quietMode = false;

        this.registerCapabilityListener('windowcoverings_state', this.onCapabilityWindowcoveringsState.bind(this));
        this.registerCapabilityListener('windowcoverings_set', this.onCapabilityWindowcoveringsSet.bind(this));
        this.registerCapabilityListener('windowcoverings_tilt_up', this.onCapabilityWindowcoveringsTiltUp.bind(this));
        this.registerCapabilityListener('windowcoverings_tilt_down', this.onCapabilityWindowcoveringsTiltDown.bind(this));
        this.registerCapabilityListener('my_position', this.onCapabilityMyPosition.bind(this));
        this.registerCapabilityListener('quick_open', this.onCapabilityWindowcoveringsClosed.bind(this));
        await super.onInit();
    }

    async onSettings(oldSettingsObj, newSettingsObj, changedKeysArr) {
        if (changedKeysArr.indexOf("reverseDirection") >= 0) {
            this.invertUpDown = newSettingsObj.reverseDirection;

            if (this.invertUpDown) {
                this.windowcoveringsActions = {
                    up: 'close',
                    idle: null,
                    down: 'open'
                };

                this.windowcoveringsStatesMap = {
                    open: 'down',
                    closed: 'up',
                    unknown: 'idle'
                };
            } else {
                this.windowcoveringsActions = {
                    up: 'open',
                    idle: null,
                    down: 'close'
                };

                this.windowcoveringsStatesMap = {
                    open: 'up',
                    closed: 'down'
                };
            }
        }
        if (changedKeysArr.indexOf("invertPosition") >= 0) {
            this.invertPosition = newSettingsObj.invertPosition;
        }
    }

    async onCapabilityWindowcoveringsState(value, opts) {
        if (!opts || !opts.fromCloudSync) {
            const deviceData = this.getData();
            if (value === 'idle' && this.getStoreValue('executionId')) {
                Tahoma.cancelExecution(this.getStoreValue('executionId'));
            } else {
                await Tahoma.cancelExecution(this.getStoreValue('executionId'));

                const action = {
                    name: this.windowcoveringsActions[value],
                    parameters: []
                }
                let result = await Tahoma.executeDeviceAction(deviceData.label, deviceData.deviceURL, action);
                if (result.errorCode) {
                    this.setWarning(result.errorCode + result.error);
                    Homey.app.logError(this.getName(), {
                        message: result.error,
                        stack: result.errorCode
                    });
                    return Promise.reject(new Error(result.error));
                } else {
                    this.setStoreValue('executionId', result.execId);
                }
            };

            if (!this.closureStateName) {
                setTimeout(() => {
                    this.setCapabilityValue('windowcoverings_state', null);
                }, 500);
            }
        } else {
            // New value from Tahoma
            this.setCapabilityValue('windowcoverings_state', value);
            if (this.hasCapability("quick_open")) {
                this.setCapabilityValue("quick_open", value !== "down")
            }
        }
    }

    async onCapabilityWindowcoveringsSet(value, opts) {
        if (!opts || !opts.fromCloudSync) {
            const deviceData = this.getData();
            if (this.invertPosition) {
                value = 1 - value;
            }
            const action = {
                name: this.setPositionActionName, // Anders pull request
                parameters: [Math.round((1 - value) * 100)]
            };

            if (this.setPositionActionName === 'setPositionAndLinearSpeed') {
                // Add low speed option if quiet mode is selected
                action.parameters.push("lowspeed");
            }

            let result = await Tahoma.executeDeviceAction(deviceData.label, deviceData.deviceURL, action)
            if (result.errorCode) {
                this.setWarning(result.errorCode + result.error);
                Homey.app.logError(this.getName(), {
                    message: result.error,
                    stack: result.errorCode
                });
                return Promise.reject(new Error(result.error));
            } else {
                this.setStoreValue('executionId', result.execId);
            }
        } else {
            // New value from Tahoma
            this.setCapabilityValue('windowcoverings_set', value);
        }
    }

    async onCapabilityWindowcoveringsTiltUp(value, opts) {
        if (!opts || !opts.fromCloudSync) {
            const deviceData = this.getData();
            await Tahoma.cancelExecution(this.getStoreValue('executionId'));

            const action = {
                name: 'tiltPositive',
                parameters: [3, 1]
            };
            let result = await Tahoma.executeDeviceAction(deviceData.label, deviceData.deviceURL, action)
            if (result.errorCode) {
                this.setWarning(result.errorCode + result.error);
                Homey.app.logError(this.getName(), {
                    message: result.error,
                    stack: result.errorCode
                });
                return Promise.reject(new Error(result.error));
            } else {
                this.setStoreValue('executionId', result.execId);
            }
        }
    }

    async onCapabilityWindowcoveringsTiltDown(value, opts) {
        if (!opts || !opts.fromCloudSync) {
            const deviceData = this.getData();
            await Tahoma.cancelExecution(this.getStoreValue('executionId'));
            const action = {
                name: 'tiltNegative',
                parameters: [3, 1]
            };
            let result = await Tahoma.executeDeviceAction(deviceData.label, deviceData.deviceURL, action)
            if (result.errorCode) {
                Homey.app.logError(this.getName(), {
                    message: result.error,
                    stack: result.errorCode
                });
                return Promise.reject(new Error(result.error));
            } else {
                this.setStoreValue('executionId', result.execId);
            }
        }
    }

    async onCapabilityMyPosition(value, opts) {
        if (!opts || !opts.fromCloudSync) {
            const deviceData = this.getData();
            await Tahoma.cancelExecution(this.getStoreValue('executionId'));
            const action = {
                name: 'my'
            };
            let result = await Tahoma.executeDeviceAction(deviceData.label, deviceData.deviceURL, action);
            if (result.errorCode) {
                Homey.app.logError(this.getName(), {
                    message: result.error,
                    stack: result.errorCode
                });
                return Promise.reject(new Error(result.error));
            } else {
                this.setStoreValue('executionId', result.execId);
            }
        }
    }

    async onCapabilityWindowcoveringsClosed(value, opts) {
        return this.onCapabilityWindowcoveringsState(value ? 'up' : 'down', null)
    }

    /**
     * Sync the state of the devices from the TaHoma cloud with Homey
     * @param {Array} data - device data from all the devices in the TaHoma cloud
     */
    async sync(data) {
        let thisId = this.getData().id;
        const device = data.find(device => device.oid === thisId);

        if (device) {
            if (device.states) {
                if (this.hasCapability("lock_state")) {
                    const lockState = device.states.find(state => state.name === "io:PriorityLockOriginatorState");
                    if (lockState) {
                        Homey.app.logStates(this.getName() + ": io:PriorityLockOriginatorState = " + lockState.value);
                        this.setCapabilityValue("lock_state", lockState.value);
                    }
                }

                //device exists -> let's sync the state of the device
                const closureState = device.states.find(state => state.name === this.closureStateName);
                const openClosedState = device.states.find(state => state.name === this.openClosedStateName);

                if (this.unavailable) {
                    this.unavailable = false;
                    this.setAvailable();
                }

                if (openClosedState) {
                    Homey.app.logStates(this.getName() + ": " + this.openClosedStateName + " = " + openClosedState.value);

                    // Convert Tahoma states to Homey equivalent
                    if (closureState && (closureState.value !== 0) && (closureState.value !== 100)) {
                        // Not fully open or closed
                        openClosedState.value = 'idle';
                    } else {
                        openClosedState.value = this.windowcoveringsStatesMap[openClosedState.value];
                    }

                    this.triggerCapabilityListener('windowcoverings_state', openClosedState.value, {
                        fromCloudSync: true
                    });
                }

                if (closureState) {
                    Homey.app.logStates(this.getName() + ": " + this.closureStateName + " = " + closureState.value);

                    if (this.invertPosition) {
                        closureState.value = 100 - closureState.value;
                    }
                    this.triggerCapabilityListener('windowcoverings_set', 1 - (closureState.value / 100), {
                        fromCloudSync: true
                    });
                }
            } else if (this.hasCapability('windowcoverings_state')) {
                // RTS devices have no feedback
                if (this.unavailable) {
                    this.unavailable = false;
                    this.setAvailable();
                }

                this.log(this.getName(), " No device status");

                this.setCapabilityValue('windowcoverings_state', null);
            }
        } else {
            //device was not found in TaHoma response
            if (!this.unavailable) {
                this.unavailable = true;
                this.setUnavailable("Data not detected");
            }
            this.log(this.getName(), " No device data");
        }
    }
}

module.exports = WindowCoveringsDevice;