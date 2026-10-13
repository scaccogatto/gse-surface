// Minimal, controllable stand-in for gi://Gio.
//
// - harness.files: fake filesystem (path -> {contents, canWrite})
// - harness.commands: every spawned subprocess, settled by the test via
//   command.settle(stdout, exitStatus)
// - harness.monitors: every file monitor created

export const harness = {
    files: new Map(),
    commands: [],
    monitors: [],
    reset() {
        this.files.clear();
        this.commands.length = 0;
        this.monitors.length = 0;
    },
    pendingCommands() {
        return this.commands.filter(c => !c.settled);
    },
};

export const FileQueryInfoFlags = {NONE: 0};
export const FileMonitorFlags = {NONE: 0};
export const FileCreateFlags = {NONE: 0};
export const SubprocessFlags = {NONE: 0, STDOUT_PIPE: 2, STDERR_SILENCE: 32};

export class Cancellable {
    _cancelled = false;
    _onCancelled = [];

    cancel() {
        if (this._cancelled)
            return;
        this._cancelled = true;
        for (const fn of this._onCancelled.splice(0))
            fn();
    }

    is_cancelled() {
        return this._cancelled;
    }

    // Test-only hook used by the fake async operations below.
    _whenCancelled(fn) {
        if (this._cancelled)
            fn();
        else
            this._onCancelled.push(fn);
    }
}

class FileMonitor {
    cancelled = false;
    _handlers = [];

    connect(_signal, fn) {
        this._handlers.push(fn);
        return this._handlers.length;
    }

    cancel() {
        this.cancelled = true;
        return true;
    }

    emitChanged() {
        for (const fn of this._handlers)
            fn(this);
    }
}

export class File {
    static new_for_path(path) {
        return new File(path);
    }

    constructor(path) {
        this._path = path;
    }

    get_path() {
        return this._path;
    }

    resolve_relative_path(relative) {
        return new File(`${this._path}/${relative}`);
    }

    query_exists() {
        return harness.files.has(this._path);
    }

    query_info() {
        const entry = harness.files.get(this._path);
        if (!entry)
            throw new Error(`No such file: ${this._path}`);
        return {get_attribute_boolean: () => entry.canWrite};
    }

    monitor_file() {
        const monitor = new FileMonitor();
        harness.monitors.push(monitor);
        return monitor;
    }

    load_contents_async(_cancellable, callback) {
        setImmediate(() => callback(this, null));
    }

    load_contents_finish() {
        const entry = harness.files.get(this._path);
        if (!entry)
            throw new Error(`No such file: ${this._path}`);
        return [true, new TextEncoder().encode(entry.contents), null];
    }

    replace_contents(contents) {
        const entry = harness.files.get(this._path);
        if (!entry?.canWrite)
            throw new Error(`Permission denied: ${this._path}`);
        entry.contents = contents;
        return [true, null];
    }
}

export class FileIcon {
    constructor(props) {
        Object.assign(this, props);
    }
}

export class Subprocess {
    static new(argv, _flags) {
        return new Subprocess(argv);
    }

    constructor(argv) {
        this.argv = argv;
        this._result = null;
    }

    _start(cancellable, callback) {
        const command = {
            argv: this.argv,
            settled: false,
            settle: (stdout, status = 0) => {
                if (command.settled)
                    return;
                command.settled = true;
                this._result = {stdout, status};
                callback(this, null);
            },
        };
        harness.commands.push(command);
        cancellable?._whenCancelled(() => {
            if (command.settled)
                return;
            command.settled = true;
            this._result = {error: new Error('Operation was cancelled')};
            callback(this, null);
        });
    }

    _finish() {
        if (this._result.error)
            throw this._result.error;
    }

    communicate_utf8_async(_stdin, cancellable, callback) {
        this._start(cancellable, callback);
    }

    communicate_utf8_finish() {
        this._finish();
        return [true, this._result.stdout, null];
    }

    wait_async(cancellable, callback) {
        this._start(cancellable, callback);
    }

    wait_finish() {
        this._finish();
        return true;
    }

    get_exit_status() {
        return this._result.status;
    }
}

export default {
    Cancellable,
    File,
    FileCreateFlags,
    FileIcon,
    FileMonitorFlags,
    FileQueryInfoFlags,
    Subprocess,
    SubprocessFlags,
};
