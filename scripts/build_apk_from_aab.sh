#!/usr/bin/env bash
#
# build_apk_from_aab.sh — Convert a Base44-generated AAB into a sideloadable
# universal APK you can install directly on an Android device (no Play Store).
#
# Usage:
#   1. In the Base44 editor: Publish → Mobile app → Build Store Files →
#      Create Google Play files → Download the .aab
#   2. Run this script with the AAB path:
#        bash scripts/build_apk_from_aab.sh ~/Downloads/app-release.aab
#   3. Sideload the result on your device:
#        adb install -r build/app-universal-release.apk
#      (or copy the .apk to the phone and tap it in a file manager, with
#       "Install unknown apps" enabled for that file manager).
#
# Requires: Java 11+ and `adb` (Android Platform Tools) for install.
# bundletool.jar is downloaded automatically on first run.

set -euo pipefail

AAB_PATH="${1:-}"
if [[ -z "$AAB_PATH" || ! -f "$AAB_PATH" ]]; then
  echo "Usage: bash scripts/build_apk_from_aab.sh <path-to-app.aab>"
  exit 1
fi

BUILD_DIR="$(pwd)/build"
mkdir -p "$BUILD_DIR"

BUNDLETOOL_JAR="$BUILD_DIR/bundletool.jar"
BUNDLETOOL_VERSION="1.17.2"
if [[ ! -f "$BUNDLETOOL_JAR" ]]; then
  echo "Downloading bundletool $BUNDLETOOL_VERSION..."
  curl -L -o "$BUNDLETOOL_JAR" \
    "https://github.com/google/bundletool/releases/download/$BUNDLETOOL_VERSION/bundletool-all-$BUNDLETOOL_VERSION.jar"
fi

APKS_PATH="$BUILD_DIR/app.apks"
echo "Building universal APKS from AAB..."
java -jar "$BUNDLETOOL_JAR" build-apks \
  --bundle="$AAB_PATH" \
  --output="$APKS_PATH" \
  --mode=universal

# An .apks is a zip; the universal APK lives inside as universal.apk.
APK_PATH="$BUILD_DIR/app-universal-release.apk"
echo "Extracting universal APK..."
unzip -o -q "$APKS_PATH" "universal.apk" -d "$BUILD_DIR"
mv "$BUILD_DIR/universal.apk" "$APK_PATH"

echo ""
echo "✅ Sideloadable APK ready:"
echo "   $APK_PATH"
echo ""
echo "To install on a connected device via ADB:"
echo "   adb install -r \"$APK_PATH\""
echo ""
echo "Or copy the file to your phone and open it in a file manager"
echo "(enable 'Install unknown apps' for that file manager first)."