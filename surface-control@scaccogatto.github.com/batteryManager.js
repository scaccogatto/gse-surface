import Gio from 'gi://Gio';

const POWER_SUPPLY_DIR = '/sys/class/power_supply';
const THRESHOLD_FILENAME = 'charge_control_end_threshold';

/**
 * Manages battery charge-limit control via sysfs charge_control_end_threshold.
 * Call start() after construction. On devices without kernel support,
 * isAvailable() returns false and the feature must be hidden entirely.
 * Check canWrite() before showing write controls (kernel support without
 * sysfs write permission is a separate, non-blocking setup-required state).
 */
export class BatteryManager {
    /** @type {string|null} */
    _path = null;

    /** @type {Gio.FileMonitor|null} */
    _monitor = null;

    /** @type {number|null} */
    _currentThreshold = null;

    /** @type {boolean} */
    _canWrite = false;

    /** @type {Set<(threshold: number) => void>} */
    _listeners = new Set();

    constructor() {}

    /**
     * Probe for kernel support (BAT0/BAT1 glob), then start monitoring
     * the sysfs threshold file for changes and probe write permission.
     *
     * @returns {Promise<void>}
     */
    async start() {
        this._path = this._probePath();
        if (!this._path) return;

        const file = Gio.File.new_for_path(this._path);

        try {
            const info = file.query_info('access::can-write', Gio.FileQueryInfoFlags.NONE, null);
            this._canWrite = info.get_attribute_boolean('access::can-write');
        } catch {
            this._canWrite = false;
        }

        try {
            this._monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', () => this._onSysfsChanged());
        } catch (e) {
            console.warn(`[Surface Control] Failed to monitor ${this._path}: ${e.message}`);
        }

        this._currentThreshold = await this._readThresholdAsync();
    }

    /**
     * Stop monitoring and clean up.
     */
    stop() {
        if (this._monitor) {
            this._monitor.cancel();
            this._monitor = null;
        }
        this._listeners.clear();
        this._currentThreshold = null;
        this._canWrite = false;
        this._path = null;
    }

    /**
     * Whether this device exposes charge_control_end_threshold at all.
     * If false, the battery-limit UI must be hidden entirely.
     *
     * @returns {boolean}
     */
    isAvailable() {
        return this._path !== null;
    }

    /**
     * Whether the sysfs threshold file is writable by the current user.
     * If false, show a non-blocking setup hint — other features keep working.
     *
     * @returns {boolean}
     */
    canWrite() {
        return this._canWrite;
    }

    /**
     * Get the currently active threshold, or null if unavailable.
     *
     * @returns {number|null}
     */
    getCurrent() {
        return this._currentThreshold;
    }

    /**
     * Set a new charge threshold by writing directly to sysfs.
     * The file monitor picks up the change and notifies listeners.
     *
     * @param {number} threshold  one of BATTERY_THRESHOLDS (100 = no limit)
     * @returns {boolean} true on success
     */
    setThreshold(threshold) {
        if (!this._path) return false;

        try {
            const file = Gio.File.new_for_path(this._path);
            file.replace_contents(
                `${threshold}\n`,
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null
            );
            return true;
        } catch (e) {
            console.error(`[Surface Control] Failed to set battery threshold '${threshold}': ${e.message}`);
            return false;
        }
    }

    /**
     * Register a listener to be called when the threshold changes.
     *
     * @param {(threshold: number) => void} fn
     */
    onChange(fn) {
        this._listeners.add(fn);
    }

    /**
     * Unregister a previously registered listener.
     *
     * @param {(threshold: number) => void} fn
     */
    offChange(fn) {
        this._listeners.delete(fn);
    }

    // -------------------------------------------------------------------------

    /**
     * Find the first BAT0/BAT1 sysfs node exposing charge_control_end_threshold.
     *
     * @returns {string|null}
     */
    _probePath() {
        for (const bat of ['BAT0', 'BAT1']) {
            const path = `${POWER_SUPPLY_DIR}/${bat}/${THRESHOLD_FILENAME}`;
            if (Gio.File.new_for_path(path).query_exists(null))
                return path;
        }
        return null;
    }

    /**
     * Read the current threshold from sysfs asynchronously.
     *
     * @returns {Promise<number|null>}
     */
    _readThresholdAsync() {
        return new Promise((resolve) => {
            const file = Gio.File.new_for_path(this._path);
            file.load_contents_async(null, (_f, result) => {
                try {
                    const [ok, contents] = file.load_contents_finish(result);
                    const value = ok ? parseInt(new TextDecoder().decode(contents).trim(), 10) : NaN;
                    resolve(Number.isNaN(value) ? null : value);
                } catch {
                    resolve(null);
                }
            });
        });
    }

    async _onSysfsChanged() {
        const threshold = await this._readThresholdAsync();
        if (threshold === null || threshold === this._currentThreshold) return;

        this._currentThreshold = threshold;
        for (const fn of this._listeners) {
            try { fn(threshold); } catch (e) {
                console.error(`[Surface Control] battery listener error: ${e.message}`);
            }
        }
    }
}
