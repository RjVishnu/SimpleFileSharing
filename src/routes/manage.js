const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const { HttpError, validateName } = require('../lib/paths');

// New folder, rename and delete. Only available when scope.canModify is set.
function createManageRouter() {
    const router = express.Router();

    const guard = (req, res, next) =>
        req.scope.canModify ? next() : next(new HttpError(403, 'Modifying files is disabled'));

    router.post('/mkdir', guard, async (req, res, next) => {
        try {
            const dir = req.scope.resolveReal(req.body.path);
            const target = path.join(dir, validateName(req.body.name));
            await fs.mkdir(target);
            res.json({ ok: true });
        } catch (error) {
            next(error.code === 'EEXIST' ? new HttpError(409, 'Already exists') : error);
        }
    });

    router.post('/rename', guard, async (req, res, next) => {
        try {
            const from = req.scope.resolveReal(req.body.path);
            if (req.scope.isMountRoot(from)) throw new HttpError(400, 'Cannot rename the root');
            const to = path.join(path.dirname(from), validateName(req.body.name));
            try {
                await fs.access(to);
                throw new HttpError(409, 'Already exists');
            } catch (error) {
                if (error instanceof HttpError) throw error;
            }
            await fs.rename(from, to);
            res.json({ ok: true });
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'Not found') : error);
        }
    });

    router.post('/delete', guard, async (req, res, next) => {
        try {
            const paths = req.body.paths;
            if (!Array.isArray(paths) || !paths.length) throw new HttpError(400, 'Nothing to delete');
            const targets = paths.map((p) => req.scope.resolveReal(p));
            if (targets.some((t) => req.scope.isMountRoot(t))) throw new HttpError(400, 'Cannot delete the root');
            for (const target of targets) await fs.rm(target, { recursive: true, force: true });
            res.json({ deleted: targets.length });
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = { createManageRouter };
