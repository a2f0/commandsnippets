#!/bin/bash

# Setup script for Appium iOS testing
# This script prepares everything needed to run Appium tests on iOS simulator

set -e

echo "Setting up Appium iOS testing environment..."

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "ERROR: Xcode is not installed. Please install Xcode from the App Store."
    exit 1
fi

# Check if iOS Simulator is available
if ! xcrun simctl list devices | grep "iPhone 15" &> /dev/null; then
    echo "WARNING: iPhone 15 simulator not found. You may need to install iOS 17.0 simulator."
    echo "   Open Xcode → Preferences → Components and install iOS 17.0 Simulator"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p logs/screenshots logs/appium

# Build the dev app
echo "Building dev app..."
pnpm cap sync

# Build iOS app for simulator
echo "Building iOS app for simulator..."
cd ios/App

# Clean build directory first
rm -rf build

# Clean and build for simulator
xcodebuild clean -workspace App.xcworkspace -scheme App -configuration Release

xcodebuild build \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath build \
  -allowProvisioningUpdates \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  ARCHS="x86_64 arm64" \
  VALID_ARCHS="x86_64 arm64" \
  ONLY_ACTIVE_ARCH=NO

cd ../..

# Verify build output
echo "Verifying build output..."
APP_PATH="ios/App/build/Build/Products/Release-iphonesimulator/App.app"
if [ -d "$APP_PATH" ]; then
    echo "SUCCESS: App.app found at expected location"
    ls -lh "$APP_PATH"
else
    echo "ERROR: App.app not found at expected location!"
    echo "Searching for App.app..."
    find ios/App/build -name "*.app" -type d 2>/dev/null || echo "No .app bundles found"
    exit 1
fi

echo "Setup complete!"
echo ""
echo "You can now run Appium tests with:"
echo "   pnpm run appium:ios"
echo ""
echo "Or build and test in one command:"
echo "   pnpm run appium:build-and-test"
echo ""
echo "Check logs and screenshots in:"
echo "   logs/appium/     (test logs)"
echo "   logs/screenshots/ (test screenshots)"
