#!/bin/sh
set -e

# Generate icon.png from favicon.svg for electron-builder
echo "Generating icon.png from favicon.svg..."

# Create build directory if it doesn't exist
mkdir -p build

# Check if ImageMagick is installed
if command -v magick >/dev/null 2>&1; then
    # ImageMagick 7
    magick "public/favicon.svg" -background none -resize 512x512 "build/icon.png"
elif command -v convert >/dev/null 2>&1; then
    # ImageMagick 6
    convert -background none -resize 512x512 "public/favicon.svg" "build/icon.png"
else
    echo "Error: ImageMagick is not installed, but it is required to generate the application icon." >&2
    echo "Please install ImageMagick to continue." >&2
    echo "For installation instructions, visit: https://imagemagick.org/script/download.php" >&2
    exit 1
fi

echo "Icon generated successfully at build/icon.png"
