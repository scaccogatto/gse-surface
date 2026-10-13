import Gio from 'gi://Gio';

import {runCommand, runCommandVoid} from './utils.js';

/**
 * Manages the Surface Book 2 DTX (detachment) system.
 * On devices without DTX, isAvailable() returns false and all
 * other methods are no-ops.
 */
export class DtxManager {
    _available = false;

    /** @type {Gio.Cancellable} cancelled by destroy() to drop the in-flight probe */
    _cancellable = new Gio.Cancellable();

    /**
     * Probe DTX availability.
     *
     * @returns {Promise<void>}
     */
    async probe() {
        const mode = await runCommand(['surface', 'dtx', 'get-devicemode'], this._cancellable);
        this._available = mode !== null && !this._cancellable.is_cancelled();
    }

    /** @returns {boolean} true if DTX hardware is present */
    isAvailable() {
        return this._available;
    }

    /**
     * Request latch-open (begin detachment).
     *
     * @returns {Promise<boolean>}
     */
    requestDetach() {
        return runCommandVoid(['surface', 'dtx', 'request']);
    }

    /**
     * Cancel any in-progress detachment.
     *
     * @returns {Promise<boolean>}
     */
    cancelDetach() {
        return runCommandVoid(['surface', 'dtx', 'cancel']);
    }

    destroy() {
        this._cancellable.cancel();
        this._available = false;
    }
}
