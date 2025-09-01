# TradingBook Build Script Usage

## 🚀 Quick Start

```bash
# Make the script executable (first time only)
chmod +x create-installs.sh

# Run full build (Linux + Windows)
./create-installs.sh

# See what it would do without running
./create-installs.sh --dry-run

# Build only Linux AppImage
./create-installs.sh --linux-only

# Build only Windows EXE
./create-installs.sh --windows-only

# Show help
./create-installs.sh --help
```

## 📦 What It Creates

After running the script, you'll find these files in the `dist/` directory:

- **`TradingBook-1.0.0.AppImage`** - Linux portable executable (~113MB)
- **`TradingBook 1.0.0.exe`** - Windows portable executable (~294MB)
- **`TradingBook-1.0.0-Windows.zip`** - Windows directory structure (~120MB)

## 🧹 What It Cleans

The script performs a thorough cleanup before building:

1. **Removes `node_modules/`** - Forces fresh dependency installation
2. **Removes `build/`** - Clears React build artifacts
3. **Removes `dist/`** - Clears previous distribution files
4. **Clears npm cache** - Ensures clean package downloads
5. **Clears electron-builder cache** - Forces clean native module compilation

## ⏱️ Build Time

- **Full build**: ~5-10 minutes
- **Linux only**: ~3-5 minutes  
- **Windows only**: ~4-6 minutes

## 🔧 Requirements

- **Node.js** 18+ with npm
- **Git** (for version info)
- **Wine** (for Windows builds on Linux)
- **electron-builder** dependencies

## 📝 Example Output

```bash
$ ./create-installs.sh

========================================
 TradingBook Multi-Platform Build Script
========================================
[INFO] Starting clean build process...

========================================
 Step 1: Cleaning Up Caches
========================================
[SUCCESS] node_modules removed
[SUCCESS] build directory removed
[SUCCESS] dist directory removed
[SUCCESS] npm cache cleared
[SUCCESS] electron-builder cache cleared

... (build process continues) ...

========================================
 Build Completed Successfully!
========================================
📦 Distribution Files Created:
   🐧 TradingBook-1.0.0.AppImage - Linux portable executable
   🪟 TradingBook 1.0.0.exe - Windows portable executable
   📁 TradingBook-1.0.0-Windows.zip - Windows directory structure

📊 Total Distribution Size: 527MB

🚀 Ready for distribution across Linux and Windows platforms!
```
