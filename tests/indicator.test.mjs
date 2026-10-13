import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';

import {harness} from './stubs/gio.js';
import {PopupImageMenuItem} from './stubs/popupMenu.js';
import {DgpuManager} from '../surface-control@scaccogatto.github.com/dgpuManager.js';
import {SurfaceIndicator} from '../surface-control@scaccogatto.github.com/indicator.js';
import Gio from './stubs/gio.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

const settle = (subcommand, stdout) => {
    const command = harness.pendingCommands().find(c => c.argv.join(' ') === `surface dgpu ${subcommand}`);
    assert.ok(command, `expected a pending 'surface dgpu ${subcommand}' call`);
    command.settle(stdout, 0);
};

const fakeProfileManager = ({canWrite = true} = {}) => ({
    canWrite: () => canWrite,
    getCurrent: () => 'balanced',
    setProfile: () => true,
    onChange() {},
    offChange() {},
});

const fakeBatteryManager = ({available = false, canWrite = true} = {}) => ({
    isAvailable: () => available,
    canWrite: () => canWrite,
    getCurrent: () => 80,
    setThreshold: () => true,
    onChange() {},
    offChange() {},
});

const absent = {isAvailable: () => false};

const buildIndicator = ({profileManager = fakeProfileManager(), batteryManager = fakeBatteryManager(), dgpuManager = absent} = {}) =>
    new SurfaceIndicator(profileManager, batteryManager, dgpuManager, absent, Gio.File.new_for_path('/extension'));

const probedDgpu = async (powerState, runtimePm) => {
    const dgpu = new DgpuManager();
    const probing = dgpu.probe();
    settle('get-power-state', powerState);
    await tick();
    settle('get-runtime-pm', runtimePm);
    await probing;
    return dgpu;
};

const dgpuItem = indicator => indicator._toggle.menu.items.find(i => i.label?.text?.startsWith('dGPU:'));

beforeEach(() => harness.reset());

test('dGPU status is re-read every time the menu opens', async () => {
    const dgpu = await probedDgpu('D3cold', 'auto');
    const indicator = buildIndicator({dgpuManager: dgpu});
    assert.match(dgpuItem(indicator).label.text, /D3cold/);

    indicator._toggle.menu.open();
    settle('get-power-state', 'D0');
    settle('get-runtime-pm', 'on');
    await tick();

    assert.equal(dgpuItem(indicator).label.text, 'dGPU: D0  ·  PM: on');
});

test('closing the menu does not trigger a dGPU refresh', async () => {
    const dgpu = await probedDgpu('D3cold', 'auto');
    const indicator = buildIndicator({dgpuManager: dgpu});

    indicator._toggle.menu.close();
    assert.equal(harness.pendingCommands().length, 0);
});

test('a dGPU refresh that finishes after teardown is dropped', async () => {
    const dgpu = await probedDgpu('D3cold', 'auto');
    const indicator = buildIndicator({dgpuManager: dgpu});
    const item = dgpuItem(indicator);

    indicator._toggle.menu.open();
    indicator.destroy();
    dgpu.destroy();
    await tick();

    assert.equal(harness.pendingCommands().length, 0);
    assert.match(item.label.text, /D3cold/);
});

test('missing profile permission shows a themed warning row, not a hardcoded color', () => {
    const indicator = buildIndicator({profileManager: fakeProfileManager({canWrite: false})});
    const [warning] = indicator._toggle._profileSection.items;

    assert.ok(warning instanceof PopupImageMenuItem);
    assert.equal(warning.icon.icon_name, 'dialog-warning-symbolic');
    assert.equal(warning.label.style, null);
});

test('missing battery permission shows a themed warning row, not a hardcoded color', () => {
    const indicator = buildIndicator({batteryManager: fakeBatteryManager({available: true, canWrite: false})});
    const [warning] = indicator._toggle._batterySection.items;

    assert.ok(warning instanceof PopupImageMenuItem);
    assert.equal(warning.icon.icon_name, 'dialog-warning-symbolic');
    assert.equal(warning.label.style, null);
});
