const fs = require('fs').promises;
const express = require('express');
const QRCode = require('qrcode');
const { HttpError } = require('../lib/paths');
const { findNetworkIP } = require('../lib/network');

// Admin-only: create / list / revoke share links, and render QR codes.
function createSharesRouter(cfg, shares) {
    const router = express.Router();

    // The main link is always a network address, so a transfer between two people on the same LAN
    // never touches the internet. A link made while browsing via localhost must still work for other devices.
    function lanOrigin(req) {
        const host = req.hostname;
        const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
        const viaPublic = cfg.publicUrl && host === new URL(cfg.publicUrl).hostname;
        return `${req.protocol}://${loopback || viaPublic ? findNetworkIP() : host}:${cfg.port}`;
    }

    const present = (req, share) => ({
        ...share,
        url: `${lanOrigin(req)}/s/${share.token}`, // same network
        internetUrl: cfg.publicUrl ? `${cfg.publicUrl}/s/${share.token}` : null, // anyone, over the internet
    });

    router.post('/shares', async (req, res, next) => {
        try {
            const abs = req.scope.resolveReal(req.body.path);
            const stats = await fs.stat(abs);
            const minutes = Number(req.body.expiresInMinutes) || 0;
            if (minutes < 0 || minutes > 60 * 24 * 365) throw new HttpError(400, 'Invalid expiry');
            const share = shares.create({
                path: req.body.path || '',
                abs, // real location, so the link keeps working if folders are reorganised
                type: stats.isDirectory() ? 'folder' : 'file',
                expiresInMinutes: minutes,
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
