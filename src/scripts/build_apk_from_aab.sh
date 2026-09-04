#!/usr/bin/env bash
#
# build_apk_from_aab.sh — Sideload a Base44-generated AAB onto an Android device
# WITHOUT the Play Store.
#
# Two modes:
#
#  1) Per-device sideload (DEFAULT, smallest):
#       bash scripts/build_apk_from_aab.sh ~/Downloads/app-release.aab
#     Needs the phone connected over USB with USB debugging on. bundletool
#     inspects the device and installs ONLY the splits it needs (arm64-v8a on
#     most modern phones), so the installed size is typically 45-60MB instead
#     of the ~124MB universal file. No Play Store required.
#
#  2) Single universal APK file (opt-in, larger ~120MB+):
#       bash scripts/build_apk_from_aab.sh --universal ~/Downloads/app-release.aab
#     Produces one self-contained .apk you can copy to the phone and tap in a
#     file manager. It is large because it bundles native libs for ALL CPU
#     architectures (arm64, armv7, x86, x86_64); that's why it can't easily go
#     below ~120MB — Base44's AAB controls which ABIs ship.
#
# Requires: Java 11+ and `adb` (Android Platform Tools). bundletool.jar is
# downloaded automatically on first run.

set -euo pipefail

UNIVERSAL=0
AAB_PATH=""

for arg in "$@"; do
  case "$arg" in
    --universal) UNIVERSAL=1 ;;
    -*) echo "Unknown flag: $arg"; exit 1 ;;
    *) AAB_PATH="$arg" ;;
  esac
done

if [[ -z "$AAB_PATH" || ! -f "$AAB_PATH" ]]; then
  echo "Usage: bash scripts/build_apk_from_aab.sh [--universal] <path-to-app.aab>"
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

if [[ "$UNIVERSAL" -eq 1 ]]; then
  echo "Building universal APKS from AAB..."
  java -jar "$BUNDLETOOL_JAR" build-apks \
    --bundle="$AAB_PATH" \
    --output="$APKS_PATH" \
    --mode=universal
  APK_PATH="$BUILD_DIR/app-universal-release.apk"
  echo "Extracting universal APK..."
  unzip -o -q "$APKS_PATH" "universal.apk" -d "$BUILD_DIR"
  mv "$BUILD_DIR/universal.apk" "$APK_PATH"
  echo ""
  echo "✅ Sideloadable universal APK ready:"
  echo "   $APK_PATH"
  echo ""
  echo "Install via ADB (preferred):"
  echo "   adb install -r \"$APK_PATH\""
  echo "Or copy to the phone and open in a file manager"
  echo "(enable 'Install unknown apps' for that file manager first)."
  echo ""
  echo "NOTE: this single file is ~124MB because it includes native libs for"
  echo "every CPU architecture. For a much smaller install, omit --universal"
  echo "and sideload per-device instead (see mode 1 above)."
else
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found. Install Android Platform Tools and add it to PATH,"
    echo "or pass --universal to produce a single (larger) sideloadable APK."
    exit 1
  fi
  if ! adb get-state >/dev/null 2>&1; then
    echo "No Android device detected over ADB. Connect the phone over USB,"
    echo "enable USB debugging, then re-run — or use --universal for a single"
    echo "self-contained APK file."
    exit 1
  fi
  echo "Connected device: $(adb get-state)"
  # Specs the connected device so bundletool builds ONLY the splits it needs.
  DEVICE_SPEC="$BUILD_DIR/device-spec.json"
  java -jar "$BUNDLETOOL_JAR" get-device-spec --serial=$(adb get-serialno) --output="$DEVICE_SPEC"
  echo "Building device-specific APKS (only matching splits)..."
  java -jar "$BUNDLETOOL_JAR" build-apks \
    --bundle="$AAB_PATH" \
    --output="$APKS_PATH" \
    --device-spec="$DEVICE_SPEC"
  echo "Sideloading matching splits onto the device..."
  java -jar "$BUNDLETOOL_JAR" install-apks --apks="$APKS_PATH"
  echo ""
  echo "✅ Done. The app is now installed on the connected device with only the"
  echo "   splits it needs — far smaller than the universal APK, no Play Store."
fi