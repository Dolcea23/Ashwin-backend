#!/bin/bash

echo "🛠 Starting SVG auto-patch…"

SVG_PATH="./node_modules/react-native-svg/apple"

# Ensure folder exists
if [ ! -d "$SVG_PATH" ]; then
  echo "❌ react-native-svg apple folder not found!"
  exit 1
fi

# Files to patch
FILES=$(find "$SVG_PATH" -type f -name "*.mm")

for FILE in $FILES; do
  echo "🔧 Patching: $FILE"

  # Remove old includes
  sed -i '' 's|#import <React/RCTConversions.h>||g' "$FILE"
  sed -i '' 's|#import <React/RCTComponentViewFactory.h>||g' "$FILE"
  sed -i '' 's|#import <React/RCTComponentViewProtocol.h>||g' "$FILE"

  # Inject safe imports under the RCT_NEW_ARCH_ENABLED section
  sed -i '' 's|#ifdef RCT_NEW_ARCH_ENABLED|#ifdef RCT_NEW_ARCH_ENABLED\
#import <React/RCTBridgeModule.h>\
#import <React/RCTComponentViewProtocol.h>|' "$FILE"

done

echo "✅ SVG patch complete!"

