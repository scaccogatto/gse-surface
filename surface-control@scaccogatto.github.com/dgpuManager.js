import Gio from 'gi://Gio';

import {runCommand} from './utils.js';

/**
 * Probes discrete GPU availability and reads its power state.
 * On devices without a dGPU, isAvailable() returns false and all
 * other methods return null.
 */
export class DgpuManager {
    _available = false;
    _powerState = null;
    _runtimePm = null;

    /** @type {Gio.Cancellable} cancelled by destroy() to drop in-flight reads */
    _cancellable = new Gio.Cancellable();

    /**
     * Probe whether a dGPU exists and read its initial state.
     *
     * @returns {Promise<void>}
     */
    async probe() {
        const state = await this._run('get-power-state');
        this._available = state !== null;

        if (this._available) {
            this._powerState = state;
            this._runtimePm = await this._run('get-runtime-pm');
        }
    }

    /**
     * Re-read the power state and runtime PM mode. The state changes at
     * runtime (e.g. D3cold -> D0 when an app wakes the dGPU), so callers
     * refresh it whenever it is about to be shown.
     * Values that fail to read keep their previous value.
     *
     * @returns {Promise<void>}
     */
    async refresh() {
        if (!this._available)
            return;

        const [state, pm] = await Promise.all([
            this._run('get-power-state'),
            this._run('get-runtime-pm'),
        ]);
        if (this._cancellable.is_cancelled())
            return;

        this._powerState = state ?? this._powerState;
        this._runtimePm = pm ?? this._runtimePm;
    }

    /** @returns {boolean} */
    isAvailable() {
        return this._available;
    }

    /** @returns {string|null} e.g. 'D3cold', 'D0' */
    getPowerState() {
        return this._powerState;
    }

    /** @returns {string|null} e.g. 'auto', 'on' */
    getRuntimePm() {
        return this._runtimePm;
    }

    destroy() {
        this._cancellable.cancel();
        this._available = false;
        this._powerState = null;
        this._runtimePm = null;
    }

    /**
     * @param {string} subcommand
     * @returns {Promise<string|null>}
     */
    _run(subcommand) {
        return runCommand(['surface', 'dgpu', subcommand], this._cancellable);
    }
}
