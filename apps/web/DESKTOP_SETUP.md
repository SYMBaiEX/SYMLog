# Tauri Desktop App Setup

## Prerequisites

### All Platforms
- Node.js 18+ or Bun
- Rust 1.77.2+
- Git

### Platform-Specific Requirements

#### Windows
- Microsoft Visual Studio C++ Build Tools or Visual Studio 2022
- WebView2 (comes with Windows 11, or install separately for Windows 10)

#### macOS
- Xcode Command Line Tools: `xcode-select --install`
- No additional requirements

#### Linux
- Development libraries:
  ```bash
  sudo apt update
  sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
  ```

#### WSL2 (Windows Subsystem for Linux)

**Windows 11 (Recommended)**
- WSLg is included - GUI apps work automatically
- No additional configuration needed

**Windows 10**
- Requires X server installation (see below)

## Running the Desktop App

### Running the App

**Windows/Mac/Linux:**
```bash
bun run desktop:dev
```

**WSL2 Users:**
```bash
# Use the helper script (recommended)
./run-desktop.sh

# Or set DISPLAY manually for WSLg
DISPLAY=:0 bun run desktop:dev
```

### WSL2 Setup

**Windows 11**: WSLg is included - GUI apps work automatically

**Windows 10**: Install an X server
1. Download [VcXsrv](https://sourceforge.net/projects/vcxsrv/)
2. Run XLaunch with "Disable access control" checked
3. Allow through Windows Firewall
4. Run the app using the helper script

## Troubleshooting

### Linux/WSL2: "Failed to initialize gtk backend"

**Check Display Configuration**
```bash
echo "DISPLAY=$DISPLAY"
echo "WAYLAND_DISPLAY=$WAYLAND_DISPLAY"
```

**For WSL2 on Windows 10**
1. Ensure VcXsrv is running with "Disable access control" checked
2. Set DISPLAY manually:
   ```bash
   export DISPLAY=$(grep nameserver /etc/resolv.conf | awk '{print $2}'):0
   ```
3. Test connection:
   ```bash
   xset q
   ```

**For Native Linux**
- Ensure you're in a desktop environment
- Check that GTK3 is installed: `pkg-config --exists gtk+-3.0`

### All Platforms: Build Errors
1. Clear build cache: `rm -rf src-tauri/target`
2. Reinstall dependencies: `bun install`
3. Update Rust: `rustup update`
4. Check Rust targets: `rustup target list --installed`

### Platform-Specific Issues

**Windows**
- Ensure WebView2 is installed
- Check Visual C++ Redistributables are installed

**macOS**
- Grant necessary permissions when prompted
- Check code signing settings in tauri.conf.json

**Linux**
- Verify all GTK dependencies: `pkg-config --list-all | grep gtk`
- Check display server: `echo $XDG_SESSION_TYPE`

## Building for Production

### Build for Current Platform
```bash
bun run desktop:build
```

### Cross-Platform Builds
Use GitHub Actions (see `.github/workflows/desktop-build.yml`) or platform-specific VMs.

## Architecture

The app uses:
- **Frontend**: Next.js with Turbopack
- **Desktop**: Tauri v2 (Rust)
- **Window Management**: Tao (cross-platform)
- **WebView**: Platform native (WebView2/WebKit/WebKitGTK)
- **Platform Support**: Windows, macOS, Linux (including WSL2)

## Quick Reference

### Commands
- `bun run desktop:dev` - Start development server
- `bun run desktop:build` - Build for production
- `./run-desktop.sh` - WSL2-aware launcher

### Environment Variables
- `DISPLAY=:0` - For WSLg (Windows 11)
- `DISPLAY=<host-ip>:0` - For external X server (Windows 10)
- `RUST_LOG=debug` - Enable debug logging