import {runCommand} from './utils.js';

/**
 * Probes discrete GPU availability and power state on startup.
 * On devices without a dGPU, isAvailable() returns false and all
 * other methods return null.
 */
export class DgpuManager {
    _available = false;
    _powerState = null;
    _runtimePm = null;

    /**
     * Probe whether a dGPU exists and read its initial state.
     *
     * @returns {Promise<void>}
     */
    async probe() {
        const state = await runCommand(['surface', 'dgpu', 'get-power-state']);
        this._available = state !== null;

        if (this._available) {
            this._powerState = state;
            this._runtimePm = await runCommand(['surface', 'dgpu', 'get-runtime-pm']);
        }
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
        this._available = false;
        this._powerState = null;
        this._runtimePm = null;
    }
}
