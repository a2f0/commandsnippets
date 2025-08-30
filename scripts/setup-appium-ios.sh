#!/bin/bash

# Setup script for Appium iOS testing
# This script prepares everything needed to run Appium tests on iOS simulator

set -e

echo "🚀 Setting up Appium iOS testing environment..."

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store."
    exit 1
fi

# Check if iOS Simulator is available
if ! xcrun simctl list devices | grep "iPhone 15" &> /dev/null; then
    echo "⚠️ iPhone 15 simulator not found. You may need to install iOS 17.0 simulator."
    echo "   Open Xcode → Preferences → Components and install iOS 17.0 Simulator"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs/screenshots logs/appium

# Build the staging app
echo "🔨 Building staging app..."
pnpm run cap:build:staging

# Build iOS app for simulator
echo "📱 Building iOS app for simulator..."
cd ios/App

# Clean and build for simulator
xcodebuild clean -workspace App.xcworkspace -scheme App -configuration Release

xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath build \
  BUILD_DIR=build/Build/Products

cd ../..

echo "✅ Setup complete!"
echo ""
echo "🧪 You can now run Appium tests with:"
echo "   pnpm run appium:ios"
echo ""
echo "📱 Or build and test in one command:"
echo "   pnpm run appium:build-and-test"
echo ""
echo "🔍 Check logs and screenshots in:"
echo "   logs/appium/     (test logs)"
echo "   logs/screenshots/ (test screenshots)"
