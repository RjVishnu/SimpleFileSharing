#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Creating Linux distribution package...\n');

// Create a linux-dist directory for packaging
const linuxDistDir = './dist/linux-dist';
if (!fs.existsSync(linuxDistDir)) {
  fs.mkdirSync(linuxDistDir, { recursive: true });
  console.log('✅ Created linux-dist directory');
}

// Copy Linux-specific files
const filesToCopy = [
  { src: './dist/FileServer-linux', dest: `${linuxDistDir}/FileServer`, executable: true },
  { src: './dist/config.js', dest: `${linuxDistDir}/config.js` },
  { src: './dist/app-config.json', dest: `${linuxDistDir}/app-config.json` },
  { src: './dist/start-server.sh', dest: `${linuxDistDir}/start-server.sh`, executable: true },
  { src: './dist/README-Linux.md', dest: `${linuxDistDir}/README.md` }
];

console.log('📋 Copying files to Linux distribution folder...');
filesToCopy.forEach(file => {
  try {
    fs.copyFileSync(file.src, file.dest);
    console.log(`✅ Copied: ${path.basename(file.src)}`);
    
    // Make executable files executable (for when transferred to Linux)
    if (file.executable && process.platform !== 'win32') {
      fs.chmodSync(file.dest, '755');
    }
  } catch (error) {
    console.error(`❌ Failed to copy ${file.src}:`, error.message);
  }
});

// Create an install script
const installScript = `#!/bin/bash

# File Server Linux Installer
echo "🚀 Installing File Server..."

# Get installation directory
INSTALL_DIR="/opt/file-server"
USER_INSTALL_DIR="$HOME/.local/bin/file-server"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "📁 Installing to system directory: $INSTALL_DIR"
    INSTALL_TARGET="$INSTALL_DIR"
else
    echo "📁 Installing to user directory: $USER_INSTALL_DIR"
    INSTALL_TARGET="$USER_INSTALL_DIR"
fi

# Create installation directory
mkdir -p "$INSTALL_TARGET"

# Copy files
echo "📋 Copying files..."
cp FileServer "$INSTALL_TARGET/"
cp config.js "$INSTALL_TARGET/"
cp app-config.json "$INSTALL_TARGET/"
cp start-server.sh "$INSTALL_TARGET/"
cp README.md "$INSTALL_TARGET/"

# Make executable
chmod +x "$INSTALL_TARGET/FileServer"
chmod +x "$INSTALL_TARGET/start-server.sh"

echo "✅ Installation complete!"
echo ""
echo "📍 Files installed to: $INSTALL_TARGET"
echo ""
echo "🚀 To start the server:"
echo "   cd $INSTALL_TARGET"
echo "   ./start-server.sh"
echo ""
echo "⚙️  To configure:"
echo "   Edit $INSTALL_TARGET/config.js"
echo ""

# Ask if user wants to create a desktop shortcut
if [ "$EUID" -ne 0 ] && command -v xdg-user-dir &> /dev/null; then
    read -p "Create desktop shortcut? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
        if [ -d "$DESKTOP_DIR" ]; then
            cat > "$DESKTOP_DIR/File Server.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=File Server
Comment=Local File Server with Preview
Exec=$INSTALL_TARGET/start-server.sh
Icon=folder
Terminal=true
Categories=Network;FileTransfer;
EOF
            chmod +x "$DESKTOP_DIR/File Server.desktop"
            echo "✅ Desktop shortcut created"
        fi
    fi
fi
`;

fs.writeFileSync(`${linuxDistDir}/install.sh`, installScript);
console.log('✅ Created install.sh script');

// Create uninstall script
const uninstallScript = `#!/bin/bash

# File Server Linux Uninstaller
echo "🗑️  Uninstalling File Server..."

# Check possible installation locations
SYSTEM_DIR="/opt/file-server"
USER_DIR="$HOME/.local/bin/file-server"

if [ -d "$SYSTEM_DIR" ] && [ "$EUID" -eq 0 ]; then
    echo "📁 Removing system installation: $SYSTEM_DIR"
    rm -rf "$SYSTEM_DIR"
    echo "✅ System installation removed"
elif [ -d "$USER_DIR" ]; then
    echo "📁 Removing user installation: $USER_DIR"
    rm -rf "$USER_DIR"
    echo "✅ User installation removed"
else
    echo "❌ No File Server installation found"
    exit 1
fi

# Remove desktop shortcut if it exists
DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
if [ -f "$DESKTOP_DIR/File Server.desktop" ]; then
    rm "$DESKTOP_DIR/File Server.desktop"
    echo "✅ Desktop shortcut removed"
fi

echo "🎉 File Server has been completely uninstalled"
`;

fs.writeFileSync(`${linuxDistDir}/uninstall.sh`, uninstallScript);
console.log('✅ Created uninstall.sh script');

console.log('\n🎉 Linux distribution package created!');
console.log(`📦 Location: ${linuxDistDir}`);
console.log('\n📋 Package contents:');
console.log('   - FileServer (main executable)');
console.log('   - config.js (configuration file)');
console.log('   - app-config.json (application config)');
console.log('   - start-server.sh (startup script)');
console.log('   - install.sh (installation script)');
console.log('   - uninstall.sh (removal script)');
console.log('   - README.md (documentation)');
console.log('\n📋 Usage on Linux:');
console.log('   1. Copy the linux-dist folder to your Linux system');
console.log('   2. cd linux-dist');
console.log('   3. chmod +x install.sh');
console.log('   4. ./install.sh');
console.log('\n📋 Or run directly:');
console.log('   1. chmod +x FileServer start-server.sh');
console.log('   2. ./start-server.sh');
