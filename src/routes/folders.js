const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const { HttpError } = require('../lib/paths');

// Admin-only: choose which folders of this computer are shared.
function createFoldersRouter(settings) {
    const router = express.Router();

    const guard = (req, res, next) =>
        req.scope.canManage ? next() : next(new HttpError(403, 'Managing folders requires a password (or access from this computer)'));

    router.get('/folders', guard, (req, res) => res.json(settings.list()));

    router.post('/folders', guard, async (req, res, next) => {
        try {
            const given = String((req.body && req.body.path) || '');
            if (!path.isAbsolute(given)) throw new HttpError(400, 'Enter a full folder path, e.g. D:\\Photos');
            let real;
            try {
                real = await fs.realpath(given);
                if (!(await fs.stat(real)).isDirectory()) throw new Error('not a directory');
            } catch {
                throw new HttpError(400, 'That folder does not exist');
            }
            res.status(201).json(settings.add(real, req.body.name));
        } catch (error) {
            next(error);
        }
    });

    router.put('/folders/:id', guard, (req, res, next) => {
        try {
            res.json(settings.rename(req.params.id, req.body && req.body.name));
        } catch (error) {
            next(error);
        }
    });

    // Stops sharing only; nothing is deleted from disk.
    router.delete('/folders/:id', guard, (req, res, next) => {
        try {
            settings.remove(req.params.id);
            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    });

    // Folder picker: list sub-folders of a directory on this computer ('' = drives / filesystem root).
    router.get('/host/dirs', guard, async (req, res, next) => {
        try {
            const given = String(req.query.path || '');
            if (!given && process.platform === 'win32') {
                const drives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
                    .map((l) => `${l}:\\`)
                    .filter((d) => require('fs').existsSync(d));
                return res.json({ path: '', parent: null, dirs: drives.map((d) => ({ name: d, path: d })) });
            }
            const dir = path.resolve(given || path.sep);
            let entries;
            try {
                entries = await fs.readdir(dir, { withFileTypes: true });
            } catch {
                throw new HttpError(400, 'Cannot open that folder');
            }
            const dirs = entries
                .filter((e) => e.isDirectory())
                .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            const parent = path.dirname(dir);
            res.json({ path: dir, parent: parent === dir ? (process.platform === 'win32' ? '' : null) : parent, dirs });
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = { createFoldersRouter };
