#!/bin/bash

# Setup script for Appium Android testing
set -e

echo "Setting up Appium for Android testing..."

# Check if npm/pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed. Please install pnpm first."
    exit 1
fi

# Install Appium if not already installed
if ! command -v appium &> /dev/null; then
    echo "Installing Appium globally..."
    npm install -g appium@latest
else
    echo "Appium is already installed"
fi

# Install UiAutomator2 driver for Android
echo "Installing UiAutomator2 driver..."
appium driver install uiautomator2 || {
    echo "UiAutomator2 driver might already be installed"
    appium driver list
}

# Check if Android SDK is available
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "Warning: ANDROID_HOME or ANDROID_SDK_ROOT is not set"
    echo "Please ensure Android SDK is installed and environment variables are set"
    echo "You can install Android SDK via Android Studio or command line tools"
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p logs/screenshots
mkdir -p logs/appium

# Check Java installation (required for Android)
if ! command -v java &> /dev/null; then
    echo "Warning: Java is not installed or not in PATH"
    echo "Java is required for Android testing"
else
    echo "Java version:"
    java -version
fi

# Verify Appium setup
echo "Verifying Appium setup..."
appium driver list

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
echo "4. Build the Android app: pnpm run cap:build:staging"
echo "5. Build the APK: cd android && ./gradlew assembleDebug"
echo "6. Run tests: pnpm run appium:android"