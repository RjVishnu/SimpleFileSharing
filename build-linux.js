#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🐧 Building File Server for Linux...\n');

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

// Build the Linux executable
console.log('🔨 Building Linux executable...');
try {
  execSync('npx pkg . --target node18-linux-x64 --output ./dist/FileServer-linux', { stdio: 'inherit' });
  console.log('✅ Linux executable built successfully!');
  console.log('📁 Location: ./dist/FileServer-linux');
  
  // Copy config files to dist
  fs.copyFileSync('config.js', './dist/config.js');
  fs.copyFileSync('app-config.json', './dist/app-config.json');
  console.log('✅ Configuration files copied to dist folder');
  
  // Create a Linux startup script
  const linuxScript = `#!/bin/bash

# File Server Linux Startup Script
echo "🚀 Starting File Server..."

# Get the directory where the script is located
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change to the script directory
cd "$DIR"

# Make the executable file executable if it isn't already
chmod +x ./FileServer-linux

# Check if config.js exists
if [ ! -f "config.js" ]; then
    echo "❌ config.js not found in $DIR"
    echo "Please ensure config.js is in the same directory as this script."
    exit 1
fi

# Run the file server
echo "📂 Starting File Server from directory: $DIR"
./FileServer-linux

# Keep the terminal open on error
if [ $? -ne 0 ]; then
    echo "❌ File Server encountered an error"
    echo "Press Enter to exit..."
    read
fi
`;

  fs.writeFileSync('./dist/start-server.sh', linuxScript);
  console.log('✅ Created Linux startup script: start-server.sh');
  
  // Create installation instructions for Linux
  const linuxReadme = `# File Server - Linux Installation

## Quick Start

1. Extract all files to a directory
2. Open terminal in the extracted directory
3. Make the startup script executable:
   \`\`\`bash
   chmod +x start-server.sh
   \`\`\`
4. Run the server:
   \`\`\`bash
   ./start-server.sh
   \`\`\`

## Alternative: Direct Execution

You can also run the executable directly:
\`\`\`bash
chmod +x FileServer-linux
./FileServer-linux
\`\`\`

## Configuration

Edit \`config.js\` to modify:
- Server port (default: 3000)
- Host address (default: 0.0.0.0)
- Root directory to serve files from

## System Requirements

- Linux x64 (Ubuntu 18.04+, CentOS 7+, or similar)
- No Node.js installation required (self-contained)

## Troubleshooting

### Permission Denied
\`\`\`bash
chmod +x FileServer-linux
chmod +x start-server.sh
\`\`\`

### Port Already in Use
Edit \`config.js\` and change the port number.

### Firewall Issues
Make sure the port (default 3000) is open:
\`\`\`bash
sudo ufw allow 3000
\`\`\`

## Features

- 🔒 Secure file browsing
- 👁️ File preview (images, videos, audio, code)
- ⬇️ File download
- 🎯 Modal preview with navigation
- 🌐 Network access
- 📱 Responsive design
`;

  fs.writeFileSync('./dist/README-Linux.md', linuxReadme);
  console.log('✅ Created Linux installation guide: README-Linux.md');
  
  console.log('\n🎉 Linux Build Complete!');
  console.log('📦 Files created:');
  console.log('   - FileServer-linux (executable)');
  console.log('   - start-server.sh (startup script)');
  console.log('   - config.js (configuration)');
  console.log('   - README-Linux.md (installation guide)');
  console.log('\n📋 To use on Linux:');
  console.log('   1. Copy all files to Linux system');
  console.log('   2. chmod +x start-server.sh');
  console.log('   3. ./start-server.sh');
  
} catch (error) {
  console.error('❌ Linux build failed:', error.message);
  process.exit(1);
}
