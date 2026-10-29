const fs = require('fs');
const path = require('path');
const legacy = require('../config');

const truthy = (value, fallback) =>
    value === undefined ? fallback : /^(1|true|yes|on)$/i.test(String(value));

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const match = /^--([a-z-]+)(?:=(.*))?$/i.exec(argv[i]);
        if (!match) continue;
        args[match[1]] = match[2] !== undefined ? match[2] : argv[++i];
    }
    return args;
}

function loadBrand(args, env) {
    const color = args['brand-color'] || env.BRAND_COLOR || '';
    const logo = args['brand-logo'] || env.BRAND_LOGO || '';
    const logoOk = logo && fs.existsSync(logo) && /\.(png|jpe?g|svg|webp|ico|gif)$/i.test(logo);
    return {
        name: args['brand-name'] || env.BRAND_NAME || '',
        color: /^#[0-9a-f]{6}$/i.test(color) ? color : '',
        logoPath: logoOk ? path.resolve(logo) : '',
    };
}

// Optional address people outside the network use (port-forward, reverse proxy or tunnel). Must be http(s).
function loadPublicUrl(args, env) {
    const raw = String(args['public-url'] || env.PUBLIC_URL || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw);
        if (!/^https?:$/.test(url.protocol)) throw new Error('not http(s)');
        return url.origin + url.pathname.replace(/\/+$/, '');
    } catch {
        console.warn(`Ignoring invalid PUBLIC_URL "${raw}" (expected e.g. https://files.example.com)`);
        return '';
    }
}

function load(argv = process.argv.slice(2), env = process.env) {
    const args = parseArgs(argv);

    let root = args.dir || env.SHARE_ROOT || legacy.directory;
    if (!root || !fs.existsSync(root)) {
        const fallback = path.resolve(process.cwd(), 'shared-files');
        console.warn(`Shared folder "${root}" not found, using ${fallback}`);
        fs.mkdirSync(fallback, { recursive: true });
        root = fallback;
    }

    const password = args.password || env.SHARE_PASSWORD || '';

    return {
        host: args.host || env.HOST || legacy.server.host,
        port: Number(args.port || env.PORT || legacy.server.port),
        root: fs.realpathSync(path.resolve(root)),
        password,
        allowUpload: truthy(args['allow-upload'] ?? env.ALLOW_UPLOAD, true),
        // Delete / rename / new folder: on when a password is set, or when explicitly enabled.
        // Choosing shared folders in the UI: always allowed with a password or from this computer.
        allowSettings: truthy(args['allow-settings'] ?? env.ALLOW_SETTINGS, false),
        allowModify: truthy(args['allow-modify'] ?? env.ALLOW_MODIFY, Boolean(password)),
        maxUploadBytes: Number(env.MAX_UPLOAD_MB || 2048) * 1024 * 1024,
        blockedExtensions: (env.BLOCKED_EXT ?? '.exe,.bat,.cmd,.com,.msi,.scr,.ps1,.vbs,.dll')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        brand: loadBrand(args, env),
        publicUrl: loadPublicUrl(args, env),
        maxZipFiles: Number(env.MAX_ZIP_FILES || 500),
        dataDir: path.resolve(env.DATA_DIR || path.join(process.cwd(), 'data')),
    };
}

module.exports = { load };
