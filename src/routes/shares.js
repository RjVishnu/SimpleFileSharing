const fs = require('fs').promises;
const express = require('express');
const QRCode = require('qrcode');
const { HttpError } = require('../lib/paths');
const { hashPassword } = require('../lib/password');
const { findNetworkIP } = require('../lib/network');

// Admin-only: create / list / revoke share links, and render QR codes.
function createSharesRouter(cfg, shares) {
    const router = express.Router();

    // The main link is always a network address, so a transfer between two people on the same LAN
    // never touches the internet. A link made while browsing via localhost must still work for other devices.
    function lanOrigin(req) {
        let seen;
        try {
            seen = new URL(`${req.protocol}://${req.get('host')}`);
        } catch {
            return cfg.lanUrl || `${req.protocol}://${findNetworkIP()}:${cfg.port}`;
        }
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(seen.hostname);
        const viaPublic = cfg.publicUrl && seen.hostname === new URL(cfg.publicUrl).hostname;
        if (!loopback && !viaPublic) return seen.origin; // already a LAN name/address, with the port the visitor used
        if (cfg.lanUrl) return cfg.lanUrl;
        // The port people use may differ from the one we listen on (Docker port mapping)
        const port = viaPublic ? cfg.port : seen.port || cfg.port;
        return `${req.protocol}://${findNetworkIP()}:${port}`;
    }

    // The password hash never leaves the server.
    const present = (req, { pw, ...share }) => ({
        ...share,
        protected: Boolean(pw),
        url: `${lanOrigin(req)}/s/${share.token}`, // same network
        internetUrl: cfg.publicUrl ? `${cfg.publicUrl}/s/${share.token}` : null, // anyone, over the internet
    });

    router.post('/shares', async (req, res, next) => {
        try {
            const abs = req.scope.resolveReal(req.body.path);
            const stats = await fs.stat(abs);
            const minutes = Number(req.body.expiresInMinutes) || 0;
            if (minutes < 0 || minutes > 60 * 24 * 365) throw new HttpError(400, 'Invalid expiry');
            const password = req.body.password;
            if (password) {
                if (typeof password !== 'string' || password.length < 4 || password.length > 128) {
                    throw new HttpError(400, 'The password must be 4 to 128 characters');
                }
            }
            const share = shares.create({
                path: req.body.path || '',
                abs, // real location, so the link keeps working if folders are reorganised
                type: stats.isDirectory() ? 'folder' : 'file',
                expiresInMinutes: minutes,
                passwordHash: password ? await hashPassword(password) : null,
            });
            res.status(201).json(present(req, share));
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'Not found') : error);
        }
    });

    router.get('/shares', (req, res) => res.json(shares.list().map((s) => present(req, s))));

    router.delete('/shares/:token', (req, res, next) =>
        shares.remove(req.params.token) ? res.json({ ok: true }) : next(new HttpError(404, 'Share not found'))
    );

    router.get('/qr', async (req, res, next) => {
        try {
            const text = String(req.query.text || '');
            if (!text || text.length > 500) throw new HttpError(400, 'Invalid text');
            res.type('image/svg+xml').send(await QRCode.toString(text, { type: 'svg', margin: 1 }));
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = { createSharesRouter };
