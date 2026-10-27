'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class FakeBase
{

	async onInit(capabilities)
	{
		if (Array.isArray(capabilities))
		{
			this.capabilitiesXRef = capabilities;
		}
		else
		{
			this.windowcoveringsActions = { up: 'open', idle: 'stop', down: 'close' };
		}
	}

	syncEventsList(events, capabilities, local)
	{
		return { events, capabilities, local };
	}

}

function loadModule(relativePath, dependencies)
{
	const filename = path.join(root, relativePath);
	const module = { exports: {} };
	vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
		module,
		require: (name) =>
		{
			if (dependencies[name])
			{
				return dependencies[name];
			}
			throw new Error(`Unexpected dependency: ${name}`);
		},
	}, { filename });
	return module.exports;
}

test('Audio Player driver supports volume and mute for all ogp AudioPlayer devices', async () =>
{
	const AudioPlayerDriver = loadModule('drivers/audio_player/driver.js', { '../Driver': FakeBase });
	const driver = new AudioPlayerDriver();
	await driver.onInit();
	assert.deepEqual(JSON.parse(JSON.stringify(driver.deviceType)), ['ogp:AudioPlayer']);

	const AudioPlayerDevice = loadModule('drivers/audio_player/device.js', { '../Device': FakeBase });
	const device = new AudioPlayerDevice();
	await device.onInit();
	assert.equal(device.boostSync, true);
	assert.deepEqual(JSON.parse(JSON.stringify(device.capabilitiesXRef)), [
		{
			homeyName: 'volume_set',
			somfyNameGet: 'core:VolumeLevelState',
			somfyNameSet: ['setVolume'],
			scale: 100,
		},
		{
			homeyName: 'volume_mute',
			somfyNameGet: 'core:MuteState',
			somfyNameSet: ['unmute', 'mute'],
		},
	]);
});

test('RTS pergola driver uses timed open/close/stop controls without position feedback', async () =>
{
	const RtsPergolaDriver = loadModule('drivers/rts_pergola/driver.js', { '../Driver': FakeBase });
	const driver = new RtsPergolaDriver();
	await driver.onInit();
	assert.deepEqual(JSON.parse(JSON.stringify(driver.deviceType)), ['rts:BioclimaticPergolaRTSComponent']);

	const RtsPergolaDevice = loadModule('drivers/rts_pergola/device.js', { '../WindowCoveringsDevice': FakeBase });
	const device = new RtsPergolaDevice();
	const calls = [];
	Object.assign(device, {
		executionId: null,
		executionCmd: '',
		homey: {
			app: {
				executeDeviceAction: async (...args) =>
				{
					calls.push(args);
					return { execId: 'execution', local: true };
				},
				logInformation() {},
			},
			setTimeout: () => 1,
		},
		getData: () => ({ label: 'Pergola', deviceURL: 'rts://gateway/device' }),
		getName: () => 'Pergola',
		shouldThrottleDuplicateCommand: () => false,
		setWarning: async () => {},
		setCapabilityValue: async () => {},
		logCapabilityCommandError() {},
		error() {},
	});

	await device.onInit();
	assert.equal(device.positionStateName, '');
	assert.equal(device.openClosedStateName, '');
	assert.deepEqual(JSON.parse(JSON.stringify(device.myParameter)), ['1']);

	await device.onCapabilityWindowcoveringsState('up');
	assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), {
		name: 'open',
		parameters: [1],
	});
	assert.equal(device.executionCmd, 'open');
});
