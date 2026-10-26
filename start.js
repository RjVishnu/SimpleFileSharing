#!/usr/bin/env node

/**
 * File Server Startup Script
 * A modern, secure file server with web-based file browser and preview functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  // Server settings
  server: {
    host: 'auto', // 'auto' for network IP, 'localhost', or specific IP
    port: 5001,
    name: 'File Server'
  },
  
  // Directory to serve
  directory: process.env.FILE_SERVER_DIR || 'C:/NAS/Jeevan-Tech',
  
  // Security settings
  security: {
    enableDotfiles: false,
    enableDirectoryIndex: false,
    allowedExtensions: [], // Empty array means all extensions allowed
    blockedExtensions: ['.exe', '.bat', '.cmd', '.scr'] // Security: block executable files
  },
  
  // Feature flags
  features: {
    preview: true,
    download: true,
    navigation: true,
    syntaxHighlighting: true
  },
  
  // Logging
  logging: {
    enabled: true,
    level: 'info' // 'debug', 'info', 'warn', 'error'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  if (CONFIG.logging.enabled) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }
}

function logError(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Validate configuration
function validateConfig() {
  log('🔍 Validating configuration...', 'cyan');
  
  // Check if directory exists
  if (!fs.existsSync(CONFIG.directory)) {
    logError(`Directory does not exist: ${CONFIG.directory}`);
    process.exit(1);
  }
  
  // Check if directory is readable
  try {
    fs.accessSync(CONFIG.directory, fs.constants.R_OK);
  } catch (error) {
    logError(`Directory is not readable: ${CONFIG.directory}`);
    process.exit(1);
  }
  
  // Validate port
  if (CONFIG.server.port < 1 || CONFIG.server.port > 65535) {
    logError('Port must be between 1 and 65535');
    process.exit(1);
  }
  
  logSuccess('Configuration validated');
}

// Get network IP
function getNetworkIP() {
  const networkInterfaces = os.networkInterfaces();
  
  for (const key of Object.keys(networkInterfaces)) {
    const networkInterface = networkInterfaces[key];
    for (const iface of networkInterface) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
        return iface.address;
      }
    }
  }
  
  logWarning('No external network interface found, using localhost');
  return 'localhost';
}

// Update config.js file
function updateConfigFile() {
  const host = CONFIG.server.host === 'auto' ? getNetworkIP() : CONFIG.server.host;
  
  const configContent = `// Auto-generated configuration file
// Generated on: ${new Date().toISOString()}

module.exports = {
  server: {
    host: '${host}',
    port: ${CONFIG.server.port},
    name: '${CONFIG.server.name}'
  },
  directory: '${CONFIG.directory.replace(/\\/g, '/')}',
  security: {
    enableDotfiles: ${CONFIG.security.enableDotfiles},
    enableDirectoryIndex: ${CONFIG.security.enableDirectoryIndex},
    allowedExtensions: ${JSON.stringify(CONFIG.security.allowedExtensions)},
    blockedExtensions: ${JSON.stringify(CONFIG.security.blockedExtensions)}
  },
  features: {
    preview: ${CONFIG.features.preview},
    download: ${CONFIG.features.download},
    navigation: ${CONFIG.features.navigation},
    syntaxHighlighting: ${CONFIG.features.syntaxHighlighting}
  },
  logging: {
    enabled: ${CONFIG.logging.enabled},
    level: '${CONFIG.logging.level}'
  }
};
`;
  
  fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
  logSuccess('Configuration file updated');
}

// Check for command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--port':
      case '-p':
        CONFIG.server.port = parseInt(args[++i]) || CONFIG.server.port;
        break;
        
      case '--host':
      case '-h':
        CONFIG.server.host = args[++i] || CONFIG.server.host;
        break;
        
      case '--directory':
      case '--dir':
      case '-d':
        CONFIG.directory = args[++i] || CONFIG.directory;
        break;
        
      case '--help':
        showHelp();
        process.exit(0);
        break;
        
      case '--version':
      case '-v':
        showVersion();
        process.exit(0);
        break;
        
      default:
        if (arg.startsWith('-')) {
          logWarning(`Unknown argument: ${arg}`);
        }
    }
  }
}

function showHelp() {
  console.log(`
${colors.bright}File Server - Modern Web-based File Browser${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node start.js [options]

${colors.cyan}Options:${colors.reset}
  -p, --port <number>        Server port (default: 5001)
  -h, --host <host>          Server host (default: auto)
  -d, --directory <path>     Directory to serve (default: C:/NAS/Jeevan-Tech)
  --help                     Show this help message
  -v, --version              Show version information

${colors.cyan}Examples:${colors.reset}
  node start.js                           # Start with default settings
  node start.js -p 8080                   # Start on port 8080
  node start.js -h localhost              # Start on localhost only
  node start.js -d "C:/Users/Documents"   # Serve different directory

${colors.cyan}Features:${colors.reset}
  • 🖼️  Image preview (jpg, png, gif, svg, etc.)
  • 🎬 Video player (mp4, webm, etc.)
  • 🎵 Audio player (mp3, wav, etc.)
  • 📄 Text/code preview with syntax highlighting
  • 📋 PDF viewer
  • ⬅️➡️ Navigation between files
  • ⬇️ Download functionality
  • 🔒 Security features
  • 📱 Mobile responsive design
`);
}

function showVersion() {
  const packageInfo = require('./package.json');
  console.log(`
${colors.bright}File Server v${packageInfo.version}${colors.reset}
${colors.cyan}A modern, secure file server with preview functionality${colors.reset}
`);
}

// Main startup function
function startServer() {
  log(`
${colors.bright}🚀 Starting File Server...${colors.reset}
`, 'bright');

  // Parse command line arguments
  parseArguments();
  
  // Validate configuration
  validateConfig();
  
  // Update config file
  updateConfigFile();
  
  // Show startup information
  logInfo(`Server Name: ${CONFIG.server.name}`);
  logInfo(`Directory: ${CONFIG.directory}`);
  logInfo(`Host: ${CONFIG.server.host === 'auto' ? getNetworkIP() : CONFIG.server.host}`);
  logInfo(`Port: ${CONFIG.server.port}`);
  
  // Start the server
  log('🔄 Starting server process...', 'cyan');
  
  const serverProcess = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  serverProcess.on('error', (error) => {
    logError(`Failed to start server: ${error.message}`);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      logError(`Server exited with code ${code}`);
      process.exit(code);
    }
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n🛑 Shutting down...', 'yellow');
    serverProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    log('\n🛑 Terminating...', 'yellow');
    serverProcess.kill('SIGTERM');
  });
}

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = { CONFIG, startServer };
