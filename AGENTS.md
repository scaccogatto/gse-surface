# Surface Control — Agent Context

Project-specific rules and discoveries for AI agents working on this repo.
Global rules live in `~/.config/opencode/AGENTS.md`.

## What this project is

A GNOME Shell extension that exposes Microsoft Surface hardware controls
(platform profiles, battery charge limit, dGPU status, Surface Book detach) in the Quick Settings
panel. Targets GNOME Shell 45–50, ESModules, GPL-2.0-or-later.

- UUID: `surface-control@scaccogatto.github.com`
- GitHub: https://github.com/scaccogatto/gse-surface
- EGO: https://extensions.gnome.org (submit via web UI)
- Live install: `~/.local/share/gnome-shell/extensions/surface-control@scaccogatto.github.com/` (symlink to the source dir)

## File map

```
surface-control@scaccogatto.github.com/
├── metadata.json           — UUID, name, shell-version (45–50), no version field
├── extension.js            — enable()/disable() lifecycle; async enable() guarded by an enable token
├── indicator.js            — SurfaceMenuToggle (QuickMenuToggle) + SurfaceIndicator (SystemIndicator)
├── profileManager.js       — sysfs FileMonitor, async read via Gio, sync write via replace_contents
├── batteryManager.js       — BAT0/BAT1 charge_control_end_threshold probe, FileMonitor, sync write
├── dgpuManager.js          — probe()/refresh() read `surface dgpu` commands (cancellable)
├── dtxManager.js           — probe() reads `surface dtx` commands (cancellable)
├── utils.js                — PROFILES map, runCommand, runCommandVoid
├── icons/
│   └── hicolor/scalable/actions/
│       └── surface-control-symbolic.svg   — panel indicator icon (Gio.FileIcon, not themed)
└── LICENSE                 — GPL-2.0-or-later
```

Root-level files:
- `surface-control@scaccogatto.github.com.shell-extension.zip` — EGO upload artifact
- `setup-permissions.sh` — one-time sysfs permissions fix: `surface-control` group, udev rule, tmpfiles fallback
- `scripts/pack.sh` — builds the EGO zip (the only place that lists its contents)
- `scripts/check-syntax.mjs`, `scripts/shexli_gate.py` — CI checks, also runnable locally
- `tests/` — node:test unit tests + GJS stubs (not shipped)
- `requirements-ci.txt` — pinned shexli + deps (Dependabot pip entry)
- `CHANGELOG.md` — Keep a Changelog, every user-visible change goes under [Unreleased]
- `DESCRIPTION.md` — EGO short + long description copy
- `venv/` — Python venv with shexli installed (gitignored)

## Hardware context

- `surface` CLI v0.5.0 at `/usr/bin/surface` (linux-surface project)
- GNOME Shell 50.0, Wayland
- sysfs profile path: `/sys/firmware/acpi/platform_profile`
- sysfs battery threshold path: `/sys/class/power_supply/BAT{0,1}/charge_control_end_threshold`
  — model-dependent kernel support, see https://github.com/linux-surface/linux-surface/issues/1580.
  Not present on this dev machine's BAT1 (checked 2026-07-17) — feature is hidden here.
- Permissions fix: `setup-permissions.sh` creates the `surface-control` group and installs
  `/etc/udev/rules.d/70-surface-control.rules` (re-applies on driver bind / battery add,
  since the SSAM client drivers can load after tmpfiles runs) plus
  `/etc/tmpfiles.d/surface-control.conf` as an early-boot fallback.
  The dev machine still has an older `/etc/tmpfiles.d/surface-platform-profile.conf`
  (`0664 root wheel`): re-run the script to migrate.

## Key architectural decisions

### Profile reads: async via Gio
`GLib.file_get_contents()` is synchronous and flagged by shexli (EGO-X-004).
Use `Gio.File.load_contents_async()` wrapped in a Promise. See `profileManager.js:_readProfileAsync()`.

### Profile writes: synchronous Gio (intentional)
`Gio.File.replace_contents()` is sync but writing one word to sysfs is
sub-millisecond — no async needed. Avoids race conditions with the file monitor.

### Icons: Gio.FileIcon, not themed
Custom icons use `new Gio.FileIcon({file})` with `ext.dir.resolve_relative_path(...)`.
This avoids needing `Gtk.IconTheme.add_search_path()` (which drags Gtk into the shell
process). The panel indicator icon is set via `.gicon =`, not `.icon_name`.
Tile icons use system `power-profile-*-symbolic` — consistent with GNOME native UX.

### Extension.dir
GNOME 45+ `Extension` class exposes `this.dir` (a `Gio.File`).
Pass it down to `SurfaceIndicator` as `extensionDir`. Do NOT use `this.path` (string)
when you need a `Gio.File`.

### enable()/disable() race
GNOME Shell does not await `enable()`, so `disable()` can run while the startup probes
are pending. `enable()` stores the managers on `this` immediately (so `disable()` stops
them and cancels the `surface` subprocesses) and records an enable token. After the
await it builds UI only if it still owns the token. Covered by `tests/extension.test.mjs`.

### dGPU state refresh
The dGPU power state changes at runtime. The indicator re-reads it (async, cancellable)
on the menu's `open-state-changed`, never at a fixed interval.

### Warning rows
"Setup required" rows are `PopupImageMenuItem`s with `dialog-warning-symbolic` and no
inline style, so they follow the shell theme and high-contrast mode.

