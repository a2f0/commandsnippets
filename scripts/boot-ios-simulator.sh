#!/bin/sh
# POSIX-compliant script to boot iOS simulator for testing

set -e

echo "Starting iOS simulator boot process..."

# Ensure clean simulator environment
echo "Shutting down any existing simulators..."
xcrun simctl shutdown all || true
sleep 5

# Get UUID of iPhone 15 simulator
echo "Finding iPhone 15 simulator..."
DEVICE_UUID=$(xcrun simctl list devices available | grep "iPhone 15 (" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [ -z "$DEVICE_UUID" ]; then
    echo "Error: iPhone 15 simulator not found"
    xcrun simctl list devices available
    exit 1
fi

echo "Found iPhone 15 simulator with UUID: $DEVICE_UUID"

# Reset simulator to clean state to avoid data migration issues
echo "Resetting simulator to clean state..."
xcrun simctl erase "$DEVICE_UUID" || true
sleep 5

# Boot the simulator
echo "Booting simulator..."
xcrun simctl boot "$DEVICE_UUID"

# Wait for simulator to boot completely (check every 10 seconds, up to 1 minute)
echo "Waiting for simulator to boot completely..."
BOOT_CHECK_COUNT=0
MAX_BOOT_CHECKS=6

while [ $BOOT_CHECK_COUNT -lt $MAX_BOOT_CHECKS ]; do
    BOOT_CHECK_COUNT=$((BOOT_CHECK_COUNT + 1))

    if xcrun simctl list devices | grep "$DEVICE_UUID" | grep -q "Booted"; then
        echo "Simulator is booted after $((BOOT_CHECK_COUNT * 10)) seconds"
        # Wait additional time for services to be ready
        echo "Allowing additional 20 seconds for services to fully initialize..."
        sleep 20
        echo "Simulator is ready for testing"
        exit 0
    fi

    if [ $BOOT_CHECK_COUNT -eq $MAX_BOOT_CHECKS ]; then
        echo "Error: Simulator failed to boot within 1 minute"
        xcrun simctl list devices | grep "$DEVICE_UUID"
        exit 1
    fi

    echo "Still waiting for boot (attempt $BOOT_CHECK_COUNT/$MAX_BOOT_CHECKS)..."
    sleep 10
done
