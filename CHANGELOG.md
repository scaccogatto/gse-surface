# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Earlier versions are described in the [GitHub releases](https://github.com/scaccogatto/gse-surface/releases).

## [Unreleased]

### Changed

- **Breaking (setup):** `setup-permissions.sh` now grants write access to a dedicated `surface-control` group instead of your primary group, so other local users who share that primary group no longer get access. Re-run the script and log out and back in once.
- `setup-permissions.sh` installs a udev rule that re-applies the sysfs permissions when the Surface platform-profile driver binds or a battery appears, so the permission survives Surface drivers that load after early boot. The tmpfiles rule stays as an early-boot fallback. `--print udev` and `--print tmpfiles` show the generated files without changing anything.
- The dGPU power state and runtime PM mode are re-read every time the menu opens, instead of showing the value from extension startup.
- "Setup required" rows use the themed warning icon instead of a hardcoded amber text color, so they follow the shell theme, light style and high-contrast mode.
- The extensions.gnome.org description now lists the battery charge limit and states that the `surface` CLI is only needed for dGPU status and detachment.
- GitHub releases now carry the EGO submission zip as an asset.

### Fixed

- Disabling the extension while its startup hardware probes were still running (lock screen, session-mode change, quick toggle) no longer throws or leaves a duplicate Quick Settings tile behind. Pending `surface` probes are cancelled on disable.
- The development docs no longer suggest that disable and enable reload edited code: GJS caches modules, so edits need a new (nested) GNOME Shell.
