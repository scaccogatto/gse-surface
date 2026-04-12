#!/usr/bin/env bash
# Surface Control — one-time setup script
# Grants the current user write access to /sys/firmware/acpi/platform_profile
# so the GNOME Shell extension can switch power profiles without sudo.
#
# What this does:
#   1. Creates /etc/tmpfiles.d/surface-control.conf
#      systemd-tmpfiles runs this at boot, setting group ownership + write
#      permission on the sysfs file before the user session starts.
#   2. Applies the permission immediately (no reboot needed).
#
# Requirements: sudo, systemd

set -euo pipefail

TMPFILE=/etc/tmpfiles.d/surface-control.conf
SYSFS=/sys/firmware/acpi/platform_profile

# Detect current user's primary group (works on any distro)
USER_GROUP=$(id -gn)

echo "Setting up write access to $SYSFS for group '$USER_GROUP'..."

sudo tee "$TMPFILE" > /dev/null << EOF
# Surface Control: allow $USER_GROUP to write the platform profile
z $SYSFS 0664 root $USER_GROUP - -
EOF

sudo systemd-tmpfiles --create "$TMPFILE"

# Verify
if [ -w "$SYSFS" ]; then
    echo "Done. Platform profile is now writable."
    echo "You can verify with: ls -la $SYSFS"
else
    echo "Warning: $SYSFS is still not writable by the current user."
    echo "You may need to log out and back in, or check that your user"
    echo "is in the '$USER_GROUP' group."
    exit 1
fi
