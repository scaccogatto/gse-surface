import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {PROFILES, DEFAULT_PROFILE} from './utils.js';

// Profile order for the menu (low → high)
const PROFILE_ORDER = ['low-power', 'balanced', 'balanced-performance', 'performance'];

// ---------------------------------------------------------------------------
// SurfaceMenuToggle
//
// UX mirrors GNOME's built-in Power Mode toggle:
//   - tile checked = any non-default profile is active
//   - clicking tile directly: toggle DEFAULT_PROFILE ↔ last non-default
//   - chevron opens submenu with all profiles as PopupImageMenuItem radio items
//   - dGPU / DTX sections appear below a separator when hardware is present
// ---------------------------------------------------------------------------

const SurfaceMenuToggle = GObject.registerClass(
class SurfaceMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(profileManager, dgpuManager, dtxManager) {
        super._init({
            title: 'Power Mode',
            menuButtonAccessibleName: 'Open Surface power profile menu',
            toggleMode: true,
        });

        this._profileManager = profileManager;
        this._dgpuManager = dgpuManager;
        this._dtxManager = dtxManager;

        // Track last non-default profile so tile-click can restore it
        this._lastActiveProfile = 'performance';

        this.menu.setHeader('power-profile-balanced-symbolic', 'Surface Power Mode');

        this._profileSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._profileSection);

        if (!profileManager.canWrite())
            this._buildPermissionError();
        else
            this._buildProfileItems();

        if (this._dgpuManager.isAvailable()) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._dgpuStatusItem = new PopupMenu.PopupMenuItem(
                this._dgpuLabel(), {reactive: false}
            );
            this.menu.addMenuItem(this._dgpuStatusItem);
        }

        if (this._dtxManager.isAvailable()) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction('Request Detach', () => this._dtxManager.requestDetach());
            this.menu.addAction('Cancel Detach', () => this._dtxManager.cancelDetach());
        }

        // Tile click: toggle default ↔ last non-default.
        // With toggleMode St.Button flips `checked` BEFORE emitting `clicked`,
        // so here `checked === true` means the user is switching AWAY from the
        // default profile.
        this.connect('clicked', () => {
            if (!this._profileManager.canWrite()) return;
            const target = this.checked ? this._lastActiveProfile : DEFAULT_PROFILE;
            this._profileManager.setProfile(target);
        });

        this._profileChangeHandler = p => this._syncProfile(p);
        this._profileManager.onChange(this._profileChangeHandler);

        this._syncProfile(profileManager.getCurrent());
    }

    _buildPermissionError() {
        this._profileItems = new Map();

        const item = new PopupMenu.PopupMenuItem(
            'Setup required — see project README',
            {reactive: false}
        );
        item.label.style = 'color: #e5a50a;';
        this._profileSection.addMenuItem(item);

        this.set({subtitle: 'Setup required', iconName: 'dialog-warning-symbolic'});
        this.reactive = false;
    }

    _buildProfileItems() {
        this._profileItems = new Map();

        for (const key of PROFILE_ORDER) {
            const meta = PROFILES[key];
            if (!meta) continue;

            const item = new PopupMenu.PopupImageMenuItem(meta.label, meta.iconName);
            item.connect('activate', () => this._profileManager.setProfile(key));
            this._profileItems.set(key, item);
            this._profileSection.addMenuItem(item);
        }
    }

    _syncProfile(profile) {
        if (!profile) return;

        const meta = PROFILES[profile] ?? PROFILES[DEFAULT_PROFILE];
        this.set({subtitle: meta.label, iconName: meta.iconName});
        this.checked = profile !== DEFAULT_PROFILE;

        if (profile !== DEFAULT_PROFILE)
            this._lastActiveProfile = profile;

        for (const [key, item] of this._profileItems) {
            item.setOrnament(
                key === profile ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE
            );
        }
    }

    _dgpuLabel() {
        const state = this._dgpuManager.getPowerState() ?? 'unknown';
        const pm = this._dgpuManager.getRuntimePm() ?? 'unknown';
        return `dGPU: ${state}  ·  PM: ${pm}`;
    }

    destroy() {
        this._profileManager.offChange(this._profileChangeHandler);
        super.destroy();
    }
});

// ---------------------------------------------------------------------------
// SurfaceIndicator — owns the toggle tile and the contextual panel icon
// ---------------------------------------------------------------------------

export const SurfaceIndicator = GObject.registerClass(
class SurfaceIndicator extends QuickSettings.SystemIndicator {
    _init(profileManager, dgpuManager, dtxManager, extensionDir) {
        super._init();

        // Panel icon — visible only when a non-default profile is active.
        // Uses a Gio.FileIcon so no icon-theme registration is needed.
        this._icon = this._addIndicator();
        this._icon.visible = false;
        const iconFile = extensionDir.resolve_relative_path(
            'icons/hicolor/scalable/actions/surface-control-symbolic.svg'
        );
        this._icon.gicon = new Gio.FileIcon({file: iconFile});

        this._toggle = new SurfaceMenuToggle(profileManager, dgpuManager, dtxManager);
        this.quickSettingsItems.push(this._toggle);

        this._toggle.bind_property('checked',
            this._icon, 'visible',
            GObject.BindingFlags.SYNC_CREATE);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
