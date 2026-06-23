#!/bin/bash

# Get the actual directory name dynamically (e.g., hoaplugin-calendar-pro)
DIR_NAME=$(basename "$PWD")
TIMESTAMP=$(date +%Y%m%d_%H%M)
ZIP_FOR_SERVER="${DIR_NAME}.zip"
ZIP_FOR_WPORG="${DIR_NAME}-wporg.zip"

# ---------------------------------------------------------
# VERSION SYNC LOGIC
# ---------------------------------------------------------
MAIN_PHP_FILE="${DIR_NAME}.php"
if [ -f "$MAIN_PHP_FILE" ]; then
    # Extract the version number (grabs "1.1.25" from "* Version: 1.1.25")
    PLUGIN_VERSION=$(grep -i "^ \* Version:" "$MAIN_PHP_FILE" | awk -F':' '{print $2}' | xargs)

    if [ -n "$PLUGIN_VERSION" ]; then
        echo "Syncing version $PLUGIN_VERSION to readme.txt..."
        # Replace the Stable tag line in readme.txt using GNU sed
        sed -i "s/^Stable tag: .*/Stable tag: $PLUGIN_VERSION/" readme.txt
    else
        echo "Warning: Could not extract version number from $MAIN_PHP_FILE"
    fi
else
    echo "Warning: Main plugin file $MAIN_PHP_FILE not found for version sync."
fi
# ---------------------------------------------------------

rm -f "$ZIP_FOR_SERVER" "$ZIP_FOR_WPORG"

echo "Blocking out the noise and zipping up $DIR_NAME..."

# Step OUT of the directory so zip grabs the wrapper folder
cd ..

# The Command:
# 1. We target "$DIR_NAME" instead of "."
# 2. We output the zip file back INTO the directory: "$DIR_NAME/$ZIP_FOR_SERVER"
# 3. We prefix all exclusions with "$DIR_NAME/" so they match the new paths
zip -r9 "$DIR_NAME/$ZIP_FOR_SERVER" "$DIR_NAME" \
    -x "$DIR_NAME/*.git*" \
    -x "$DIR_NAME/*.zip" \
    -x "$DIR_NAME/*/bin/*" \
    -x "$DIR_NAME/.aider*" \
    -x "$DIR_NAME/test.sh" \
    -x "$DIR_NAME/README.md" \
    -x "$DIR_NAME/deploy.sh" \
    -x "$DIR_NAME/assets/screenshot-*.png" \
    -x "$DIR_NAME/.DS_Store"

# ---------------------------------------------------------
# BUILD 2: The WordPress.org Payload (Strictly Sanitized)
# ---------------------------------------------------------
zip -r9 "$DIR_NAME/$ZIP_FOR_WPORG" "$DIR_NAME" \
    -x "$DIR_NAME/*.git*" \
    -x "$DIR_NAME/*.zip" \
    -x "$DIR_NAME/*/bin/*" \
    -x "$DIR_NAME/.aider*" \
    -x "$DIR_NAME/docs/*" \
    -x "$DIR_NAME/README.md" \
    -x "$DIR_NAME/test.sh" \
    -x "$DIR_NAME/deploy.sh" \
    -x "$DIR_NAME/assets/screenshot-*.png" \
    -x "$DIR_NAME/.DS_Store"

# Step back IN to the directory
cd "$DIR_NAME" || exit

# Copy it directly to the uploads folder and hand it over to the web server
scp "$ZIP_FOR_SERVER" scguild@keolight.com:~/hoaplugin.com/wp-content/uploads/
rm $ZIP_FOR_SERVER

echo "--------------------------------------"
echo "Created: $ZIP_FOR_SERVER copied to license server."
echo "Created: $ZIP_FOR_WPORG ready for WP.org submission."
echo "Done."


