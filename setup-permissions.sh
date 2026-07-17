#!/usr/bin/env bash
# Surface Control — one-time setup script
# Grants the current user write access to /sys/firmware/acpi/platform_profile
# and (if present on this kernel) BAT*/charge_control_end_threshold, so the
# GNOME Shell extension can switch power profiles and the battery charge
# limit without sudo.
#
# What this does:
#   1. Creates /etc/tmpfiles.d/surface-control.conf
#      systemd-tmpfiles runs this at boot, setting group ownership + write
#      permission on the sysfs files before the user session starts.
#   2. Applies the permission immediately (no reboot needed).
#
# Requirements: sudo, systemd

set -euo pipefail

TMPFILE=/etc/tmpfiles.d/surface-control.conf
SYSFS=/sys/firmware/acpi/platform_profile
BATTERY_SYSFS_GLOB='/sys/class/power_supply/BAT*/charge_control_end_threshold'

# Detect current user's primary group (works on any distro)
USER_GROUP=$(id -gn)

echo "Setting up write access to $SYSFS for group '$USER_GROUP'..."

sudo tee "$TMPFILE" > /dev/null << EOF
# Surface Control: allow $USER_GROUP to write the platform profile
z $SYSFS 0664 root $USER_GROUP - -
# Surface Control: allow $USER_GROUP to write the battery charge limit
# (glob — no-op on kernels/models without charge_control_end_threshold)
z $BATTERY_SYSFS_GLOB 0664 root $USER_GROUP - -
EOF

sudo systemd-tmpfiles --create "$TMPFILE"

# Verify platform profile (required — fatal if still not writable)
if [ -w "$SYSFS" ]; then
    echo "Done. Platform profile is now writable."
    echo "You can verify with: ls -la $SYSFS"
else
    echo "Warning: $SYSFS is still not writable by the current user."
    echo "You may need to log out and back in, or check that your user"
    echo "is in the '$USER_GROUP' group."
    exit 1
fi

# Verify battery charge limit (optional — kernel support is model-dependent,
# see https://github.com/linux-surface/linux-surface/issues/1580)
shopt -s nullglob
battery_files=($BATTERY_SYSFS_GLOB)
shopt -u nullglob

if [ ${#battery_files[@]} -eq 0 ]; then
    echo "Note: no charge_control_end_threshold file found — this kernel/model"
    echo "does not yet expose battery charge-limit control. Profile switching"
    echo "is unaffected."
elif [ -w "${battery_files[0]}" ]; then
    echo "Done. Battery charge limit is now writable."
else
    echo "Warning: ${battery_files[0]} is still not writable by the current user."
    echo "Battery charge-limit control will show 'Setup required' in the menu."
fi
