#!/bin/sh
# Builds the extensions.gnome.org submission zip from the source tree.
# Single source of truth for the zip contents: used by CI, the release
# workflow and the docs. Every top-level module (*.js) is included
# automatically, so a new module cannot be forgotten.
#
# Usage: scripts/pack.sh [output-zip]
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
UUID=surface-control@scaccogatto.github.com
EXT_DIR="$ROOT/$UUID"
ZIP_PATH=${1:-"$ROOT/$UUID.shell-extension.zip"}

case "$ZIP_PATH" in
    /*) ;;
    *) ZIP_PATH="$PWD/$ZIP_PATH" ;;
esac

rm -f "$ZIP_PATH"
cd "$EXT_DIR"
zip -r -X "$ZIP_PATH" metadata.json ./*.js LICENSE icons/
echo "Built $ZIP_PATH"
