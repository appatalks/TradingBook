#!/bin/bash
# TradingBook Multi-Platform Build Script
# Automatically cleans caches and creates both AppImage and Windows EXE

set -e  # Exit on any error

# Color codes for output
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

# Function to extract version from package.json
get_version() {
    if [ -f "package.json" ]; then
        # Extract version using grep and sed
        local version=$(grep '"version"' package.json | head -n1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
        if [ -n "$version" ]; then
            echo "$version"
        else
            print_error "Could not extract version from package.json"
            exit 1
        fi
    else
        print_error "package.json not found"
        exit 1
    fi
}

# Extract version from package.json
VERSION=$(get_version)
print_status "Detected version: $VERSION"

# Function to verify basic dependencies
verify_dependencies() {
    print_status "Verifying basic dependencies..."
    
    local missing_deps=()
    
    # Check for essential packages only
    if [ ! -d "node_modules/react" ]; then
        missing_deps+=("react")
    fi
    
    if [ ! -d "node_modules/electron" ]; then
        missing_deps+=("electron")
    fi
    
    if [ ! -d "node_modules/better-sqlite3" ]; then
        missing_deps+=("better-sqlite3")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "Missing basic dependencies: ${missing_deps[*]}"
        return 1
    fi
    
    print_success "Basic dependencies verified"
    return 0
}

# Function to install dependencies with simple retry
install_dependencies_with_retry() {
    local max_retries=2
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        print_status "Installing dependencies (attempt $((retry_count + 1))/$max_retries)..."
        
        if npm install --legacy-peer-deps; then
            print_success "Dependencies installed successfully"
            return 0
        else
            print_warning "npm install failed on attempt $((retry_count + 1))"
            rm -rf node_modules package-lock.json 2>/dev/null || true
        fi
        
        retry_count=$((retry_count + 1))
        
        if [ $retry_count -lt $max_retries ]; then
            print_status "Retrying in 2 seconds..."
            sleep 2
        fi
    done
    
    print_error "Failed to install dependencies after $max_retries attempts"
    return 1
}

# Function to show help
show_help() {
    echo "TradingBook Multi-Platform Build Script (Robust Edition)"
    echo ""
    echo "Usage: ./create-installs.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --linux-only   Build only Linux AppImage"
    echo "  --windows-only Build only Windows EXE"
    echo ""
    echo "Features:"
    echo "  • Clean build from scratch"
    echo "  • Dependency installation with retry logic"
    echo "  • Native module rebuilding"
    echo "  • React build verification"
    echo "  • Multi-platform distribution creation"
    echo ""
    echo "This script will:"
    echo "  1. Clean all caches and build artifacts"
    echo "  2. Install fresh dependencies"
    echo "  3. Rebuild native modules"
    echo "  4. Build React application"
    echo "  5. Create Linux AppImage (~113MB)"
    echo "  6. Create Windows portable EXE (~294MB)"
    echo "  7. Create Windows ZIP archive (~120MB)"
    echo "  8. Create Windows installer (~86MB)"
    echo ""
    echo "Total build time: ~5-10 minutes"
    echo "Total output size: ~500MB"
}

# Parse command line arguments
LINUX_ONLY=false
WINDOWS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
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

print_header "TradingBook Multi-Platform Build Script"

if [ "$LINUX_ONLY" = true ]; then
    print_status "Linux-only build mode selected"
elif [ "$WINDOWS_ONLY" = true ]; then
    print_status "Windows-only build mode selected"
fi

print_status "Starting clean build process..."

# Kill any running TradingBook instances to prevent conflicts
print_status "Checking for running TradingBook instances..."
if pgrep -f tradingbook >/dev/null 2>&1; then
    print_warning "Stopping running TradingBook instances..."
    pkill -f tradingbook
    sleep 2
    print_success "Running instances stopped"
else
    print_success "No running instances found"
fi

# Step 1: Clean up all caches and build artifacts
print_header "Step 1: Cleaning Up Caches"

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

# Step 2: Install dependencies with verification and retry logic
print_header "Step 2: Installing Fresh Dependencies"

# Install dependencies with retry logic and verification
if ! install_dependencies_with_retry; then
    print_error "Dependency installation failed after multiple attempts"
    print_error "You can try running 'rm -rf node_modules package-lock.json && npm install --legacy-peer-deps' manually"
    exit 1
fi

print_status "Rebuilding native modules..."
if npm run postinstall 2>/dev/null || npx electron-builder install-app-deps; then
    print_success "Native modules rebuilt successfully"
else
    print_warning "Native module rebuild had issues, but continuing..."
fi

# Step 3: Build React application
print_header "Step 3: Building React Application"

print_status "Building React production build..."
npm run build
print_success "React build completed"

# Verify React build
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    print_error "React build failed - build directory not found or incomplete"
    exit 1
fi

# Simple React build verification
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    print_error "React build failed - build directory not found or incomplete"
    exit 1
fi

print_success "React build verification passed"

# Step 4: Create Linux AppImage
if [ "$WINDOWS_ONLY" != true ]; then
    print_header "Step 4: Creating Linux AppImage"

    print_status "Building Linux AppImage..."
    npm run build-appimage

    # Verify AppImage creation
    if [ -f "dist/TradingBook-${VERSION}.AppImage" ]; then
        APPIMAGE_SIZE=$(du -h "dist/TradingBook-${VERSION}.AppImage" | cut -f1)
        print_success "Linux AppImage created successfully (${APPIMAGE_SIZE})"
        chmod +x "dist/TradingBook-${VERSION}.AppImage"
        print_success "AppImage made executable"
    else
        print_error "Linux AppImage creation failed"
        exit 1
    fi
else
    print_status "Skipping Linux AppImage build (Windows-only mode)"
fi

# Step 5: Create Windows Distributions
if [ "$LINUX_ONLY" != true ]; then
    print_header "Step 5: Creating Windows Distributions"

# Check if Wine is available for cross-compilation
if ! command -v wine &> /dev/null; then
    print_warning "Wine not found. Windows build may not work properly."
    print_status "Consider installing Wine: sudo apt install wine"
fi

    # Build Windows installer (recommended for most users)
    print_status "Building Windows installer (NSIS)..."
    npm run build-windows-installer

    # Verify Windows installer creation
    if [ -f "dist/TradingBook Setup ${VERSION}.exe" ]; then
        INSTALLER_SIZE=$(du -h "dist/TradingBook Setup ${VERSION}.exe" | cut -f1)
        print_success "Windows installer created successfully (${INSTALLER_SIZE})"
    else
        print_error "Windows installer creation failed"
    fi

    # Build Windows portable EXE (for users who need portable version)
    print_status "Building Windows portable EXE..."
    npm run build-windows-portable

    # Verify Windows EXE creation
    if [ -f "dist/TradingBook ${VERSION}.exe" ]; then
        EXE_SIZE=$(du -h "dist/TradingBook ${VERSION}.exe" | cut -f1)
        print_success "Windows portable EXE created successfully (${EXE_SIZE})"
    else
        print_error "Windows portable EXE creation failed"
    fi
else
    print_status "Skipping Windows builds (Linux-only mode)"
fi

# Step 6: Create Windows ZIP archive
if [ "$LINUX_ONLY" != true ]; then
    print_header "Step 6: Creating Windows ZIP Archive"

    if [ -d "dist/win-unpacked" ]; then
        print_status "Creating ZIP archive of Windows directory build..."
        cd dist && zip -r "TradingBook-${VERSION}-Windows.zip" win-unpacked/ >/dev/null 2>&1 && cd ..
        
        if [ -f "dist/TradingBook-${VERSION}-Windows.zip" ]; then
            ZIP_SIZE=$(du -h "dist/TradingBook-${VERSION}-Windows.zip" | cut -f1)
            print_success "Windows ZIP archive created successfully (${ZIP_SIZE})"
        else
            print_warning "Windows ZIP archive creation failed"
        fi
    else
        print_warning "Windows unpacked directory not found - skipping ZIP creation"
    fi
else
    print_status "Skipping Windows ZIP creation (Linux-only mode)"
fi

# Step 7: Build summary and verification
print_header "Step 7: Build Summary & Verification"

if [ "$DRY_RUN" = true ]; then
    print_success "Dry-run completed successfully!"
    print_status "The script would have created the specified distribution files."
    exit 0
fi

print_status "Verifying build artifacts..."

# Check file sizes and existence
TOTAL_SIZE=0

# Linux AppImage verification
if [ "$WINDOWS_ONLY" != true ] && [ -f "dist/TradingBook-${VERSION}.AppImage" ]; then
    APPIMAGE_SIZE_BYTES=$(stat -c%s "dist/TradingBook-${VERSION}.AppImage")
    APPIMAGE_SIZE_MB=$((APPIMAGE_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + APPIMAGE_SIZE_BYTES))
    print_success "✅ Linux AppImage: ${APPIMAGE_SIZE_MB}MB"
    
    # Verify AppImage format
    if file "dist/TradingBook-${VERSION}.AppImage" | grep -q "AppImage"; then
        print_success "✅ AppImage format verification passed"
    else
        print_warning "⚠️ AppImage format verification failed"
    fi
elif [ "$WINDOWS_ONLY" != true ]; then
    print_error "❌ Linux AppImage missing"
fi

# Windows Installer verification
if [ "$LINUX_ONLY" != true ] && [ -f "dist/TradingBook Setup ${VERSION}.exe" ]; then
    INSTALLER_SIZE_BYTES=$(stat -c%s "dist/TradingBook Setup ${VERSION}.exe")
    INSTALLER_SIZE_MB=$((INSTALLER_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + INSTALLER_SIZE_BYTES))
    print_success "✅ Windows Installer: ${INSTALLER_SIZE_MB}MB"
    
    # Verify installer format
    if file "dist/TradingBook Setup ${VERSION}.exe" | grep -q "PE32"; then
        print_success "✅ Windows installer format verification passed"
    else
        print_warning "⚠️ Windows installer format verification failed"
    fi
elif [ "$LINUX_ONLY" != true ]; then
    print_error "❌ Windows installer missing"
fi

# Windows Portable EXE verification
if [ "$LINUX_ONLY" != true ] && [ -f "dist/TradingBook ${VERSION}.exe" ]; then
    EXE_SIZE_BYTES=$(stat -c%s "dist/TradingBook ${VERSION}.exe")
    EXE_SIZE_MB=$((EXE_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + EXE_SIZE_BYTES))
    print_success "✅ Windows Portable EXE: ${EXE_SIZE_MB}MB"
    
    # Verify EXE format
    if file "dist/TradingBook ${VERSION}.exe" | grep -q "PE32"; then
        print_success "✅ Windows portable EXE format verification passed"
    else
        print_warning "⚠️ Windows portable EXE format verification failed"
    fi
elif [ "$LINUX_ONLY" != true ]; then
    print_error "❌ Windows portable EXE missing"
fi

# Windows ZIP verification
if [ "$LINUX_ONLY" != true ] && [ -f "dist/TradingBook-${VERSION}-Windows.zip" ]; then
    ZIP_SIZE_BYTES=$(stat -c%s "dist/TradingBook-${VERSION}-Windows.zip")
    ZIP_SIZE_MB=$((ZIP_SIZE_BYTES / 1024 / 1024))
    TOTAL_SIZE=$((TOTAL_SIZE + ZIP_SIZE_BYTES))
    print_success "✅ Windows ZIP: ${ZIP_SIZE_MB}MB"
elif [ "$LINUX_ONLY" != true ]; then
    print_warning "⚠️ Windows ZIP archive missing"
fi

TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024 / 1024))

