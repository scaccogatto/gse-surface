# Surface Control — Agent Context

Project-specific rules and discoveries for AI agents working on this repo.
Global rules live in `~/.config/opencode/AGENTS.md`.

## What this project is

A GNOME Shell extension that exposes Microsoft Surface hardware controls
(platform profiles, dGPU status, Surface Book detach) in the Quick Settings
panel. Targets GNOME Shell 45–50, ESModules, GPL-2.0-or-later.

- UUID: `surface-control@scaccogatto.github.com`
- GitHub: https://github.com/scaccogatto/gse-surface
- EGO: https://extensions.gnome.org (submit via web UI)
- Live install: `~/.local/share/gnome-shell/extensions/surface-control@scaccogatto.github.com/`

## File map

```
surface-control@scaccogatto.github.com/
├── metadata.json           — UUID, name, shell-version (45–50), no version field
├── extension.js            — enable()/disable() lifecycle; async enable()
├── indicator.js            — SurfaceMenuToggle (QuickMenuToggle) + SurfaceIndicator (SystemIndicator)
├── profileManager.js       — sysfs FileMonitor, async read via Gio, sync write via replace_contents
├── dgpuManager.js          — probe() reads `surface dgpu` commands
├── dtxManager.js           — probe() reads `surface dtx` commands
├── utils.js                — PROFILES map, runCommand, runCommandVoid
├── icons/
│   └── hicolor/scalable/actions/
│       └── surface-control-symbolic.svg   — panel indicator icon (Gio.FileIcon, not themed)
└── LICENSE                 — GPL-2.0-or-later
```

Root-level files:
- `surface-control@scaccogatto.github.com.shell-extension.zip` — EGO upload artifact
- `setup-permissions.sh` — one-time sysfs permissions fix for the user
- `DESCRIPTION.md` — EGO short + long description copy
- `venv/` — Python venv with shexli installed (gitignored)

## Hardware context

- `surface` CLI v0.5.0 at `/usr/bin/surface` (linux-surface project)
- GNOME Shell 50.0, Wayland
- sysfs profile path: `/sys/firmware/acpi/platform_profile`
- Permissions fix: `/etc/tmpfiles.d/surface-platform-profile.conf` sets `0664 root wheel`
  — already applied on the dev machine; new users run `setup-permissions.sh`

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

### Feature auto-detection
`DgpuManager.probe()` and `DtxManager.probe()` return early if the `surface` command
fails — UI sections are hidden via `isAvailable()`. No config needed.

### No preferences window
`metadata.json` has no `settings-schema`. Do not add one unless a real user need arises.

## GNOME Shell coding rules

- ESModules only — no `imports.gi.*`, no `const … = Me.imports.*`
- Import GI libs: `import Gio from 'gi://Gio'`
- Import Shell UI: `import * as Main from 'resource:///org/gnome/shell/ui/main.js'`
- Import Extension base: `import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js'`
- No `Shell.Eval` on Wayland (disabled) — reload via disable+enable DBus calls
- No synchronous I/O in hot paths (file monitor callbacks, menu open) — always async
- Always call `super.destroy()` last in destroy() overrides
- `GObject.registerClass` wraps every St/Clutter class

## Reload extension (no logout needed)

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions \
  --object-path /org/gnome/Shell/Extensions \
  --method org.gnome.Shell.Extensions.DisableExtension \
  "surface-control@scaccogatto.github.com"

sleep 1

gdbus call --session \
  --dest org.gnome.Shell.Extensions \
  --object-path /org/gnome/Shell/Extensions \
  --method org.gnome.Shell.Extensions.EnableExtension \
  "surface-control@scaccogatto.github.com"
```

## Sync source → live install + reload (one-liner)

```bash
SRC="/home/gatto/Developer/gse-surface/surface-control@scaccogatto.github.com"
DST="$HOME/.local/share/gnome-shell/extensions/surface-control@scaccogatto.github.com"
rsync -a "$SRC/" "$DST/" && \
gdbus call --session --dest org.gnome.Shell.Extensions \
  --object-path /org/gnome/Shell/Extensions \
  --method org.gnome.Shell.Extensions.DisableExtension \
  "surface-control@scaccogatto.github.com" && sleep 1 && \
gdbus call --session --dest org.gnome.Shell.Extensions \
  --object-path /org/gnome/Shell/Extensions \
  --method org.gnome.Shell.Extensions.EnableExtension \
  "surface-control@scaccogatto.github.com"
```

## Lint (shexli)

```bash
cd /home/gatto/Developer/gse-surface
source venv/bin/activate
shexli "$(pwd)/surface-control@scaccogatto.github.com/"
# must output: shexli: clean (0 findings, 0 errors, 0 warnings)
```

Run shexli before every zip repackage. Fix all findings — EGO rejects on errors,
warns reviewers on warnings.

## Repackage zip

```bash
cd /home/gatto/Developer/gse-surface/surface-control@scaccogatto.github.com
ZIP="$(dirname $(pwd))/surface-control@scaccogatto.github.com.shell-extension.zip"
rm -f "$ZIP"
zip -r "$ZIP" metadata.json extension.js indicator.js profileManager.js \
  dgpuManager.js dtxManager.js utils.js LICENSE icons/
```

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
| `Shell.Eval` disabled on Wayland | Use DBus `DisableExtension`/`EnableExtension` |
| `surface profile set` needs sudo | Write directly to sysfs via `Gio.File.replace_contents()` |
| shexli needs absolute path | `shexli "$(pwd)/surface-control@scaccogatto.github.com/"` |
