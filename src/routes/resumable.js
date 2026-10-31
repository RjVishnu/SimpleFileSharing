const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { HttpError, validateName } = require('../lib/paths');

const CHUNK = 8 * 1024 * 1024;
const MAX_SESSIONS = 50;
const IDLE_MS = 24 * 60 * 60 * 1000;

// Chunked, resumable uploads: create a session, PUT chunks at an offset, finish.
// A dropped connection only loses the current chunk; the client asks for the offset and carries on.
function createResumableRouter(cfg, { exists, moveFile, uniquePath }) {
    const router = express.Router();
    const tmpDir = path.join(os.tmpdir(), 'sharecode-uploads');
    const sessions = new Map();

    const drop = (id) => {
        const s = sessions.get(id);
        sessions.delete(id);
        if (s) fsp.unlink(s.tmp).catch(() => {});
    };
    const sweep = setInterval(() => {
        for (const [id, s] of sessions) if (Date.now() - s.touched > IDLE_MS && !s.busy) drop(id);
    }, 10 * 60 * 1000);
    sweep.unref();

    const guard = (req, res, next) =>
        cfg.allowUpload && req.scope.canUpload ? next() : next(new HttpError(403, 'Uploads are disabled'));
    const find = (req) => {
        const s = sessions.get(req.params.id);
        if (!s) throw new HttpError(404, 'Upload session not found');
        s.touched = Date.now();
        return s;
    };

    router.post('/upload/session', guard, async (req, res, next) => {
        try {
            const dir = req.scope.resolveReal(req.body.path);
            if (!(await fsp.stat(dir)).isDirectory()) throw new HttpError(400, 'Target is not a folder');
            const name = validateName(path.basename(String(req.body.name || '')));
            if (cfg.blockedExtensions.includes(path.extname(name).toLowerCase())) throw new HttpError(400, 'File type not allowed');
            const size = Number(req.body.size);
            if (!Number.isSafeInteger(size) || size < 0) throw new HttpError(400, 'Invalid size');
            if (size > cfg.maxUploadBytes) throw new HttpError(413, 'File too large');
            if (sessions.size >= MAX_SESSIONS) throw new HttpError(429, 'Too many uploads in progress');

            await fsp.mkdir(tmpDir, { recursive: true });
            const id = crypto.randomBytes(16).toString('hex');
            const tmp = path.join(tmpDir, `r-${id}`);
            await fsp.writeFile(tmp, '');
            sessions.set(id, { dir, name, size, offset: 0, tmp, busy: false, touched: Date.now() });
            res.status(201).json({ id, offset: 0, chunkSize: CHUNK });
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'Folder not found') : error);
        }
    });

    router.get('/upload/session/:id', guard, (req, res, next) => {
        try {
            const s = find(req);
            res.json({ offset: s.offset, size: s.size, chunkSize: CHUNK });
        } catch (error) {
            next(error);
        }
    });

    router.put('/upload/session/:id', guard, (req, res, next) => {
        let s;
        try {
            s = find(req);
        } catch (error) {
            return next(error);
        }
        const conflict = (message) => res.status(409).json({ error: message, offset: s.offset });
        if (s.busy) return conflict('A chunk is already being written');
        if (Number(req.query.offset) !== s.offset) return conflict('Offset mismatch');
        const declared = Number(req.headers['content-length']);
        if (!Number.isFinite(declared) || declared > CHUNK || s.offset + declared > s.size) {
            return next(new HttpError(413, 'Chunk too large'));
        }

        s.busy = true;
        let received = 0;
        let failed = false;
        const out = fs.createWriteStream(s.tmp, { flags: 'r+', start: s.offset });
        const fail = (error) => {
            if (failed) return;
            failed = true;
            s.busy = false;
            out.destroy();
            if (!res.headersSent) next(error);
        };
        req.on('data', (c) => { received += c.length; });
        req.on('aborted', () => fail(new HttpError(400, 'Upload interrupted')));
        req.on('error', fail);
        out.on('error', fail);
        out.on('finish', () => {
            if (failed) return;
            s.busy = false;
            if (received !== declared) return next(new HttpError(400, 'Chunk was cut short'));
            s.offset += received; // only advances once the whole chunk is on disk
            res.json({ offset: s.offset });
        });
        req.pipe(out);
    });

    router.post('/upload/session/:id/finish', guard, async (req, res, next) => {
        let s;
        try {
            s = find(req);
            if (s.busy) throw new HttpError(409, 'A chunk is still being written');
            if (s.offset !== s.size) throw new HttpError(409, `Incomplete: ${s.offset} of ${s.size} bytes`);
            s.busy = true;
            await fsp.truncate(s.tmp, s.size); // drop stray bytes from an interrupted chunk
            if (!(await exists(s.dir))) throw new HttpError(404, 'Folder not found');
            const target = await uniquePath(s.dir, s.name);
            await moveFile(s.tmp, target);
            sessions.delete(req.params.id);
            res.json({ uploaded: 1, files: [{ name: path.basename(target), size: s.size }], rejected: [] });
        } catch (error) {
            if (s) s.busy = false;
            next(error);
        }
    });

    router.delete('/upload/session/:id', guard, (req, res) => {
        drop(req.params.id);
        res.json({ ok: true });
    });

    return router;
}

module.exports = { createResumableRouter };
