#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building File Server Executable...\n');

// Read app configuration
const appConfig = JSON.parse(fs.readFileSync('app-config.json', 'utf8'));

// Create package.json for pkg if it doesn't exist or update it
const packageJson = {
  "name": "file-server-app",
  "version": appConfig.version,
  "description": appConfig.description,
  "main": "server.js",
  "bin": "server.js",
  "scripts": {
    "start": "node server.js",
    "build": "node build.js",
    "build-exe": "pkg . --target win32-x64 --output ./dist/FileServer.exe"
  },
  "pkg": {
    "scripts": [
      "server.js"
    ],
    "assets": [
      "config.js",
      "app-config.json"
    ],
    "targets": [
      "node18-win32-x64"
    ],
    "outputPath": "./dist"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "pkg": "^5.8.1"
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "author": appConfig.author,
  "license": "MIT"
};

// Write updated package.json
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json for executable build');

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
