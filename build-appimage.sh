#!/bin/bash

# Build script for creating TradeTrack AppImage
set -e

echo "🚀 Building TradeTrack AppImage..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Building React application..."
npm run build

echo "🖥️  Building Electron application..."
npm run electron-build

echo "✅ Build complete! Check the dist/ folder for the AppImage file."
echo ""
echo "📋 Installation Instructions:"
echo "1. Make the AppImage executable: chmod +x dist/TradeTrack-*.AppImage"
echo "2. Run the application: ./dist/TradeTrack-*.AppImage"
echo ""
echo "🔄 To create a desktop shortcut:"
echo "1. Copy the AppImage to ~/.local/bin/ or /usr/local/bin/"
echo "2. Create a .desktop file in ~/.local/share/applications/"
echo ""
echo "📊 TradeTrack is ready to use!"
