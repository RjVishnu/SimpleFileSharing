const fs = require('fs');
const path = require('path');
const express = require('express');
const { createAuth } = require('./middleware/auth');
const { securityHeaders } = require('./middleware/security');
const { ShareStore } = require('./services/shareStore');
const { createBrowseRouter } = require('./routes/browse');
const { createFilesRouter } = require('./routes/files');
const { createUploadRouter } = require('./routes/upload');
const { createManageRouter } = require('./routes/manage');
const { createSharesRouter } = require('./routes/shares');
const { createFoldersRouter } = require('./routes/folders');
const { Thumbnails } = require('./services/thumbnails');
const { createP2PRouter } = require('./routes/p2p');
const { SettingsStore } = require('./services/settingsStore');
const { createScope } = require('./lib/scope');
const { isInside, HttpError } = require('./lib/paths');
const { isLocalClient } = require('./lib/network');

// A reverse proxy or tunnel on this machine makes internet visitors look like 127.0.0.1.
// Any forwarding header means the request did not originate here.
const forwarded = (req) => Boolean(req.headers['x-forwarded-for'] || req.headers.forwarded || req.headers['x-real-ip']);
const clientIsLocal = (req) => !forwarded(req) && isLocalClient(req.ip);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp(cfg) {
    const app = express();
    const auth = createAuth(cfg);
    const shares = new ShareStore(cfg.dataDir);
    const settings = new SettingsStore(cfg.dataDir, cfg.root);
    const indexHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

    app.disable('x-powered-by');
    app.use(securityHeaders);
    app.use(express.json({ limit: '1mb' }));
    app.use(express.static(PUBLIC_DIR, { index: false }));
    app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
    app.use(auth.router);

    // Public branding (name / accent color / logo) used by the app and the login page.
    app.get('/brand.json', (req, res) =>
        res.json({ name: cfg.brand.name, color: cfg.brand.color, logo: Boolean(cfg.brand.logoPath) })
    );
    app.get('/brand-logo', (req, res, next) => {
        if (!cfg.brand.logoPath) return next(new HttpError(404, 'Not found'));
        res.setHeader('Content-Security-Policy', 'sandbox');
        res.sendFile(cfg.brand.logoPath, { dotfiles: 'allow' });
    });

    const renderIndex = (base) => (req, res) => res.type('html').send(indexHtml.replace('__BASE__', base));

    // Routes shared by the admin scope (/api) and share links (/s/:token/api).
    // Each request carries a `scope` describing what it may touch.
    const scoped = express.Router({ mergeParams: true });
    scoped.use(createBrowseRouter());
    const thumbs = cfg.thumbnails ? new Thumbnails(path.join(cfg.dataDir, 'thumbs'), cfg.thumbCacheBytes) : null;
    scoped.use(createFilesRouter(cfg, shares, thumbs));
    scoped.use(createUploadRouter(cfg));
    scoped.use(createManageRouter());

    // Changing which folders are shared needs a password, ALLOW_SETTINGS=true, or access from this computer.
    const isLoopback = (req) => !forwarded(req) && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);

    // Admin
    app.get('/', auth.requireAuth, renderIndex(''));
    const admin = express.Router();
    admin.use(auth.requireAuth);
    admin.use((req, res, next) => {
        req.scope = createScope(settings.mounts(), {
            canUpload: cfg.allowUpload,
            canModify: cfg.allowModify,
            canManage: Boolean(cfg.password) || cfg.allowSettings || isLoopback(req),
        });
        next();
    });
    admin.get('/me', (req, res) =>
        res.json({
            mode: 'admin',
            canUpload: req.scope.canUpload,
            canModify: req.scope.canModify,
            canShare: true,
            canManage: req.scope.canManage,
            multiRoot: !req.scope.flat,
            hasPassword: Boolean(cfg.password),
            rootName: req.scope.flat ? req.scope.mounts[0].name : 'Shared folders',
            local: clientIsLocal(req),
            hasPublicUrl: Boolean(cfg.publicUrl),
            canP2P: cfg.allowP2P,
            thumbs: Boolean(thumbs && thumbs.ready),
        })
    );
    admin.use(createFoldersRouter(settings));
    if (cfg.allowP2P) {
        const roomOf = (req) => (clientIsLocal(req) ? 'lan' : String(req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim());
        admin.use(createP2PRouter(cfg, { roomOf }));
    }
    admin.use(createSharesRouter(cfg, shares));
    admin.use(scoped);
    app.use('/api', admin);

    // Share links (public; limited to the shared file/folder, read-only)
    const share = express.Router({ mergeParams: true });
    share.use((req, res, next) => {
        const record = shares.get(req.params.token);
        const mounts = settings.mounts();
        // The link dies if its folder is no longer shared or no longer exists.
        if (!record || !record.abs || !mounts.some((m) => isInside(m.path, record.abs)) || !fs.existsSync(record.abs)) {
            return next(new HttpError(404, 'This link is invalid or has expired'));
        }
        req.scope =
            record.type === 'file'
                ? createScope([{ name: '', path: path.dirname(record.abs) }], { only: path.basename(record.abs), token: record.token })
                : createScope([{ name: '', path: record.abs }], { token: record.token });
        next();
    });
    share.get('/api/me', (req, res) =>
        res.json({ mode: 'share', canUpload: false, canModify: false, canShare: false, rootName: 'Shared', local: clientIsLocal(req), thumbs: Boolean(thumbs && thumbs.ready) })
    );
    share.use('/api', scoped);
    share.get('/', (req, res) => renderIndex(`/s/${req.params.token}`)(req, res));
    app.use('/s/:token', share);

    app.use((req, res, next) => next(new HttpError(404, 'Not found')));
    app.use((error, req, res, next) => {
        const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
        if (status === 500) console.error('Unhandled error:', error);
        if (res.headersSent) return res.destroy();
        const message = status === 500 ? 'Internal server error' : error.message;
        if (req.originalUrl.includes('/api/')) return res.status(status).json({ error: message });
        res.status(status).type('text').send(message);
    });

    return app;
}

module.exports = { createApp };
