import {StubObject} from './gobject.js';

export const Ornament = {NONE: 0, DOT: 1, CHECK: 2};

class PopupBaseMenuItem extends StubObject {
    _init(params = {}) {
        super._init(params);
        this.ornament = Ornament.NONE;
    }

    setOrnament(ornament) {
        this.ornament = ornament;
    }

    activate() {
        this.emit('activate');
    }
}

export class PopupMenuItem extends PopupBaseMenuItem {
    _init(text, params) {
        super._init(params);
        this.label = {text, style: null};
    }
}

export class PopupImageMenuItem extends PopupBaseMenuItem {
    _init(text, icon, params) {
        super._init(params);
        this.label = {text, style: null};
        this.icon = {icon_name: icon};
    }
}

export class PopupSeparatorMenuItem extends PopupBaseMenuItem {}

export class PopupMenuSection extends StubObject {
    _init() {
        super._init();
        this.items = [];
    }

    addMenuItem(item) {
        this.items.push(item);
    }

    destroy() {
        for (const item of this.items)
            item.destroy();
        super.destroy();
    }
}

// Stands in for QuickToggleMenu (a PopupMenuBase).
export class StubToggleMenu extends PopupMenuSection {
    setHeader(icon, title) {
        this.header = {icon, title};
    }

    addAction(title, callback) {
        const item = new PopupMenuItem(title);
        item.connect('activate', callback);
        this.addMenuItem(item);
        return item;
    }

    open() {
        this.isOpen = true;
        this.emit('open-state-changed', true);
    }

    close() {
        this.isOpen = false;
        this.emit('open-state-changed', false);
    }
}
