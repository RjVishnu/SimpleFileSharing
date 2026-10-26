const path = require('path');
const { resolveInside, toRelative, isInside, HttpError } = require('./paths');

// What a request may touch. Built from the shared folders ("mounts") configured in the UI.
//  - One mount  -> "flat": the mount is the root and paths are relative to it.
//  - Many mounts -> the root is a virtual folder listing each mount; paths start with its name.
function createScope(mounts, extra = {}) {
    const flat = mounts.length === 1;
    const scope = { mounts, flat, only: null, token: null, canUpload: false, canModify: false, canManage: false, ...extra };

    // Real path for a virtual path, or null for the virtual root (multi-mount only).
    scope.resolve = (rel = '') => {
        let abs;
        if (flat) {
            abs = resolveInside(mounts[0].path, rel);
        } else {
            const parts = String(rel).split(/[\\/]+/).filter(Boolean);
            if (!parts.length) return null;
            const mount = mounts.find((m) => m.name === parts[0]);
            if (!mount) throw new HttpError(404, 'Folder not found');
            abs = resolveInside(mount.path, parts.slice(1).join('/'));
        }
        if (scope.only) {
            const base = mounts[0].path;
            if (abs !== base && path.relative(base, abs) !== scope.only) throw new HttpError(403, 'Access denied');
        }
        return abs;
    };

    scope.resolveReal = (rel) => {
        const abs = scope.resolve(rel);
        if (abs === null) throw new HttpError(400, 'Open a shared folder first');
        return abs;
    };

    // Virtual path for a real path inside one of the mounts.
    scope.rel = (abs) => {
        if (flat) return toRelative(mounts[0].path, abs);
        const mount = mounts
            .filter((m) => isInside(m.path, abs))
            .sort((a, b) => b.path.length - a.path.length)[0];
        const inner = toRelative(mount.path, abs);
        return inner ? `${mount.name}/${inner}` : mount.name;
    };

    scope.isMountRoot = (abs) => mounts.some((m) => m.path === abs);
    return scope;
}

module.exports = { createScope };
