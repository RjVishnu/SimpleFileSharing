#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building File Server Executable...\n');

// package.json already holds the pkg config (scripts, assets, targets); do not regenerate it.

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

// Build the executable
console.log('🔨 Building executable...');
try {
  execSync('npx pkg . --target node18-win32-x64 --output ./dist/FileServer.exe', { stdio: 'inherit' });
  console.log('✅ Executable built successfully!');
  console.log('📁 Location: ./dist/FileServer.exe');
  
  // Copy config file to dist
  fs.copyFileSync('config.js', './dist/config.js');
  fs.copyFileSync('app-config.json', './dist/app-config.json');
  console.log('✅ Configuration files copied to dist folder');
  
  console.log('\n🎉 Build Complete!');
  console.log('You can now run: ./dist/FileServer.exe');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
