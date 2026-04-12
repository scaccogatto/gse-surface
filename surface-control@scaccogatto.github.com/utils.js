import Gio from 'gi://Gio';

// Profile definitions: sysfs key → display metadata
export const PROFILES = {
    'low-power': {
        label: 'Low Power',
        iconName: 'power-profile-power-saver-symbolic',
    },
    'balanced': {
        label: 'Balanced',
        iconName: 'power-profile-balanced-symbolic',
    },
    'balanced-performance': {
        label: 'Balanced Performance',
        iconName: 'power-profile-balanced-symbolic',
    },
    'performance': {
        label: 'Performance',
        iconName: 'power-profile-performance-symbolic',
    },
};

export const DEFAULT_PROFILE = 'balanced';

export const PROFILE_SYSFS_PATH = '/sys/firmware/acpi/platform_profile';

/**
 * Run a command, returning stdout as a trimmed string or null on failure.
 *
 * @param {string[]} argv
 * @returns {Promise<string|null>}
 */
export function runCommand(argv) {
    return new Promise(resolve => {
        try {
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );

            proc.communicate_utf8_async(null, null, (_proc, res) => {
                try {
                    const [, stdout] = _proc.communicate_utf8_finish(res);
                    resolve(_proc.get_exit_status() === 0 ? (stdout?.trim() ?? '') : null);
                } catch {
                    resolve(null);
                }
            });
        } catch {
            resolve(null);
        }
    });
}

/**
 * Run a fire-and-forget command.
 *
 * @param {string[]} argv
 * @returns {Promise<boolean>}
 */
export function runCommandVoid(argv) {
    return new Promise(resolve => {
        try {
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            proc.wait_async(null, (_proc, res) => {
                try {
                    _proc.wait_finish(res);
                    resolve(_proc.get_exit_status() === 0);
                } catch {
                    resolve(false);
                }
            });
        } catch {
            resolve(false);
        }
    });
}
