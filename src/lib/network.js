const os = require('os');

function findNetworkIP() {
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces || []) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

module.exports = { findNetworkIP };
