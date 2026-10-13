#!/usr/bin/env bash
# Surface Control: one-time setup script
#
# Grants members of a dedicated 'surface-control' group write access to
# /sys/firmware/acpi/platform_profile and (if present on this kernel)
# BAT*/charge_control_end_threshold, so the GNOME Shell extension can switch
# power profiles and the battery charge limit without sudo.
#
# What this does:
#   1. Creates the 'surface-control' system group and adds you to it. A
#      dedicated group (instead of your primary group) keeps other local
#      users out on distros where everyone shares a primary group (e.g.
#      openSUSE's 'users').
#   2. Installs a udev rule that sets the permission whenever the Surface
#      platform-profile driver binds or a battery appears. The Surface SSAM
#      client drivers can load after early boot, so a boot-time-only rule
#      may run before the sysfs files exist.
#   3. Installs /etc/tmpfiles.d/surface-control.conf as an early-boot
#      fallback (no-op for files that do not exist yet).
#   4. Applies the permission immediately (no reboot needed).
#
# Usage:
#   bash setup-permissions.sh                   # install and apply
#   bash setup-permissions.sh --print udev      # print the udev rule only
#   bash setup-permissions.sh --print tmpfiles  # print the tmpfiles config only
#
# Requirements: sudo, systemd (udev + tmpfiles)

set -euo pipefail

GROUP=surface-control
UDEV_RULE=/etc/udev/rules.d/70-surface-control.rules
TMPFILE=/etc/tmpfiles.d/surface-control.conf
SYSFS=/sys/firmware/acpi/platform_profile
BATTERY_SYSFS_GLOB='/sys/class/power_supply/BAT*/charge_control_end_threshold'
THRESHOLD_FILENAME=charge_control_end_threshold

udev_rule() {
    cat << EOF_RULE
# Surface Control: let the '$GROUP' group write the platform profile and the
# battery charge limit. Installed by setup-permissions.sh (gse-surface).

# Platform profile, legacy file. Fires once the Surface driver has finished
# probing (bind), and on coldplug (add) when it was already bound.
ACTION=="add|bind", DRIVER=="surface_platform_profile", TEST=="$SYSFS", RUN+="/bin/sh -c 'chgrp $GROUP $SYSFS && chmod 0664 $SYSFS'"

# Platform profile on kernels that register a platform-profile class device
# (6.14+), for any platform-profile provider. The bind rule above is the
# reliable one for Surface devices: it fires after the legacy file exists.
ACTION=="add", SUBSYSTEM=="platform-profile", TEST=="$SYSFS", RUN+="/bin/sh -c 'chgrp $GROUP $SYSFS && chmod 0664 $SYSFS'"

# Battery charge limit (model-dependent kernel support).
ACTION=="add", SUBSYSTEM=="power_supply", KERNEL=="BAT*", TEST=="$THRESHOLD_FILENAME", RUN+="/bin/sh -c 'chgrp $GROUP /sys%p/$THRESHOLD_FILENAME && chmod 0664 /sys%p/$THRESHOLD_FILENAME'"
EOF_RULE
}

tmpfiles_conf() {
    cat << EOF_TMPFILES
# Surface Control: early-boot fallback for the udev rule in $UDEV_RULE.
# Allow the '$GROUP' group to write the platform profile
z $SYSFS 0664 root $GROUP - -
# Allow the '$GROUP' group to write the battery charge limit
# (glob: no-op on kernels/models without $THRESHOLD_FILENAME)
z $BATTERY_SYSFS_GLOB 0664 root $GROUP - -
EOF_TMPFILES
}

if [ "${1:-}" = "--print" ]; then
    case "${2:-}" in
        udev) udev_rule ;;
        tmpfiles) tmpfiles_conf ;;
        *) echo "Usage: $0 --print udev|tmpfiles" >&2; exit 2 ;;
    esac
    exit 0
elif [ $# -gt 0 ]; then
    echo "Usage: $0 [--print udev|tmpfiles]" >&2
    exit 2
fi

TARGET_USER=${SUDO_USER:-$(id -un)}
if [ "$TARGET_USER" = root ]; then
    echo "Run this script as your normal user (it calls sudo itself)." >&2
    exit 1
fi

echo "Granting group '$GROUP' write access to the Surface sysfs controls..."

if ! getent group "$GROUP" > /dev/null; then
    sudo groupadd --system "$GROUP"
fi
sudo usermod -aG "$GROUP" "$TARGET_USER"

udev_rule | sudo tee "$UDEV_RULE" > /dev/null
tmpfiles_conf | sudo tee "$TMPFILE" > /dev/null
sudo udevadm control --reload

# Apply now, without waiting for the next boot or driver load
shopt -s nullglob
battery_files=(/sys/class/power_supply/BAT*/"$THRESHOLD_FILENAME")
shopt -u nullglob

for file in "$SYSFS" "${battery_files[@]}"; do
    if [ -e "$file" ]; then
        sudo chgrp "$GROUP" "$file"
        sudo chmod 0664 "$file"
    fi
done

# Group membership only applies to new login sessions
if ! id -nG | tr ' ' '\n' | grep -qx "$GROUP"; then
    relogin_hint="Log out and back in so your session picks up the '$GROUP' group."
else
    relogin_hint=""
fi

# Verify platform profile (required: fatal if not writable for a fresh session
# of the target user; sudo -u initialises groups from the group database)
if sudo -u "$TARGET_USER" test -w "$SYSFS"; then
    echo "Done. Platform profile is writable by group '$GROUP'."
    echo "You can verify with: ls -la $SYSFS"
else
    echo "Warning: $SYSFS is still not writable by '$TARGET_USER'."
    echo "Check that the Surface platform-profile driver is loaded and that"
    echo "'$TARGET_USER' is in the '$GROUP' group (id $TARGET_USER)."
    exit 1
fi

# Verify battery charge limit (optional: kernel support is model-dependent,
# see https://github.com/linux-surface/linux-surface/issues/1580)
if [ ${#battery_files[@]} -eq 0 ]; then
    echo "Note: no $THRESHOLD_FILENAME file found: this kernel/model"
    echo "does not yet expose battery charge-limit control. Profile switching"
    echo "is unaffected."
elif sudo -u "$TARGET_USER" test -w "${battery_files[0]}"; then
    echo "Done. Battery charge limit is writable by group '$GROUP'."
else
    echo "Warning: ${battery_files[0]} is still not writable by '$TARGET_USER'."
    echo "Battery charge-limit control will show 'Setup required' in the menu."
fi

if [ -n "$relogin_hint" ]; then
    echo "$relogin_hint"
fi
