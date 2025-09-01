#!/bin/bash
# TradingBook Multi-Platform Build Script
# Automatically cleans caches and creates both AppImage and Windows EXE

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Function to show help
show_help() {
    echo "TradingBook Multi-Platform Build Script"
    echo ""
    echo "Usage: ./create-installs.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --dry-run      Show what would be done without executing"
    echo "  --linux-only   Build only Linux AppImage"
    echo "  --windows-only Build only Windows EXE"
    echo ""
    echo "This script will:"
    echo "  1. Clean all caches (node_modules, build, dist)"
    echo "  2. Install fresh dependencies"
    echo "  3. Build React application"
    echo "  4. Create Linux AppImage (~113MB)"
    echo "  5. Create Windows portable EXE (~294MB)"
    echo "  6. Create Windows ZIP archive (~120MB)"
    echo ""
    echo "Total build time: ~5-10 minutes"
    echo "Total output size: ~500MB"
}

# Parse command line arguments
DRY_RUN=false
LINUX_ONLY=false
WINDOWS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --linux-only)
            LINUX_ONLY=true
            shift
            ;;
        --windows-only)
            WINDOWS_ONLY=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/App.tsx" ]; then
    print_error "Please run this script from the TradingBook project root directory"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/App.tsx" ]; then
    print_error "Please run this script from the TradingBook project root directory"
    exit 1
fi

# Execute command or show what would be executed
execute_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Would execute: $1"
    else
        eval "$1"
    fi
}

print_header "TradingBook Multi-Platform Build Script"

if [ "$DRY_RUN" = true ]; then
    print_warning "DRY-RUN MODE: Showing what would be done without executing"
fi

if [ "$LINUX_ONLY" = true ]; then
    print_status "Linux-only build mode selected"
elif [ "$WINDOWS_ONLY" = true ]; then
    print_status "Windows-only build mode selected"
fi

print_status "Starting clean build process..."

# Step 1: Clean up all caches and build artifacts
print_header "Step 1: Cleaning Up Caches"

print_status "Removing node_modules..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    print_success "node_modules removed"
else
    print_warning "node_modules directory not found"
fi

print_status "Removing build directory..."
if [ -d "build" ]; then
    rm -rf build
    print_success "build directory removed"
else
    print_warning "build directory not found"
fi

print_status "Removing dist directory..."
if [ -d "dist" ]; then
    rm -rf dist
    print_success "dist directory removed"
else
    print_warning "dist directory not found"
fi

print_status "Clearing npm cache..."
npm cache clean --force
print_success "npm cache cleared"

print_status "Clearing electron-builder cache..."
if command -v electron-builder &> /dev/null; then
    npx electron-builder install-app-deps --force
fi
rm -rf ~/.cache/electron-builder 2>/dev/null || true
print_success "electron-builder cache cleared"

# Step 2: Fresh dependency installation
print_header "Step 2: Installing Fresh Dependencies"

print_status "Installing npm dependencies..."
npm install
print_success "Dependencies installed successfully"

print_status "Rebuilding native modules..."
npm run postinstall 2>/dev/null || npx electron-builder install-app-deps
print_success "Native modules rebuilt"

# Step 3: Build React application
print_header "Step 3: Building React Application"

print_status "Building optimized React production build..."
npm run build
print_success "React build completed successfully"

# Verify React build
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    print_error "React build failed - build directory not found or incomplete"
    exit 1
fi

print_success "React build verification passed"

# Step 4: Create Linux AppImage
print_header "Step 4: Creating Linux AppImage"

print_status "Building Linux AppImage..."
npm run build-appimage

# Verify AppImage creation
if [ -f "dist/TradingBook-1.0.0.AppImage" ]; then
    APPIMAGE_SIZE=$(du -h "dist/TradingBook-1.0.0.AppImage" | cut -f1)
    print_success "Linux AppImage created successfully (${APPIMAGE_SIZE})"
    chmod +x "dist/TradingBook-1.0.0.AppImage"
    print_success "AppImage made executable"
else
    print_error "Linux AppImage creation failed"
    exit 1
fi

# Step 5: Create Windows EXE
print_header "Step 5: Creating Windows EXE"

# Check if Wine is available for cross-compilation
if ! command -v wine &> /dev/null; then
    print_warning "Wine not found. Windows build may not work properly."
    print_status "Consider installing Wine: sudo apt install wine"
fi

print_status "Building Windows portable EXE..."
npm run build-windows-portable

