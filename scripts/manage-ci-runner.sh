#!/bin/sh

# Script to manage GitHub Actions self-hosted runner safely
# This helps prevent CI from interfering with local development

ACTION="${1:-status}"

case "$ACTION" in
  start)
    echo "Starting GitHub Actions runner in isolated mode..."
    # Set environment variables to isolate CI builds
    DERIVED_DATA_PATH="/tmp/ci-ios-build"
    CI_MODE=true
    export DERIVED_DATA_PATH CI_MODE

    # Start the runner
    cd "$HOME/github/actions-runner" || exit 1
    ./run.sh &
    echo "Runner started with PID $!"
    ;;

  stop)
    echo "Stopping GitHub Actions runner..."
    # Find and kill runner process
    pkill -f "Runner.Listener"

    # Clean up CI build artifacts
    rm -rf /tmp/ci-ios-build
    rm -rf "$HOME/github/actions-runner/_work/tearleads-frontend/tearleads-frontend/ios/App/build"

    # Shutdown any CI simulators
    xcrun simctl list | grep "CI" | grep -o "[0-9A-F-]*" | head -1 | while read -r device_id; do
      if [ -n "$device_id" ]; then
        xcrun simctl shutdown "$device_id" 2>/dev/null || true
      fi
    done

    echo "Runner stopped and CI artifacts cleaned"
    ;;

  status)
    if pgrep -f "Runner.Listener" > /dev/null 2>&1; then
      echo "✅ GitHub Actions runner is running"
      printf "PID: "
      pgrep -f 'Runner.Listener'
    else
      echo "❌ GitHub Actions runner is not running"
    fi

    # Check for CI simulators
    if xcrun simctl list | grep -q "CI"; then
      echo "⚠️  CI simulators found:"
      xcrun simctl list | grep "CI"
    fi

    # Check for CI build artifacts
    if [ -d "/tmp/ci-ios-build" ] || [ -d "$HOME/github/actions-runner/_work" ]; then
      echo "⚠️  CI build artifacts present"
    fi
    ;;

  clean)
    echo "Cleaning all CI artifacts..."
    rm -rf /tmp/ci-ios-build
    rm -rf "$HOME/github/actions-runner/_work/tearleads-frontend/tearleads-frontend/ios/App/build"
    rm -rf "$HOME/github/actions-runner/_work/tearleads-frontend/tearleads-frontend/logs"

    # Delete CI simulators
    xcrun simctl list | grep "CI" | grep -o "[0-9A-F-]*" | head -1 | while read -r device_id; do
      if [ -n "$device_id" ]; then
        xcrun simctl delete "$device_id" 2>/dev/null || true
      fi
    done

    echo "CI artifacts cleaned"
    ;;

  *)
    echo "Usage: $0 {start|stop|status|clean}"
    echo ""
    echo "  start  - Start runner with isolation settings"
    echo "  stop   - Stop runner and clean up"
    echo "  status - Check runner and CI artifact status"
    echo "  clean  - Remove all CI artifacts"
    exit 1
    ;;
esac
