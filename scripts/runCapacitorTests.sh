#!/bin/sh
set -eu

usage() {
  echo "Usage: $0 <android|ios> [all|build|test]" >&2
  exit 2
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  usage
fi

platform=$1
phase=${2:-all}

case "$platform" in
  android | ios) ;;
  *) usage ;;
esac

case "$phase" in
  all | build | test) ;;
  *) usage ;;
esac

script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
repository_directory=$(dirname "$script_directory")
frontend_directory="$repository_directory/frontend"
development_server_pid=""

cleanup_development_server() {
  if [ -n "$development_server_pid" ]; then
    kill "$development_server_pid" 2>/dev/null || true
  fi
}
trap cleanup_development_server EXIT HUP INT TERM

prepare_directories() {
  mkdir -p "$frontend_directory/logs/screenshots"
  mkdir -p "$frontend_directory/logs/appium"
}

build_web_app() {
  (
    cd "$frontend_directory"
    pnpm run build
    pnpm exec cap sync
  )
}

start_development_server() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is required but was not found in PATH" >&2
    exit 1
  fi

  (
    cd "$frontend_directory"
    pnpm run dev
  ) &
  development_server_pid=$!

  server_check_count=0
  until curl --fail --silent --show-error http://localhost:8085 >/dev/null; do
    server_check_count=$((server_check_count + 1))
    if [ "$server_check_count" -ge 30 ]; then
      echo "ERROR: Development server did not start within 30 seconds" >&2
      exit 1
    fi
    sleep 1
  done
}

build_android_app() {
  build_web_app
  (
    cd "$frontend_directory/android"
    ./gradlew assembleDevelopmentDebug --no-daemon
  )

  apk_path="$frontend_directory/android/app/build/outputs/apk/development/debug/app-development-debug.apk"
  if [ ! -f "$apk_path" ]; then
    echo "ERROR: Android APK was not created at $apk_path" >&2
    find "$frontend_directory/android" -name '*.apk' -type f -print
    exit 1
  fi

  echo "SUCCESS: Android APK created at $apk_path"
  ls -lh "$apk_path"
}

test_android_app() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "ERROR: adb is required but was not found in PATH" >&2
    exit 1
  fi

  echo "Waiting for the Android emulator to boot"
  adb wait-for-device shell \
    "while [ -z \"\$(getprop sys.boot_completed | tr -d '\\r')\" ]; do sleep 1; done"
  adb devices -l

  (
    cd "$frontend_directory"
    pnpm run appium:android
  )
}

build_ios_app() {
  build_web_app
  (
    cd "$frontend_directory/ios/App"
    pod install --verbose
  )

  derived_data_path=${DERIVED_DATA_PATH:-$frontend_directory/ios/App/build}
  case "$derived_data_path" in
    / | "$repository_directory" | "$frontend_directory" | \
      "$frontend_directory/ios" | "$frontend_directory/ios/App")
      echo "ERROR: Refusing unsafe DERIVED_DATA_PATH: $derived_data_path" >&2
      exit 1
      ;;
  esac

  rm -rf -- "$derived_data_path"
  xcodebuild build \
    -workspace "$frontend_directory/ios/App/App.xcworkspace" \
    -scheme App \
    -configuration Release \
    -sdk iphonesimulator \
    -derivedDataPath "$derived_data_path" \
    -allowProvisioningUpdates \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    ARCHS="x86_64 arm64" \
    VALID_ARCHS="x86_64 arm64" \
    ONLY_ACTIVE_ARCH=NO

  app_path="$derived_data_path/Build/Products/Release-iphonesimulator/App.app"
  if [ ! -d "$app_path" ]; then
    echo "ERROR: iOS app was not created at $app_path" >&2
    find "$derived_data_path" -name '*.app' -type d -print
    exit 1
  fi

  echo "SUCCESS: iOS app created at $app_path"
  ls -la "$derived_data_path/Build/Products/Release-iphonesimulator"
}

test_ios_app() {
  "$frontend_directory/scripts/boot-ios-simulator.sh"
  simulator_settle_seconds=${CAPACITOR_SIMULATOR_SETTLE_SECONDS:-30}
  echo "Waiting $simulator_settle_seconds seconds for the simulator to settle"
  sleep "$simulator_settle_seconds"
  (
    cd "$frontend_directory"
    pnpm run appium:ios
  )
}

prepare_directories

case "$platform:$phase" in
  android:all)
    start_development_server
    build_android_app
    test_android_app
    ;;
  android:build) build_android_app ;;
  android:test) test_android_app ;;
  ios:all)
    build_ios_app
    test_ios_app
    ;;
  ios:build) build_ios_app ;;
  ios:test) test_ios_app ;;
esac
