import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { ProfileManager } from './profileManager.js';
import { BatteryManager } from './batteryManager.js';
import { DgpuManager } from './dgpuManager.js';
import { DtxManager } from './dtxManager.js';
import { SurfaceIndicator } from './indicator.js';

export default class SurfaceControlExtension extends Extension {
    /** @type {ProfileManager|null} */
    _profileManager = null;

    /** @type {BatteryManager|null} */
    _batteryManager = null;

    /** @type {DgpuManager|null} */
    _dgpuManager = null;

    /** @type {DtxManager|null} */
    _dtxManager = null;

    /** @type {SurfaceIndicator|null} */
    _indicator = null;

    async enable() {
        // Instantiate managers
        this._profileManager = new ProfileManager();
        this._batteryManager = new BatteryManager();
        this._dgpuManager = new DgpuManager();
        this._dtxManager = new DtxManager();

        // Probe hardware features and start monitors in parallel
        await Promise.all([
            this._profileManager.start(),
            this._batteryManager.start(),
            this._dgpuManager.probe(),
            this._dtxManager.probe(),
        ]);

        // Build and register the Quick Settings indicator
        this._indicator = new SurfaceIndicator(
            this._profileManager,
            this._batteryManager,
            this._dgpuManager,
            this._dtxManager,
            this.dir
        );

        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;

        this._profileManager?.stop();
        this._profileManager = null;

        this._batteryManager?.stop();
        this._batteryManager = null;

        this._dgpuManager?.destroy();
        this._dgpuManager = null;

        this._dtxManager?.destroy();
        this._dtxManager = null;
    }
}
