const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { HttpError, validateName } = require('../lib/paths');

// Shared folders persisted to <dataDir>/settings.json and editable from the UI.
// The first run is seeded from the configured root folder (--dir / SHARE_ROOT / config.js).
class SettingsStore {
    constructor(dataDir, seedRoot) {
        this.file = path.join(dataDir, 'settings.json');
        fs.mkdirSync(dataDir, { recursive: true });
        try {
            this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        } catch {
            this.data = {};
        }
        if (!Array.isArray(this.data.folders)) {
            this.data.folders = [{ id: this.newId(), name: SettingsStore.nameFor(seedRoot), path: seedRoot }];
            this.save();
        }
    }

    static nameFor(dir) {
        const base = path.basename(dir) || dir.replace(/[\\/:]+/g, '');
        return base.replace(/[\\/:*?"<>|]/g, '').replace(/^\.+/, '') || 'Files';
    }

    newId() {
        return crypto.randomBytes(6).toString('hex');
    }

    save() {
        fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    }

    list() {
        return this.data.folders.map((f) => ({ ...f, exists: fs.existsSync(f.path) }));
    }

    mounts() {
        return this.data.folders.map(({ name, path: p }) => ({ name, path: p }));
    }

    add(dir, requestedName) {
        const name = validateName(requestedName || SettingsStore.nameFor(dir));
        if (this.data.folders.some((f) => f.path === dir)) throw new HttpError(409, 'That folder is already shared');
        if (this.data.folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
            throw new HttpError(409, `A shared folder named "${name}" already exists`);
        }
        const folder = { id: this.newId(), name, path: dir };
        this.data.folders.push(folder);
        this.save();
        return folder;
    }

    rename(id, requestedName) {
        const folder = this.data.folders.find((f) => f.id === id);
        if (!folder) throw new HttpError(404, 'Folder not found');
        const name = validateName(requestedName);
        if (this.data.folders.some((f) => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) {
            throw new HttpError(409, `A shared folder named "${name}" already exists`);
        }
        folder.name = name;
        this.save();
        return folder;
    }

    remove(id) {
        const before = this.data.folders.length;
        this.data.folders = this.data.folders.filter((f) => f.id !== id);
        if (this.data.folders.length === before) throw new HttpError(404, 'Folder not found');
        this.save();
    }
}

module.exports = { SettingsStore };
