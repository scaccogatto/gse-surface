# extensions.gnome.org Listing Copy

## Short Description
*(shown in search results and cards — max ~200 chars)*

Control your Microsoft Surface from Quick Settings: switch power profiles, cap the battery charge limit, check GPU state, and manage Surface Book detachment.

---

## Full Description
*(shown on the extension detail page)*

Surface Control brings your Microsoft Surface hardware settings into GNOME Shell's Quick Settings panel, right where you already manage Wi-Fi, Bluetooth, and audio.

**Platform Profiles**
Switch between Low Power, Balanced, Balanced Performance, and Performance with a single tap. The active profile is always visible as the tile subtitle. Changes made by external tools are reflected instantly — no polling, no delay.

**Contextual Panel Indicator**
A subtle icon appears in the top bar whenever you're on a non-default power profile, giving you at-a-glance awareness without permanent clutter.

**Battery Charge Limit** *(kernel-dependent)*
Cap charging at 60%, 80%, or 100% (no limit) to reduce long-term battery wear. Automatically hidden when the kernel does not expose charge-limit control for your model.

**Discrete GPU Status** *(Surface Book)*
Current dGPU power state and runtime PM mode shown directly in the menu, refreshed every time you open it. Automatically hidden on devices without a discrete GPU.

**Surface Book Detachment** *(Surface Book 2)*
Request or cancel clipboard detachment from the Quick Settings panel. Automatically hidden on devices without DTX hardware.

Surface Control auto-detects your hardware at startup and only shows what your device actually supports.

Requires the linux-surface kernel. Platform profiles and the battery charge limit work through sysfs (run the project's one-time setup script to grant write access). Discrete GPU status and detachment controls also need the `surface` CLI from the linux-surface project.