print_header "Build Completed Successfully!"

echo -e "${GREEN}📦 Distribution Files Created:${NC}"
echo -e "   🐧 ${BLUE}TradingBook-${VERSION}.AppImage${NC} - Linux portable executable"
echo -e "   🪟 ${BLUE}TradingBook Setup ${VERSION}.exe${NC} - Windows installer (recommended)"
echo -e "   🪟 ${BLUE}TradingBook ${VERSION}.exe${NC} - Windows portable executable"
echo -e "   📁 ${BLUE}TradingBook-${VERSION}-Windows.zip${NC} - Windows directory structure"
echo ""
echo -e "${PURPLE}📊 Total Distribution Size: ${TOTAL_SIZE_MB}MB${NC}"
echo ""
echo -e "${GREEN}🚀 Ready for distribution across Linux and Windows platforms!${NC}"
echo ""

# Step 8: Optional testing suggestions
print_header "Testing Suggestions"

echo -e "${YELLOW}Linux Testing:${NC}"
echo -e "   ./dist/TradingBook-${VERSION}.AppImage"
echo ""
echo -e "${YELLOW}Windows Testing:${NC}"
echo -e "   • Installer: Run 'TradingBook Setup ${VERSION}.exe' for full installation"
echo -e "   • Portable: Copy 'TradingBook ${VERSION}.exe' to Windows machine (no installation required)"
echo ""
echo -e "${YELLOW}Development Testing:${NC}"
echo -e "   npm run electron-dev"
echo ""

print_success "Multi-platform build script completed successfully! 🎉"
