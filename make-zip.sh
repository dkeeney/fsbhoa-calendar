#!/bin/bash

# Get the actual directory name dynamically (e.g., fsbhoa-calendar-pro)
DIR_NAME=$(basename "$PWD")
TIMESTAMP=$(date +%Y%m%d_%H%M)
ZIP_FILE="${DIR_NAME}.zip"

rm -f "$ZIP_FILE"

echo "Blocking out the noise and zipping up $DIR_NAME..."

# Step OUT of the directory so zip grabs the wrapper folder
cd ..

# The Command:
# 1. We target "$DIR_NAME" instead of "."
# 2. We output the zip file back INTO the directory: "$DIR_NAME/$ZIP_FILE"
# 3. We prefix all exclusions with "$DIR_NAME/" so they match the new paths
zip -r9 "$DIR_NAME/$ZIP_FILE" "$DIR_NAME" \
    -x "$DIR_NAME/*.git*" \
    -x "$DIR_NAME/make-zip.sh" \
    -x "$DIR_NAME/venv/*" \
    -x "$DIR_NAME/*.zip" \
    -x "$DIR_NAME/node_modules/*" \
    -x "$DIR_NAME/.aider*" \
    -x "$DIR_NAME/package.json" \
    -x "$DIR_NAME/package-lock.json" \
    -x "$DIR_NAME/playwright.config.js" \
    -x "$DIR_NAME/tests/*" \
    -x "$DIR_NAME/.DS_Store"

# Step back IN to the directory
cd "$DIR_NAME" || exit

echo "Deploying to WordPress uploads directory..."
# Copy it directly to the uploads folder and hand it over to the web server
sudo cp "$ZIP_FILE" /var/www/html/wp-content/uploads/
sudo chown www-data:www-data /var/www/html/wp-content/uploads/"$ZIP_FILE"

echo "--------------------------------------"
echo "Done! Created: $ZIP_FILE"
echo "You can now download this to your PC and upload it to your website."
echo "On PC, cmd window:  scp pi@testbed.fsbhoa.com:/home/pi/fsbhoa-calendar/fsbhoa-calendar.zip C:\\Users\\dkeen\\Downloads\\ "
echo "OR on Pi"
echo "sudo cp /home/pi/fsbhoa-calendar/fsbhoa-calendar.zip /var/www/html/wp-content/uploads/"
echo "sudo chown www-data:www-data /var/www/html/wp-content/uploads/fsbhoa-calendar.zip"

