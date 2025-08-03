#!/bin/bash

# Script to run Tauri desktop app with proper display configuration

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if WSLg is available
check_wslg() {
    if [[ -n "$WAYLAND_DISPLAY" ]] || [[ -n "$PULSE_SERVER" ]]; then
        return 0
    fi
    return 1
}

# Function to check X server connection
check_x_server() {
    local host=$1
    timeout 1 bash -c "echo >/dev/tcp/$host/6000" 2>/dev/null
}

# Detect the environment
if [[ -n "$WSL_DISTRO_NAME" ]]; then
    echo -e "${BLUE}🖥️  Running in WSL2 environment${NC}"
    
    # Check for WSLg (Windows 11)
    if check_wslg; then
        echo -e "${GREEN}✅ WSLg detected - native GUI support available${NC}"
        # WSLg uses local display :0
        export DISPLAY=:0
    else
        echo -e "${YELLOW}⚠️  WSLg not detected - checking for X server...${NC}"
        
        # Get Windows host IP
        WINDOWS_HOST=$(grep nameserver /etc/resolv.conf | awk '{print $2}' | head -1)
        echo -e "${BLUE}🔍 Windows host IP: $WINDOWS_HOST${NC}"
        
        # Check if X server is running
        if check_x_server "$WINDOWS_HOST"; then
            echo -e "${GREEN}✅ X server detected on Windows host${NC}"
            export DISPLAY="$WINDOWS_HOST:0"
        else
            echo -e "${RED}❌ X server not detected${NC}"
            echo ""
            echo -e "${YELLOW}📋 To run GUI apps in WSL2, you have these options:${NC}"
            echo ""
            echo -e "${GREEN}Option 1: Upgrade to Windows 11${NC} (Recommended)"
            echo "   - WSLg is included - GUI apps work out of the box"
            echo "   - No additional configuration needed"
            echo ""
            echo -e "${BLUE}Option 2: Install X server on Windows 10${NC}"
            echo "   1. Download VcXsrv: https://sourceforge.net/projects/vcxsrv/"
            echo "   2. Run XLaunch with these settings:"
            echo "      - Multiple windows"
            echo "      - Start no client"
            echo "      - ✓ Disable access control (IMPORTANT!)"
            echo "      - Save configuration for easy restart"
            echo "   3. Allow through Windows Firewall when prompted"
            echo "   4. Re-run this script"
            echo ""
            echo -e "${YELLOW}Option 3: Use web version instead${NC}"
            echo "   Run: bun run dev"
            echo "   Open: http://localhost:3001"
            echo ""
            exit 1
        fi
    fi
    
    echo -e "${GREEN}📺 Using DISPLAY=$DISPLAY${NC}"
    
    # Set GTK/X11 environment variables for better compatibility
    export GDK_BACKEND=x11
    export GTK_USE_PORTAL=0
    export NO_AT_BRIDGE=1
    export LIBGL_ALWAYS_INDIRECT=1
    
    # Additional debugging info
    echo -e "${BLUE}🔧 GTK Backend: $GDK_BACKEND${NC}"
fi

# Verify display connection with better error handling
if command -v xset &> /dev/null; then
    if ! xset q &>/dev/null 2>&1; then
        echo -e "${RED}❌ Cannot connect to display server${NC}"
        echo "Debugging information:"
        echo "  DISPLAY=$DISPLAY"
        echo "  WSL_DISTRO_NAME=$WSL_DISTRO_NAME"
        echo "  WAYLAND_DISPLAY=$WAYLAND_DISPLAY"
        echo ""
        echo "Please ensure your X server is running and accessible"
        exit 1
    else
        echo -e "${GREEN}✅ Display server connection verified${NC}"
    fi
fi

# Check if required packages are installed
echo -e "${BLUE}🔍 Checking dependencies...${NC}"
if ! pkg-config --exists gtk+-3.0 2>/dev/null; then
    echo -e "${YELLOW}⚠️  GTK3 development libraries may be missing${NC}"
    echo "Run: sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev"
fi

# Run the Tauri dev server
echo -e "${GREEN}🚀 Starting Tauri desktop app...${NC}"
echo ""

# Use exec to replace the shell process with the app
exec bun run desktop:dev