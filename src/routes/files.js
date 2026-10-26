const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const express = require('express');
const { HttpError } = require('../lib/paths');
const { kindOf } = require('../lib/fileTypes');

const TEXT_PREVIEW_MAX = 2 * 1024 * 1024;

function createFilesRouter(cfg, shares) {
    const router = express.Router();

    // Serve a file inline (preview) or as an attachment (?download=1). Supports Range requests.
    router.get('/file', async (req, res, next) => {
        try {
            const { scope } = req;
            const abs = scope.resolveReal(req.query.path);
            if (!(await fs.stat(abs)).isFile()) throw new HttpError(404, 'File not found');

            const download = req.query.download === '1';
            if (download && scope.token) shares.countDownload(scope.token);

            // Uploaded HTML/SVG must never run scripts on our origin.
            if (path.extname(abs).toLowerCase() !== '.pdf') res.setHeader('Content-Security-Policy', 'sandbox');

            const options = { dotfiles: 'allow' };
            if (download) res.download(abs, path.basename(abs), options, (err) => err && next(err));
            else res.sendFile(abs, options, (err) => err && next(err));
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'File not found') : error);
        }
    });

    router.get('/text', async (req, res, next) => {
        try {
            const abs = req.scope.resolveReal(req.query.path);
            const stats = await fs.stat(abs);
            if (!stats.isFile() || kindOf(abs) !== 'text') throw new HttpError(400, 'Not a text file');
            if (stats.size > TEXT_PREVIEW_MAX) throw new HttpError(413, 'File too large to preview');
            res.json({ name: path.basename(abs), content: await fs.readFile(abs, 'utf8') });
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'File not found') : error);
        }
    });

    // Zip selected files and/or folders: { paths: ["a/b.txt", "folder"] }
    router.post('/zip', async (req, res, next) => {
        try {
            const { scope } = req;
            const paths = req.body && req.body.paths;
            if (!Array.isArray(paths) || !paths.length) throw new HttpError(400, 'No files specified');
            if (paths.length > cfg.maxZipFiles) throw new HttpError(400, `Too many items (max ${cfg.maxZipFiles})`);

            const entries = [];
            for (const p of paths) {
                const abs = scope.resolveReal(p);
                const stats = await fs.stat(abs);
                entries.push({ abs, name: path.basename(abs), isDir: stats.isDirectory() });
            }

            if (scope.token) shares.countDownload(scope.token);
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.attachment(`files-${stamp}.zip`);

            const archive = archiver('zip', { zlib: { level: 6 } });
            archive.on('error', (err) => res.destroy(err));
            res.on('close', () => archive.abort());
            archive.pipe(res);
            for (const entry of entries) {
                if (entry.isDir) archive.directory(entry.abs, entry.name);
                else archive.file(entry.abs, { name: entry.name });
            }
            await archive.finalize();
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'File not found') : error);
        }
    });

    return router;
}

module.exports = { createFilesRouter };