### Feature auto-detection
`DgpuManager.probe()` and `DtxManager.probe()` return early if the `surface` command
fails — UI sections are hidden via `isAvailable()`. No config needed.
`BatteryManager.start()` follows the same pattern via a sysfs glob probe (BAT0/BAT1)
instead of a command — `isAvailable()` gates the whole "Battery limit" section.
Write permission (`canWrite()`) is a separate, non-blocking check — profile switching
keeps working even if the battery threshold file isn't writable.

### No preferences window
`metadata.json` has no `settings-schema`. Do not add one unless a real user need arises.

## GNOME Shell coding rules

- ESModules only — no `imports.gi.*`, no `const … = Me.imports.*`
- Import GI libs: `import Gio from 'gi://Gio'`
- Import Shell UI: `import * as Main from 'resource:///org/gnome/shell/ui/main.js'`
- Import Extension base: `import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js'`
- No `Shell.Eval` on Wayland (disabled), and disable+enable does not reload code: use a nested shell
- No synchronous I/O in hot paths (file monitor callbacks, menu open) — always async
- Always call `super.destroy()` last in destroy() overrides
- `GObject.registerClass` wraps every St/Clutter class

## Running edited code (no in-place reload)

GJS caches ES modules and cannot unload them. `DisableExtension`/`EnableExtension`
(DBus or `gnome-extensions disable/enable`) only re-run `disable()`/`enable()` on the
modules already loaded: edited `.js` files are NOT re-imported, so that loop silently
runs stale code. Wayland cannot restart the shell in place.

To run edited code, start a fresh nested shell after every edit (the live install is a
symlink to the source dir, and the nested shell shares dconf, so the enabled extension loads):

```bash
# GNOME Shell 49+ (needs the mutter devkit)
dbus-run-session gnome-shell --devkit --wayland
# GNOME Shell 45-48
dbus-run-session gnome-shell --nested --wayland
```

Or log out and back in. Use disable+enable only to exercise the lifecycle itself
(e.g. teardown), never to load new code.

## Tests

```bash
npm run check   # node --check on every extension module
npm test        # node:test, extension modules loaded against GJS stubs in tests/stubs
```

`tests/setup.mjs` maps `gi://` and `resource:///` imports to the stubs. Bug fixes get a
test that fails before the fix. The stubs mimic only the APIs the extension uses: extend
them when the code starts using a new one.

## Lint (shexli)

```bash
cd /home/gatto/Developer/gse-surface
source venv/bin/activate   # pip install -r requirements-ci.txt (Python 3.12+)
sh scripts/pack.sh
python3 scripts/shexli_gate.py surface-control@scaccogatto.github.com \
  surface-control@scaccogatto.github.com.shell-extension.zip
# exits non-zero unless both JSON reports are clean (shexli itself always exits 0)
```

On macOS, shexli's zip mode needs `TMPDIR` on a non-symlinked path (it compares
`/var` with `/private/var`). Linux is unaffected.

Run shexli before every zip repackage. Fix all findings — EGO rejects on errors,
warns reviewers on warnings.

## Repackage zip

```bash
sh scripts/pack.sh   # -> ./surface-control@scaccogatto.github.com.shell-extension.zip
```

`scripts/pack.sh` zips `metadata.json`, every top-level `*.js`, `LICENSE` and `icons/`,
so a new module is included automatically. Never duplicate the file list elsewhere.
Publishing a GitHub release runs `.github/workflows/release.yml`, which attaches the zip.

## CI

`.github/workflows/ci.yml` (job `lint-and-package`, a required check: never rename it)
runs on every push/PR: `npm run check`, `npm test`, `shellcheck`, `udevadm verify` on
the generated udev rule, a `cmp` of the two LICENSE copies, `scripts/pack.sh`, and the
shexli gate on both the source dir and the zip (shexli pinned in `requirements-ci.txt`).
The zip is uploaded as a build artifact, since `gnome-extensions pack` needs gnome-shell,
which ubuntu runners don't have. Actions are SHA-pinned.

`.github/workflows/dependabot-auto-merge.yml` enables auto-merge for Dependabot patch
bumps and non-0.x minor bumps. Repo settings and rulesets live in the separate
OpenTofu repo, not here.

## EGO submission notes

- Upload zip at https://extensions.gnome.org/upload/
- **Extension page icon** (shown on EGO site): uploaded separately via the edit button
  on the extension page after submission. PNG/JPG/WebP, max 2 MB, ~128×128px convention.
  The zip itself does not carry the EGO page icon.
- The SVG in `icons/` is the **shell panel indicator icon** (shown in the top bar inside
  GNOME). These are two different icons for two different purposes.
- EGO reviewer checklist: no `Shell.Eval`, no sync I/O, GPL license, no `version` field
  in metadata.json (EGO assigns the version)

## Known gotchas

| Issue | Fix |
|-------|-----|
| `GLib.file_get_contents()` → shexli EGO-X-004 | Use `Gio.File.load_contents_async()` |
| `gnome-extensions pack` reads from installed dir, not source | Use `zip -r` from source dir |
| `zip -j` flattens paths — icons/ structure lost | Use `zip -r` from inside the ext dir |
| `Shell.Eval` disabled on Wayland, disable+enable keeps stale modules | Run edited code in a nested shell (`--devkit` 49+, `--nested` 45-48) |
| Two LICENSE copies (root + extension dir) | Keep them identical, CI runs `cmp` |
| `surface profile set` needs sudo | Write directly to sysfs via `Gio.File.replace_contents()` |
| shexli needs absolute path | `shexli "$(pwd)/surface-control@scaccogatto.github.com/"` |
