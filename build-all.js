#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🌍 Building File Server for All Platforms...\n');

// Read app configuration
const appConfig = JSON.parse(fs.readFileSync('app-config.json', 'utf8'));

// Install pkg if not installed
try {
  execSync('npm list pkg --depth=0', { stdio: 'ignore' });
  console.log('✅ pkg is already installed');
} catch (error) {
  console.log('📦 Installing pkg...');
  execSync('npm install pkg --save-dev', { stdio: 'inherit' });
  console.log('✅ pkg installed successfully');
}

// Create dist directory if it doesn't exist
if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist');
  console.log('✅ Created dist directory');
}

// Build targets
const targets = [
  { platform: 'Windows', target: 'node18-win32-x64', output: './dist/FileServer.exe', icon: '🪟' },
  { platform: 'Linux', target: 'node18-linux-x64', output: './dist/FileServer-linux', icon: '🐧' },
  { platform: 'macOS', target: 'node18-darwin-x64', output: './dist/FileServer-macos', icon: '🍎' }
];

console.log('🔨 Building executables for all platforms...\n');

let successCount = 0;
let totalTargets = targets.length;

for (const targetInfo of targets) {
  try {
    console.log(`${targetInfo.icon} Building ${targetInfo.platform} executable...`);
    execSync(`npx pkg . --target ${targetInfo.target} --output ${targetInfo.output}`, { stdio: 'inherit' });
    console.log(`✅ ${targetInfo.platform} executable built successfully!`);
    successCount++;
  } catch (error) {
    console.error(`❌ ${targetInfo.platform} build failed:`, error.message);
  }
  console.log(''); // Empty line for readability
}

// Copy config files to dist
try {
  fs.copyFileSync('config.js', './dist/config.js');
  fs.copyFileSync('app-config.json', './dist/app-config.json');
  console.log('✅ Configuration files copied to dist folder');
} catch (error) {
  console.error('❌ Failed to copy config files:', error.message);
}

// Create platform-specific startup scripts

// Windows batch file
const windowsBatch = `@echo off
title File Server
echo 🚀 Starting File Server...

REM Check if config.js exists
if not exist "config.js" (
    echo ❌ config.js not found
    echo Please ensure config.js is in the same directory as this script.
    pause
    exit /b 1
)

REM Run the file server
echo 📂 Starting File Server...
FileServer.exe

REM Keep window open on error
if errorlevel 1 (
    echo ❌ File Server encountered an error
    pause
)
`;

// Linux/macOS shell script
const unixScript = `#!/bin/bash

# File Server Startup Script
echo "🚀 Starting File Server..."

# Get the directory where the script is located
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change to the script directory
cd "$DIR"

# Detect platform and set executable name
if [[ "$OSTYPE" == "darwin"* ]]; then
    EXECUTABLE="./FileServer-macos"
    PLATFORM="macOS"
else
    EXECUTABLE="./FileServer-linux"
    PLATFORM="Linux"
fi

# Make the executable file executable if it isn't already
chmod +x "$EXECUTABLE"

# Check if config.js exists
if [ ! -f "config.js" ]; then
    echo "❌ config.js not found in $DIR"
    echo "Please ensure config.js is in the same directory as this script."
    exit 1
fi

# Run the file server
echo "📂 Starting File Server on $PLATFORM from directory: $DIR"
"$EXECUTABLE"

# Keep the terminal open on error
if [ $? -ne 0 ]; then
    echo "❌ File Server encountered an error"
    echo "Press Enter to exit..."
    read
fi
`;

try {
  fs.writeFileSync('./dist/start-server.bat', windowsBatch);
  fs.writeFileSync('./dist/start-server.sh', unixScript);
  console.log('✅ Created startup scripts for all platforms');
} catch (error) {
  console.error('❌ Failed to create startup scripts:', error.message);
}

// Create comprehensive README
const multiPlatformReadme = `# File Server - Multi-Platform

A secure Node.js file server with preview capabilities, available for Windows, Linux, and macOS.

## Quick Start by Platform

### Windows
1. Double-click \`start-server.bat\` OR run \`FileServer.exe\` directly
2. Server will start automatically

### Linux
1. Open terminal in the extracted directory
2. Make script executable: \`chmod +x start-server.sh\`
3. Run: \`./start-server.sh\`

### macOS
1. Open terminal in the extracted directory
2. Make script executable: \`chmod +x start-server.sh\`
3. Run: \`./start-server.sh\`

## Manual Execution

### Windows
\`\`\`cmd
FileServer.exe
\`\`\`

### Linux
\`\`\`bash
chmod +x FileServer-linux
./FileServer-linux
\`\`\`

### macOS
\`\`\`bash
chmod +x FileServer-macos
./FileServer-macos
\`\`\`

## Features

- 🔒 Secure file browsing with path sanitization
- 👁️ Inline preview for multiple file types (images, videos, audio, text, code)
- ⬇️ File download functionality
- 🎯 Modal preview with next/previous navigation
- 🌐 Network access for multiple devices
- 📱 Responsive design

## Configuration

Edit \`config.js\` to modify:
- Server port (default: 3000)
- Host address (default: 0.0.0.0)
- Root directory to serve files from

## Supported File Types for Preview

- **Images**: jpg, jpeg, png, gif, webp, svg, bmp
- **Videos**: mp4, webm, ogg, avi, mov
- **Audio**: mp3, wav, ogg, m4a, flac
- **Code**: js, ts, html, css, json, xml, py, java, cpp, c, php, rb, go, rs, etc.
- **Text**: txt, md, log, yml, yaml, ini, cfg

## Troubleshooting

### Port Already in Use
Edit \`config.js\` and change the port number.

### Permission Issues
- **Linux/macOS**: \`chmod +x FileServer-linux\` or \`chmod +x FileServer-macos\`
- **Windows**: Run as Administrator if needed

### Firewall Issues
Make sure the port (default 3000) is open in your firewall.

## System Requirements

- **Windows**: Windows 10+ (x64)
- **Linux**: Ubuntu 18.04+, CentOS 7+, or similar (x64)
- **macOS**: macOS 10.15+ (x64)
- No Node.js installation required (self-contained executables)

## License

MIT License
`;

try {
  fs.writeFileSync('./dist/README.md', multiPlatformReadme);
  console.log('✅ Created comprehensive README.md');
} catch (error) {
  console.error('❌ Failed to create README:', error.message);
}

console.log('\n🎉 Multi-Platform Build Complete!');
console.log(`✅ Successfully built ${successCount}/${totalTargets} targets`);
console.log('\n📦 Available executables:');
console.log('   - FileServer.exe (Windows)');
console.log('   - FileServer-linux (Linux)');
console.log('   - FileServer-macos (macOS)');
console.log('\n📋 Startup scripts:');
console.log('   - start-server.bat (Windows)');
console.log('   - start-server.sh (Linux/macOS)');
console.log('\n📚 Documentation:');
console.log('   - README.md (Installation guide for all platforms)');
