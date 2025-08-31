#!/bin/sh

# Android Appium Test Runner Script
# POSIX-compliant script for CI/CD environments

set -e  # Exit on any error

echo "Starting Android Appium test execution..."

# Wait for emulator to fully boot
echo "Waiting for Android emulator to boot..."
adb wait-for-device shell 'while [ -z "$(getprop sys.boot_completed | tr -d "\r")" ]; do sleep 1; done'

# Verify emulator is ready
echo "Android emulator is ready. Device list:"
adb devices -l

# Run the Appium tests
echo "Running Android Appium tests..."
pnpm run appium:android

echo "Android Appium tests completed successfully!"