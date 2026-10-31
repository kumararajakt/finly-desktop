#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_ID="com.kumar.finly-desktop"
BUILD_DIR="$ROOT_DIR/build/flatpak"
REPO_DIR="$ROOT_DIR/build/flatpak-repo"
OUTPUT_DIR="$ROOT_DIR/dist-flatpak"
BUNDLE_FILE="$OUTPUT_DIR/finly-desktop.flatpak"

echo "=== Finly Desktop Flatpak Packaging ==="

# 1. Ensure release binary is compiled with embedded assets
if [ ! -f "src-tauri/target/release/finly-desktop" ] || [ "${REBUILD:-false}" = "true" ]; then
  echo "--> Compiling release binary with embedded assets..."
  bun run tauri build --no-bundle
fi

# 2. Prepare staging directories
echo "--> Setting up Flatpak staging environment..."
rm -rf "$BUILD_DIR" "$REPO_DIR"
mkdir -p "$BUILD_DIR/files/bin"
mkdir -p "$BUILD_DIR/files/share/applications"
mkdir -p "$BUILD_DIR/files/share/metainfo"
mkdir -p "$BUILD_DIR/files/share/icons/hicolor/32x32/apps"
mkdir -p "$BUILD_DIR/files/share/icons/hicolor/128x128/apps"
mkdir -p "$BUILD_DIR/files/share/icons/hicolor/512x512/apps"
mkdir -p "$OUTPUT_DIR"

# 3. Copy application binary and assets
install -m 755 "src-tauri/target/release/finly-desktop" "$BUILD_DIR/files/bin/finly-desktop"
install -m 644 "flatpak/$APP_ID.desktop" "$BUILD_DIR/files/share/applications/$APP_ID.desktop"
install -m 644 "flatpak/$APP_ID.metainfo.xml" "$BUILD_DIR/files/share/metainfo/$APP_ID.metainfo.xml"
install -m 644 "src-tauri/icons/32x32.png" "$BUILD_DIR/files/share/icons/hicolor/32x32/apps/$APP_ID.png"
install -m 644 "src-tauri/icons/128x128.png" "$BUILD_DIR/files/share/icons/hicolor/128x128/apps/$APP_ID.png"
install -m 644 "src-tauri/icons/icon.png" "$BUILD_DIR/files/share/icons/hicolor/512x512/apps/$APP_ID.png"

# 4. Create metadata
cat << EOF > "$BUILD_DIR/metadata"
[Application]
name=$APP_ID
runtime=org.gnome.Platform/x86_64/49
sdk=org.gnome.Sdk/x86_64/49
command=finly-desktop

[Context]
shared=network;ipc;
sockets=x11;wayland;fallback-x11;
devices=dri;
filesystems=xdg-download;
EOF

# 5. Initialize OSTree repository
echo "--> Initializing local OSTree repository..."
ostree init --mode=archive --repo="$REPO_DIR"

# 6. Finalize build metadata
echo "--> Finalizing Flatpak build..."
flatpak build-finish "$BUILD_DIR" \
  --command=finly-desktop \
  --share=ipc \
  --share=network \
  --socket=x11 \
  --socket=wayland \
  --socket=fallback-x11 \
  --device=dri \
  --filesystem=xdg-download

# 7. Export to local repository
echo "--> Exporting build to repository..."
flatpak build-export "$REPO_DIR" "$BUILD_DIR" master

# 8. Create standalone .flatpak single-file bundle
echo "--> Creating standalone Flatpak bundle package..."
flatpak build-bundle "$REPO_DIR" "$BUNDLE_FILE" "$APP_ID" master

# 9. Clean up staging cache
rm -rf "$BUILD_DIR" "$REPO_DIR"

echo "=========================================="
echo "Flatpak package bundle successfully created!"
echo "Package File: $BUNDLE_FILE"
echo "Package Size: $(du -h "$BUNDLE_FILE" | cut -f1)"
echo "App ID:       $APP_ID"
echo "Checksum:     $(sha256sum "$BUNDLE_FILE" | cut -d' ' -f1)"
echo "=========================================="
echo "Note: The package has NOT been installed."
echo "If you want to install it later, run:"
echo "  flatpak install --user $BUNDLE_FILE"
