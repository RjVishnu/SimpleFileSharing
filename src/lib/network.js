const os = require('os');

// Adapters that exist only inside this machine (VMs, containers, WSL) are unreachable from other devices.
const VIRTUAL = /vethernet|virtualbox|vmware|vmnet|docker|wsl|hyper-v|loopback|tailscale|zerotier|bridge|veth|br-/i;

const privateV4 = (ip) => {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

// Rank real LAN addresses first: 192.168.x, then 10.x, then 172.16-31.x, then everything else.
const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : privateV4(ip) ? 2 : 3);

// All addresses other devices could use to reach this machine, best first.
function lanAddresses() {
    const found = [];
    for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
        for (const iface of ifaces || []) {
            if (iface.family !== 'IPv4' || iface.internal || iface.address.startsWith('169.254.')) continue;
            found.push({ name, address: iface.address, virtual: VIRTUAL.test(name) });
        }
    }
    return found.sort((x, y) => x.virtual - y.virtual || rank(x.address) - rank(y.address));
}

function findNetworkIP() {
    const best = lanAddresses()[0];
    return best ? best.address : 'localhost';
}

// True when the request came from this machine or a private/LAN address, i.e. the transfer never leaves the network.
function isLocalClient(ip = '') {
    const addr = ip.replace(/^::ffff:/i, '');
    if (addr === '::1' || addr === '127.0.0.1') return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(addr) || /^fe80:/i.test(addr)) return true; // IPv6 unique-local / link-local
    return /^\d+\.\d+\.\d+\.\d+$/.test(addr) && (privateV4(addr) || addr.startsWith('169.254.') || addr.startsWith('127.'));
}

module.exports = { findNetworkIP, lanAddresses, isLocalClient };