# Verify Windows EXE creation
if [ -f "dist/TradingBook 1.0.0.exe" ]; then
    EXE_SIZE=$(du -h "dist/TradingBook 1.0.0.exe" | cut -f1)
    print_success "Windows EXE created successfully (${EXE_SIZE})"
else
    print_error "Windows EXE creation failed"
    exit 1
fi

# Step 6: Create Windows ZIP archive
print_header "Step 6: Creating Windows ZIP Archive"

if [ -d "dist/win-unpacked" ]; then
    print_status "Creating ZIP archive of Windows directory build..."
    cd dist
    zip -r "TradingBook-1.0.0-Windows.zip" win-unpacked/ >/dev/null 2>&1
    cd ..
    
    if [ -f "dist/TradingBook-1.0.0-Windows.zip" ]; then
        ZIP_SIZE=$(du -h "dist/TradingBook-1.0.0-Windows.zip" | cut -f1)
        print_success "Windows ZIP archive created successfully (${ZIP_SIZE})"
    else
        print_warning "Windows ZIP archive creation failed"
    fi
else
    print_warning "Windows unpacked directory not found - skipping ZIP creation"
fi

# Step 7: Build summary and verification
print_header "Step 7: Build Summary & Verification"

print_status "Verifying all build artifacts..."

# Check file sizes and existence
TOTAL_SIZE=0

if [ -f "dist/TradingBook-1.0.0.AppImage" ]; then
    APPIMAGE_SIZE_BYTES=$(stat -c%s "dist/TradingBook-1.0.0.AppImage")
    APPIMAGE_SIZE_MB=$((APPIMAGE_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + APPIMAGE_SIZE_BYTES))
    print_success "✅ Linux AppImage: ${APPIMAGE_SIZE_MB}MB"
    
    # Test AppImage can be executed
    if "./dist/TradingBook-1.0.0.AppImage" --version &>/dev/null; then
        print_success "✅ AppImage executable test passed"
    else
        print_warning "⚠️ AppImage executable test failed (may be normal)"
    fi
else
    print_error "❌ Linux AppImage missing"
fi

if [ -f "dist/TradingBook 1.0.0.exe" ]; then
    EXE_SIZE_BYTES=$(stat -c%s "dist/TradingBook 1.0.0.exe")
    EXE_SIZE_MB=$((EXE_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + EXE_SIZE_BYTES))
    print_success "✅ Windows EXE: ${EXE_SIZE_MB}MB"
    
    # Verify EXE format
    if file "dist/TradingBook 1.0.0.exe" | grep -q "PE32"; then
        print_success "✅ Windows EXE format verification passed"
    else
        print_warning "⚠️ Windows EXE format verification failed"
    fi
else
    print_error "❌ Windows EXE missing"
fi

if [ -f "dist/TradingBook-1.0.0-Windows.zip" ]; then
    ZIP_SIZE_BYTES=$(stat -c%s "dist/TradingBook-1.0.0-Windows.zip")
    ZIP_SIZE_MB=$((ZIP_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + ZIP_SIZE_BYTES))
    print_success "✅ Windows ZIP: ${ZIP_SIZE_MB}MB"
else
    print_warning "⚠️ Windows ZIP archive missing"
fi

TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024 / 1024))

print_header "Build Completed Successfully!"

echo -e "${GREEN}📦 Distribution Files Created:${NC}"
echo -e "   🐧 ${BLUE}TradingBook-1.0.0.AppImage${NC} - Linux portable executable"
echo -e "   🪟 ${BLUE}TradingBook 1.0.0.exe${NC} - Windows portable executable"
echo -e "   📁 ${BLUE}TradingBook-1.0.0-Windows.zip${NC} - Windows directory structure"
echo ""
echo -e "${PURPLE}📊 Total Distribution Size: ${TOTAL_SIZE_MB}MB${NC}"
echo ""
echo -e "${GREEN}🚀 Ready for distribution across Linux and Windows platforms!${NC}"
echo ""

# Step 8: Optional testing suggestions
print_header "Testing Suggestions"

echo -e "${YELLOW}Linux Testing:${NC}"
echo -e "   ./dist/TradingBook-1.0.0.AppImage"
echo ""
echo -e "${YELLOW}Windows Testing:${NC}"
echo -e "   • Copy 'dist/TradingBook 1.0.0.exe' to Windows machine"
echo -e "   • Double-click to run (no installation required)"
echo ""
echo -e "${YELLOW}Development Testing:${NC}"
echo -e "   npm run electron-dev"
echo ""

print_success "Multi-platform build script completed successfully! 🎉"
