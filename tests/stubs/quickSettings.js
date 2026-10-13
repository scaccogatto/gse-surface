import {StubObject} from './gobject.js';
import {StubToggleMenu} from './popupMenu.js';

export class QuickMenuToggle extends StubObject {
    _init(params = {}) {
        this.checked = false;
        this.reactive = true;
        this.menu = new StubToggleMenu();
        super._init(params);
    }

    destroy() {
        this.menu.destroy();
        super.destroy();
    }
}

export class SystemIndicator extends StubObject {
    _init() {
        super._init();
        this.quickSettingsItems = [];
    }

    _addIndicator() {
        return new StubObject();
    }
}
