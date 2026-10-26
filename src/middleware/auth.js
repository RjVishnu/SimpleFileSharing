const crypto = require('crypto');
const express = require('express');

const COOKIE = 'sid';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const sha = (value) => crypto.createHash('sha256').update(value).digest();

function createAuth(cfg) {
    const secret = crypto.randomBytes(32);
    const hmac = (value) => crypto.createHmac('sha256', secret).update(value).digest('base64url');
    const attempts = new Map(); // ip -> { count, resetAt }

    function cookieValue(req) {
        const match = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || '');
        return match ? match[1] : '';
    }

    function isAuthed(req) {
        if (!cfg.password) return true;
        const [expires, sig] = cookieValue(req).split('.');
        if (!expires || !sig || Number(expires) < Date.now()) return false;
        const expected = Buffer.from(hmac(expires));
        const given = Buffer.from(sig);
        return expected.length === given.length && crypto.timingSafeEqual(expected, given);
    }

    function requireAuth(req, res, next) {
        if (isAuthed(req)) return next();
        if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Login required' });
        res.redirect('/login');
    }

    const router = express.Router();

    router.post('/login', (req, res) => {
        const now = Date.now();
        const entry = attempts.get(req.ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
        if (entry.resetAt < now) Object.assign(entry, { count: 0, resetAt: now + 15 * 60 * 1000 });
        if (entry.count >= 10) return res.status(429).json({ error: 'Too many attempts, try again later' });

        const given = String((req.body && req.body.password) || '');
        if (!cfg.password || !crypto.timingSafeEqual(sha(given), sha(cfg.password))) {
            entry.count++;
            attempts.set(req.ip, entry);
            return res.status(401).json({ error: 'Wrong password' });
        }

        attempts.delete(req.ip);
        const expires = String(now + SESSION_MS);
        res.cookie(COOKIE, `${expires}.${hmac(expires)}`, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: SESSION_MS,
        });
        res.json({ ok: true });
    });

    router.post('/logout', (req, res) => {
        res.clearCookie(COOKIE);
        res.json({ ok: true });
    });

    return { isAuthed, requireAuth, router };
}

module.exports = { createAuth };
