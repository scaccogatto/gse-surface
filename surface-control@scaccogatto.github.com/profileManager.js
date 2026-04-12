import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { PROFILE_SYSFS_PATH } from './utils.js';

/**
 * Manages reading, writing, and monitoring the platform profile.
 * Call start() after construction. Check canWrite() before showing controls.
 */
export class ProfileManager {
    /** @type {Gio.FileMonitor|null} */
    _monitor = null;

    /** @type {string|null} */
    _currentProfile = null;

    /** @type {boolean} */
    _canWrite = false;

    /** @type {Set<(profile: string) => void>} */
    _listeners = new Set();

    constructor() {}

    /**
     * Start monitoring the sysfs profile file for changes.
     * Also probes write permission so callers can show an error state.
     */
    start() {
        const file = Gio.File.new_for_path(PROFILE_SYSFS_PATH);

        // Probe write permission with a no-op: open for append then close immediately
        try {
            const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
            stream.close(null);
            this._canWrite = true;
        } catch {
            this._canWrite = false;
        }

        try {
            this._monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', () => this._onSysfsChanged());
        } catch (e) {
            console.warn(`[Surface Control] Failed to monitor ${PROFILE_SYSFS_PATH}: ${e.message}`);
        }

        // Read initial state
        this._currentProfile = this._readProfileSync();
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
        this._currentProfile = null;
        this._canWrite = false;
    }

    /**
     * Whether the sysfs profile file is writable by the current user.
     * If false, profile switching will fail — show a setup error in the UI.
     *
     * @returns {boolean}
     */
    canWrite() {
        return this._canWrite;
    }

    /**
     * Get the currently active profile name, or null if unavailable.
     *
     * @returns {string|null}
     */
    getCurrent() {
        return this._currentProfile;
    }

    /**
     * Set a new platform profile by writing directly to sysfs.
     * Faster than shelling out and works without PATH lookups.
     * The file monitor picks up the change and notifies listeners.
     *
     * @param {string} profile  sysfs profile key (e.g. 'balanced')
     * @returns {boolean} true on success
     */
    setProfile(profile) {
        try {
            const file = Gio.File.new_for_path(PROFILE_SYSFS_PATH);
            file.replace_contents(
                `${profile}\n`,
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null
            );
            return true;
        } catch (e) {
            console.error(`[Surface Control] Failed to set profile '${profile}': ${e.message}`);
            return false;
        }
    }

    /**
     * Register a listener to be called when the profile changes.
     *
     * @param {(profile: string) => void} fn
     */
    onChange(fn) {
        this._listeners.add(fn);
    }

    /**
     * Unregister a previously registered listener.
     *
     * @param {(profile: string) => void} fn
     */
    offChange(fn) {
        this._listeners.delete(fn);
    }

    // -------------------------------------------------------------------------

    _readProfileSync() {
        try {
            const [ok, contents] = GLib.file_get_contents(PROFILE_SYSFS_PATH);
            if (!ok) return null;
            return new TextDecoder().decode(contents).trim();
        } catch {
            return null;
        }
    }

    _onSysfsChanged() {
        const profile = this._readProfileSync();
        if (!profile || profile === this._currentProfile) return;

        this._currentProfile = profile;
        for (const fn of this._listeners) {
            try { fn(profile); } catch (e) {
                console.error(`[Surface Control] profile listener error: ${e.message}`);
            }
        }
    }
}
