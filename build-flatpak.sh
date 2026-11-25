#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Flatpak reserves /run/host and refuses to share paths under it with the sandbox
SCRIPT_DIR="${SCRIPT_DIR#/run/host}"
cd "$SCRIPT_DIR"

MANIFEST="com.kumar.finly.json"
BUILD_DIR="build-flatpak"
REPO_DIR="flatpak-repo"
BUNDLE_FILE="finly-kde.flatpak"
APP_ID="com.kumar.finly"

flatpak-builder --force-clean --repo="$REPO_DIR" "$BUILD_DIR" "$MANIFEST"
flatpak build-bundle "$REPO_DIR" "$BUNDLE_FILE" "$APP_ID"

echo "Built Flatpak package: $SCRIPT_DIR/$BUNDLE_FILE"
