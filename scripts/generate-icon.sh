#!/bin/sh
set -e

# Generate icon.png from favicon.svg for electron-builder
echo "Generating icon.png from favicon.svg..."

# Create build directory if it doesn't exist
mkdir -p build

# Check if ImageMagick is installed
if command -v magick >/dev/null 2>&1; then
    # ImageMagick 7
    magick public/favicon.svg -background none -resize 512x512 build/icon.png
elif command -v convert >/dev/null 2>&1; then
    # ImageMagick 6
    convert -background none -resize 512x512 public/favicon.svg build/icon.png
else
    echo "Warning: ImageMagick not found. Using fallback icon generation."
    # Fallback: just copy the SVG (electron-builder will fail but at least we tried)
    cp public/favicon.svg build/icon.svg
    echo "Please install ImageMagick to properly generate icons: brew install imagemagick"
    exit 1
fi

echo "Icon generated successfully at build/icon.png"
