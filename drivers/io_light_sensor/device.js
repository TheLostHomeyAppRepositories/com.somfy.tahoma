'use strict';

const SensorDevice = require('../SensorDevice');
const Tahoma = require('../../lib/Tahoma');
const genericHelper = require('../../lib/helper').Generic;
const deviceHelper = require('../../lib/helper').Device;

/**
 * Device class for the light sensor with the io:LightIOSystemSensor controllable name in TaHoma
 * @extends {SensorDevice}
 */
class LightSensorDevice extends SensorDevice {

  onInit() {
    this.registerCapabilityListener('measure_luminance', this.onCapabilityMeasureLuminance.bind(this));

    super.onInit();
  }

  onCapabilityMeasureLuminance(value) {
    const oldLuminance = this.getState().measure_luminance;
    if (oldLuminance !== value) {
      this.setCapabilityValue('measure_luminance', value);

      const device = this;
      const tokens = {
        'luminance': value
      };

      const state = {
        'measure_luminance': value
      };

      //trigger flows
      this.getDriver()
        .triggerLuminanceMoreThan(device, tokens, state)
        .triggerLuminanceLessThan(device, tokens, state)
        .triggerLuminanceBetween(device, tokens, state);
    }

    return Promise.resolve();
  }

  /**
   * Gets the sensor data from the TaHoma cloud
   * @param {Array} data - device data from all the devices in the TaHoma cloud
   */
  sync(data) {
    const device = data.find(deviceHelper.isSameDevice(this.getData().id), this);
    if (!device) {
      this.setUnavailable(null);
      return;
    }

    if (device.states) {
      const luminance = device.states.find(state => state.name === 'core:LuminanceState');
      if (luminance) {
        this.log(this.getName(), luminance.value);
        this.triggerCapabilityListener('measure_luminance', luminance.value);
      }
    }
  }
}

module.exports = LightSensorDevice;