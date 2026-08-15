#!/bin/sh

# Script to manage GitHub Actions self-hosted runner safely
# This helps prevent CI from interfering with local development

# Configurable paths - modify these variables to match your setup
RUNNER_DIR="${RUNNER_DIR:-$HOME/github/actions-runner}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-/tmp/ci-ios-build}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$RUNNER_DIR/_work/tearleads-frontend/tearleads-frontend}"
PID_FILE="${PID_FILE:-/tmp/gh-runner.pid}"

ACTION="${1:-status}"

case "$ACTION" in
  start)
    echo "Starting GitHub Actions runner in isolated mode..."
    # Set environment variables to isolate CI builds
    CI_MODE=true
    export DERIVED_DATA_PATH CI_MODE

    # Start the runner
    cd "$RUNNER_DIR" || exit 1
    ./run.sh &
    echo $! > "$PID_FILE"
    echo "Runner started with PID $(cat "$PID_FILE")"
    ;;

  stop)
    echo "Stopping GitHub Actions runner..."
    # Find and kill runner process using PID file
    if [ -f "$PID_FILE" ]; then
      pid=$(cat "$PID_FILE")
      # Verify the process is the runner before killing to avoid affecting a reused PID.
      if ps -p "$pid" -o command= | grep -q "Runner.Listener"; then
        kill "$pid"
        echo "Runner with PID $pid stopped."
      else
        echo "Warning: Stale PID file. PID $pid is not the runner. Falling back to pkill."
        pkill -f "Runner.Listener"
      fi
      rm "$PID_FILE"
    else
      # Fallback if pid file is missing
      pkill -f "Runner.Listener"
      echo "Runner stopped using pkill (PID file not found)."
    fi

    # Clean up CI build artifacts
    rm -rf "$DERIVED_DATA_PATH"
    rm -rf "$WORKSPACE_DIR/ios/App/build"

    # Shutdown any CI simulators
    xcrun simctl list | grep "CI" | grep -o "[0-9A-F-]*" | while read -r device_id; do
      if [ -n "$device_id" ]; then
        xcrun simctl shutdown "$device_id" 2>/dev/null || true
      fi
    done

    echo "Runner stopped and CI artifacts cleaned"
    ;;

  status)
    if pgrep -f "Runner.Listener" > /dev/null 2>&1; then
      echo "OK: GitHub Actions runner is running"
      printf "PID: "
      pgrep -f 'Runner.Listener'
    else
      echo "NOT RUNNING: GitHub Actions runner is not running"
    fi

    # Check for CI simulators
    if xcrun simctl list | grep -q "CI"; then
      echo "WARNING: CI simulators found:"
      xcrun simctl list | grep "CI"
    fi

    # Check for CI build artifacts
    if [ -d "$DERIVED_DATA_PATH" ] || [ -d "$RUNNER_DIR/_work" ]; then
      echo "WARNING: CI build artifacts present"
    fi
    ;;

  clean)
    echo "Cleaning all CI artifacts..."
    rm -rf "$DERIVED_DATA_PATH"
    rm -rf "$WORKSPACE_DIR"
    rm -rf "$PID_FILE"

    # Delete CI simulators
    xcrun simctl list | grep "CI" | grep -o "[0-9A-F-]*" | while read -r device_id; do
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
