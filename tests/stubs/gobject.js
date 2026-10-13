// Minimal stand-in for gi://GObject. registerClass() is the identity and
// StubObject mimics GObject construction (constructor -> _init) plus signals.

export class StubObject {
    constructor(...args) {
        this._signalHandlers = new Map();
        this._nextHandlerId = 1;
        this.destroyed = false;
        this._init(...args);
    }

    _init(props = {}) {
        Object.assign(this, props);
    }

    connect(signal, fn) {
        const id = this._nextHandlerId++;
        this._signalHandlers.set(id, {signal, fn});
        return id;
    }

    disconnect(id) {
        this._signalHandlers.delete(id);
    }

    emit(signal, ...args) {
        for (const handler of [...this._signalHandlers.values()]) {
            if (handler.signal === signal)
                handler.fn(this, ...args);
        }
    }

    set(props) {
        Object.assign(this, props);
    }

    bind_property() {}

    destroy() {
        this.destroyed = true;
        this._signalHandlers.clear();
    }
}

export const BindingFlags = {SYNC_CREATE: 2};

export default {
    BindingFlags,
    registerClass: cls => cls,
};
