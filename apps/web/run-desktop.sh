#!/bin/bash

# Tauri desktop app launcher for WSL2

# Function to check if WSLg is available
check_wslg() {
    [[ -n "$WAYLAND_DISPLAY" ]] || [[ -n "$PULSE_SERVER" ]]
}

# Function to check X server connection
check_x_server() {
    timeout 1 bash -c "echo >/dev/tcp/$1/6000" 2>/dev/null
}

# Detect WSL2 environment
if [[ -n "$WSL_DISTRO_NAME" ]]; then
    echo "🖥️  Running in WSL2"
    
    # Check for WSLg (Windows 11)
    if check_wslg; then
        echo "✅ WSLg detected"
        export DISPLAY=:0
    else
        # Windows 10: Use external X server
        WINDOWS_HOST=$(grep nameserver /etc/resolv.conf | awk '{print $2}' | head -1)
        
        if check_x_server "$WINDOWS_HOST"; then
            echo "✅ X server detected on $WINDOWS_HOST"
            export DISPLAY="$WINDOWS_HOST:0"
        else
            echo "❌ X server not detected"
            echo ""
            echo "To run GUI apps in WSL2:"
            echo "1. Install VcXsrv: https://sourceforge.net/projects/vcxsrv/"
            echo "2. Run with 'Disable access control' checked"
            echo "3. Allow through Windows Firewall"
            exit 1
        fi
    fi
    
    # Set GTK environment
    export GDK_BACKEND=x11
    export NO_AT_BRIDGE=1
fi

# Start Tauri
exec bun run desktop:dev