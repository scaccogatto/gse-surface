import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';

import {harness} from './stubs/gio.js';
import {panel} from './stubs/main.js';
import SurfaceControlExtension from '../surface-control@scaccogatto.github.com/extension.js';

const PROFILE_PATH = '/sys/firmware/acpi/platform_profile';
const indicators = panel.statusArea.quickSettings.indicators;

// No `surface` CLI on the test host: every hardware probe exits non-zero.
const settleProbes = () => {
    for (const command of harness.pendingCommands())
        command.settle(null, 1);
};

const newExtension = () => new SurfaceControlExtension({uuid: 'surface-control@scaccogatto.github.com'});

beforeEach(() => {
    harness.reset();
    indicators.length = 0;
    harness.files.set(PROFILE_PATH, {contents: 'balanced\n', canWrite: true});
});

test('enable() adds one indicator once the probes finish and disable() removes it', async () => {
    const ext = newExtension();
    const enabling = ext.enable();
    settleProbes();
    await enabling;

    assert.equal(indicators.length, 1);
    assert.equal(indicators[0].destroyed, false);

    ext.disable();
    assert.equal(indicators[0].destroyed, true);
    assert.ok(harness.monitors.every(m => m.cancelled));
});

test('disable() while the probes are pending does not crash or add an indicator', async () => {
    const ext = newExtension();
    const enabling = ext.enable();
    ext.disable();
    settleProbes();

    await assert.doesNotReject(enabling);
    assert.equal(indicators.length, 0);
    assert.ok(harness.monitors.length > 0);
    assert.ok(harness.monitors.every(m => m.cancelled));
});

test('disable() cancels the pending hardware probes', () => {
    const ext = newExtension();
    ext.enable();
    assert.ok(harness.pendingCommands().length > 0);

    ext.disable();
    assert.equal(harness.pendingCommands().length, 0);
});

test('enable() -> disable() -> enable() during the probes leaves exactly one live indicator', async () => {
    const ext = newExtension();
    const first = ext.enable();
    ext.disable();
    const second = ext.enable();
    settleProbes();
    await Promise.all([first, second]);

    assert.equal(indicators.length, 1);
    assert.equal(indicators[0].destroyed, false);

    ext.disable();
    assert.ok(indicators.every(i => i.destroyed));
    assert.ok(harness.monitors.every(m => m.cancelled));
});

test('a second enable() without disable() replaces the first one instead of leaking it', async () => {
    const ext = newExtension();
    const first = ext.enable();
    const second = ext.enable();
    settleProbes();
    await Promise.all([first, second]);

    assert.equal(indicators.filter(i => !i.destroyed).length, 1);

    ext.disable();
    assert.ok(indicators.every(i => i.destroyed));
    assert.ok(harness.monitors.every(m => m.cancelled));
});
