#!/bin/bash

# Setup script for Appium Android testing
set -euo pipefail

echo "Setting up Appium for Android testing..."

# Check if npm/pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "ERROR: pnpm is not installed. Please install pnpm first."
    exit 1
fi
echo "OK: pnpm is available"

# Verify Appium is available from devDependencies
echo "Verifying local Appium installation..."
if pnpm exec appium --version &> /dev/null; then
    echo "OK: Local Appium is available ($(pnpm exec appium --version))"
else
    echo "ERROR: Local Appium not found. Please run 'pnpm install' first"
    exit 1
fi

# Install UiAutomator2 driver for Android
echo "Installing UiAutomator2 driver..."
if pnpm exec appium driver list 2>&1 | grep -w "uiautomator2" | grep -q "installed"; then
    echo "OK: UiAutomator2 driver is already installed"
elif pnpm exec appium driver install uiautomator2 2>/dev/null; then
    echo "OK: UiAutomator2 driver installed successfully"
else
    echo "ERROR: Failed to install UiAutomator2 driver"
    pnpm exec appium driver list
    exit 1
fi

# Check if Android SDK is available
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    echo "WARNING: ANDROID_HOME or ANDROID_SDK_ROOT is not set"
    echo "Please ensure Android SDK is installed and environment variables are set"
    echo "You can install Android SDK via Android Studio or command line tools"
else
    echo "OK: Android SDK environment variables are set"
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p logs/screenshots logs/appium
echo "OK: Created logs directories"

# Check Java installation (required for Android)
if ! command -v java &> /dev/null; then
    echo "WARNING: Java is not installed or not in PATH"
    echo "Java is required for Android testing"
else
    echo "OK: Java is available"
    echo "Java version:"
    java -version 2>&1 | head -1
fi

# Verify Appium setup
echo "Verifying Appium setup..."
pnpm exec appium driver list

# Check for Android emulator
if command -v emulator &> /dev/null; then
    echo "Available Android emulators:"
    emulator -list-avds
else
    echo "Android emulator command not found"
    echo "Make sure Android SDK tools are in your PATH"
fi

# Check for ADB
if command -v adb &> /dev/null; then
    echo "ADB devices:"
    adb devices
else
    echo "ADB not found. Please ensure Android SDK platform-tools are in your PATH"
fi

echo ""
echo "Setup complete! Next steps:"
echo "1. Ensure Android SDK is installed and ANDROID_HOME is set"
echo "2. Create an Android emulator (AVD) using Android Studio or command line"
echo "3. Start the emulator: emulator -avd <your-avd-name>"
echo "4. Build the dev web app: pnpm run build"
echo "5. Sync Capacitor: npx cap sync"
echo "6. Build the APK: cd android && ./gradlew assembleDevelopmentDebug"
echo "7. Run tests: pnpm run appium:android"
