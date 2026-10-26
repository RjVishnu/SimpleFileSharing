const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const { HttpError } = require('../lib/paths');
const { kindOf } = require('../lib/fileTypes');

const SEARCH_MAX_RESULTS = 300;
const SEARCH_MAX_VISITED = 5000;
const SEARCH_MAX_DEPTH = 6;

const describe = (scope, abs, stats, name) => ({
    name,
    path: scope.rel(abs),
    type: stats.isDirectory() ? 'folder' : 'file',
    kind: kindOf(name, stats.isDirectory()),
    size: stats.isDirectory() ? null : stats.size,
    modified: stats.mtimeMs,
});

function createBrowseRouter() {
    const router = express.Router();

    router.get('/list', async (req, res, next) => {
        try {
            const { scope } = req;
            const dir = scope.resolve(req.query.path);

            // Virtual root with several shared folders: list the folders themselves.
            if (dir === null) {
                const items = (
                    await Promise.all(
                        scope.mounts.map(async (m) => {
                            try {
                                return describe(scope, m.path, await fs.stat(m.path), m.name);
                            } catch {
                                return null; // folder was moved or deleted
                            }
                        })
                    )
                ).filter(Boolean);
                return res.json({ path: '', items });
            }

            if (!(await fs.stat(dir)).isDirectory()) throw new HttpError(400, 'Not a folder');
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const visible = entries.filter(
                (e) => !e.name.startsWith('.') && !(scope.only && e.name !== scope.only)
            );
            const items = (
                await Promise.all(
                    visible.map(async (entry) => {
                        const abs = path.join(dir, entry.name);
                        try {
                            return describe(scope, abs, await fs.stat(abs), entry.name);
                        } catch {
                            return null; // broken symlink / permission error
                        }
                    })
                )
            ).filter(Boolean);

            res.json({ path: scope.rel(dir), items });
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'Folder not found') : error);
        }
    });

    // Breadth-first name search below a folder, capped so huge trees can't hang the server.
    router.get('/search', async (req, res, next) => {
        try {
            const { scope } = req;
            const query = String(req.query.q || '').trim().toLowerCase();
            if (!query || scope.only) return res.json({ items: [], truncated: false });

            const start = scope.resolve(req.query.path);
            const roots = start === null ? scope.mounts.map((m) => m.path) : [start];
            const queue = roots.map((dir) => ({ dir, depth: 0 }));
            const items = [];
            let visited = 0;
            let truncated = false;

            while (queue.length && !truncated) {
                const { dir, depth } = queue.shift();
                let entries;
                try {
                    entries = await fs.readdir(dir, { withFileTypes: true });
                } catch {
                    continue;
                }
                for (const entry of entries) {
                    if (entry.name.startsWith('.')) continue;
                    if (++visited > SEARCH_MAX_VISITED || items.length >= SEARCH_MAX_RESULTS) {
                        truncated = true;
                        break;
                    }
                    const abs = path.join(dir, entry.name);
                    let stats;
                    try {
                        stats = await fs.stat(abs);
                    } catch {
                        continue;
                    }
                    if (entry.name.toLowerCase().includes(query)) items.push(describe(scope, abs, stats, entry.name));
                    if (stats.isDirectory() && depth < SEARCH_MAX_DEPTH) queue.push({ dir: abs, depth: depth + 1 });
                }
            }
            res.json({ items, truncated });
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = { createBrowseRouter };
