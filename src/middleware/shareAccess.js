const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { verifyPassword } = require('../lib/password');

const COOKIE = 'su';
const SESSION_MS = 12 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const PER_VISITOR = 10; // wrong guesses per link and address per window
const PER_LINK = 40; // wrong guesses per link per window, whoever they come from
const UNLOCK_PAGE = path.join(__dirname, '..', '..', 'public', 'unlock.html');

// Password-protected share links: visitors unlock a link once and get a signed cookie scoped to that link.
// The cookie secret is regenerated at every start, so unlocked links lock again after a restart.
function createShareAccess() {
    const secret = crypto.randomBytes(32);
    const sign = (token, expires) => crypto.createHmac('sha256', secret).update(`${token}.${expires}`).digest('base64url');
    const attempts = new Map(); // key -> { count, resetAt }

    function bump(key, limit, record = false) {
        const now = Date.now();
        if (attempts.size > 5000) for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
        let entry = attempts.get(key);
        if (!entry || entry.resetAt < now) entry = { count: 0, resetAt: now + WINDOW_MS };
        if (record) entry.count++;
        attempts.set(key, entry);
        return entry.count >= limit;
    }

    function isUnlocked(req, record) {
        if (!record.pw) return true;
        const match = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || '');
        const [expires, sig] = (match ? match[1] : '').split('.');
        if (!expires || !sig || Number(expires) < Date.now()) return false;
        const expected = Buffer.from(sign(record.token, expires));
        const given = Buffer.from(sig);
        return expected.length === given.length && crypto.timingSafeEqual(expected, given);
    }

    const router = express.Router({ mergeParams: true });

    router.post('/unlock', async (req, res, next) => {
        try {
            const record = req.shareRecord;
            if (!record.pw) return res.json({ ok: true });

            const visitor = `${record.token}|${req.ip}`;
            if (bump(visitor, PER_VISITOR) || bump(record.token, PER_LINK)) {
                return res.status(429).json({ error: 'Too many attempts, try again later' });
            }
            if (!(await verifyPassword((req.body && req.body.password) || '', record.pw))) {
                bump(visitor, PER_VISITOR, true);
                bump(record.token, PER_LINK, true);
                return res.status(401).json({ error: 'Wrong password' });
            }

            attempts.delete(visitor);
            const expires = String(Date.now() + SESSION_MS);
            res.cookie(COOKIE, `${expires}.${sign(record.token, expires)}`, {
                httpOnly: true,
                sameSite: 'lax',
                path: `/s/${record.token}`,
                maxAge: SESSION_MS,
            });
            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    });

    // Everything except unlocking itself needs the cookie on a protected link.
    function gate(req, res, next) {
        if (isUnlocked(req, req.shareRecord)) return next();
        if (req.method === 'GET' && (req.path === '/' || req.path === '')) return res.sendFile(UNLOCK_PAGE);
        res.status(401).json({ error: 'Password required', locked: true });
    }

    return { router, gate };
}

module.exports = { createShareAccess };
