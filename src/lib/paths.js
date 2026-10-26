const fs = require('fs');
const path = require('path');

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const isInside = (root, target) => {
    const rel = path.relative(root, target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// Resolve a user-supplied relative path inside root. Rejects traversal, NUL bytes,
// dotfiles and symlinks that point outside the root.
function resolveInside(root, userPath = '') {
    if (typeof userPath !== 'string' || userPath.includes('\0')) {
        throw new HttpError(400, 'Invalid path');
    }
    const rel = userPath.replace(/^[\\/]+/, '');
    const abs = path.resolve(root, rel);
    if (!isInside(root, abs)) throw new HttpError(403, 'Access denied');

    if (path.relative(root, abs).split(path.sep).some((part) => part.startsWith('.'))) {
        throw new HttpError(403, 'Access denied');
    }

    try {
        if (!isInside(root, fs.realpathSync(abs))) throw new HttpError(403, 'Access denied');
    } catch (error) {
        if (error instanceof HttpError) throw error;
        // Path doesn't exist yet (e.g. a new folder); the lexical check above is enough.
    }
    return abs;
}

const toRelative = (root, abs) => path.relative(root, abs).split(path.sep).join('/');

// A file/folder name for create/rename/upload: no separators, no dot prefix, no reserved chars.
function validateName(name) {
    if (
        typeof name !== 'string' ||
        !name.trim() ||
        name.length > 200 ||
        name.startsWith('.') ||
        /[\\/:*?"<>|\0]/.test(name)
    ) {
        throw new HttpError(400, 'Invalid name');
    }
    return name.trim();
}

module.exports = { HttpError, resolveInside, toRelative, validateName, isInside };
