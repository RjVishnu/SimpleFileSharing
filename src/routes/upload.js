const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { HttpError, validateName } = require('../lib/paths');

async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

// rename() fails across drives (EXDEV), e.g. temp on C: and the share on D:.
async function moveFile(from, to) {
    try {
        await fs.rename(from, to);
    } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        await fs.copyFile(from, to);
        await fs.unlink(from);
    }
}

async function uniquePath(dir, name) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let candidate = path.join(dir, name);
    for (let i = 1; await exists(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
    return candidate;
}

function createUploadRouter(cfg) {
    const router = express.Router();
    const tmpDir = path.join(os.tmpdir(), 'sharecode-uploads');
    const upload = multer({
        dest: tmpDir,
        limits: { fileSize: cfg.maxUploadBytes, files: 100 },
    }).array('files', 100);

    router.post('/upload', (req, res, next) => {
        if (!cfg.allowUpload || !req.scope.canUpload) return next(new HttpError(403, 'Uploads are disabled'));
        fs.mkdir(tmpDir, { recursive: true }).then(() => upload(req, res, next), next);
    }, async (req, res, next) => {
        const files = req.files || [];
        try {
            const dir = req.scope.resolveReal(req.query.path);
            if (!(await fs.stat(dir)).isDirectory()) throw new HttpError(400, 'Target is not a folder');

            const saved = [];
            const rejected = [];
            for (const file of files) {
                // multer decodes filenames as latin1; restore UTF-8 names.
                const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
                try {
                    const name = validateName(path.basename(original));
                    if (cfg.blockedExtensions.includes(path.extname(name).toLowerCase())) {
                        throw new Error('File type not allowed');
                    }
                    const target = await uniquePath(dir, name);
                    await moveFile(file.path, target);
                    saved.push({ name: path.basename(target), size: file.size });
                } catch (error) {
                    rejected.push({ name: original, error: error.message });
                }
            }
            res.json({ uploaded: saved.length, files: saved, rejected });
        } catch (error) {
            next(error.code === 'ENOENT' ? new HttpError(404, 'Folder not found') : error);
        } finally {
            await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {}))); // leftovers only
        }
    });

    return router;
}

module.exports = { createUploadRouter };
