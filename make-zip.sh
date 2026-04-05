#!/bin/bash

# Define the plugin name and version (optional, but good for filenames)
PLUGIN_NAME="fsbhoa-calendar"
TIMESTAMP=$(date +%Y%m%d_%H%M)
ZIP_FILE="${PLUGIN_NAME}.zip"

echo "Blocking out the noise and zipping up $PLUGIN_NAME..."

# The Command:
# -r : recursive
# -9 : maximum compression
# -x : exclude patterns
zip -r9 "$ZIP_FILE" . \
    -x "*.git*" \
    -x "make-zip.sh" \
    -x "venv/*" \
    -x "*.zip" \
    -x ".DS_Store"

echo "--------------------------------------"
echo "Done! Created: $ZIP_FILE"
echo "You can now download this to your PC and upload it to fsbhoa.com."
echo "On PC, cmd window:  scp pi@192.168.1.190:/home/pi/fsbhoa-calendar/fsbhoa-calendar.zip C:\\Users\\dkeen\\Downloads\\ "
