#!/bin/sh
# POSIX-compliant script to boot iOS simulator for testing

set -e

echo "Starting iOS simulator boot process..."

# Ensure clean simulator environment
echo "Shutting down any existing simulators..."
xcrun simctl shutdown all || true
sleep 5

# Get the UUID of the simulator used by the Appium configuration.
PLATFORM_VERSION=${SIMULATOR_PLATFORM_VERSION:-18.5}
DEVICE_NAME=${SIMULATOR_DEVICE_NAME:-iPhone 16}

find_device_uuid() {
    xcrun simctl list devices available | awk \
        -v runtime="-- iOS $PLATFORM_VERSION --" \
        -v device="$1" '
            $0 == runtime { in_runtime = 1; next }
            /^-- / { in_runtime = 0 }
            in_runtime && index($0, "    " device " (") == 1 {
                uuid = $(NF - 1)
                gsub(/[()]/, "", uuid)
                print uuid
                exit
            }
        '
}

echo "Finding $DEVICE_NAME simulator with iOS $PLATFORM_VERSION..."
DEVICE_UUID=$(find_device_uuid "$DEVICE_NAME")

if [ -z "$DEVICE_UUID" ]; then
    echo "$DEVICE_NAME not found, trying iPhone 15..."
    DEVICE_NAME="iPhone 15"
    DEVICE_UUID=$(find_device_uuid "$DEVICE_NAME")
fi

if [ -z "$DEVICE_UUID" ]; then
    echo "Error: No compatible iPhone simulator found for iOS $PLATFORM_VERSION"
    xcrun simctl list devices available
    exit 1
fi

echo "Found $DEVICE_NAME simulator with UUID: $DEVICE_UUID"

# Reset simulator to clean state to avoid data migration issues
echo "Resetting simulator to clean state..."
xcrun simctl erase "$DEVICE_UUID" || true
sleep 5

# Boot the simulator
echo "Booting simulator..."
xcrun simctl boot "$DEVICE_UUID"

# Wait for simulator to boot completely (check every 10 seconds, up to 3 minutes)
echo "Waiting for simulator to boot completely..."
BOOT_CHECK_COUNT=0
MAX_BOOT_CHECKS=18

while [ $BOOT_CHECK_COUNT -lt $MAX_BOOT_CHECKS ]; do
    BOOT_CHECK_COUNT=$((BOOT_CHECK_COUNT + 1))

    if xcrun simctl list devices | grep "$DEVICE_UUID" | grep -q "Booted"; then
        echo "Simulator is booted after $((BOOT_CHECK_COUNT * 10)) seconds"
        echo "Waiting for CoreSimulator services to finish booting..."
        xcrun simctl bootstatus "$DEVICE_UUID" -b
        # Wait additional time for services to be ready
        echo "Allowing additional 20 seconds for services to fully initialize..."
        sleep 20
        echo "Simulator is ready for testing"
        exit 0
    fi

    if [ $BOOT_CHECK_COUNT -eq $MAX_BOOT_CHECKS ]; then
        echo "Error: Simulator failed to boot within 3 minutes"
        xcrun simctl list devices | grep "$DEVICE_UUID"
        exit 1
    fi

    echo "Still waiting for boot (attempt $BOOT_CHECK_COUNT/$MAX_BOOT_CHECKS)..."
    sleep 10
done
