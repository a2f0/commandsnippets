#!/bin/bash

# Setup script for Appium Android testing
set -euo pipefail

echo "Setting up Appium for Android testing..."

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if npm/pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed. Please install pnpm first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ pnpm is available${NC}"

# Verify Appium is available from devDependencies
echo "Verifying local Appium installation..."
if pnpm exec appium --version &> /dev/null; then
    echo -e "${GREEN}✓ Local Appium is available ($(pnpm exec appium --version))${NC}"
else
    echo -e "${RED}✗ Local Appium not found. Please run 'pnpm install' first${NC}"
    exit 1
fi

# Install UiAutomator2 driver for Android
echo "Installing UiAutomator2 driver..."
if pnpm exec appium driver list 2>&1 | grep -w "uiautomator2" | grep -q "installed"; then
    echo -e "${GREEN}✓ UiAutomator2 driver is already installed${NC}"
elif pnpm exec appium driver install uiautomator2 2>/dev/null; then
    echo -e "${GREEN}✓ UiAutomator2 driver installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install UiAutomator2 driver${NC}"
    pnpm exec appium driver list
    exit 1
fi

# Check if Android SDK is available
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    echo -e "${YELLOW}⚠ Warning: ANDROID_HOME or ANDROID_SDK_ROOT is not set${NC}"
    echo "Please ensure Android SDK is installed and environment variables are set"
    echo "You can install Android SDK via Android Studio or command line tools"
else
    echo -e "${GREEN}✓ Android SDK environment variables are set${NC}"
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p logs/screenshots logs/appium
echo -e "${GREEN}✓ Created logs directories${NC}"

# Check Java installation (required for Android)
if ! command -v java &> /dev/null; then
    echo -e "${YELLOW}⚠ Warning: Java is not installed or not in PATH${NC}"
    echo "Java is required for Android testing"
else
    echo -e "${GREEN}✓ Java is available${NC}"
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
echo "4. Build the Android app: pnpm run cap:build:staging"
echo "5. Build the APK: cd android && ./gradlew assembleDebug"
echo "6. Run tests: pnpm run appium:android"
