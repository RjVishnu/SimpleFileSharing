// Default settings. Every value can be overridden by environment variables
// (SHARE_ROOT, PORT, HOST, SHARE_PASSWORD, ...) or CLI flags (--dir, --port, --password).
// See README.md for the full list.
module.exports = {
    server: {
        host: '0.0.0.0', // Listen on all interfaces so localhost and LAN both work
        port: 5002,
    },
    directory: 'D:\\S Wedding Studio', // Root directory to share (falls back to ./shared-files if missing)
};
