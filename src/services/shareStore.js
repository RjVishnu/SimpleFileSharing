const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Share links persisted to <dataDir>/shares.json.
class ShareStore {
    constructor(dataDir) {
        this.file = path.join(dataDir, 'shares.json');
        fs.mkdirSync(dataDir, { recursive: true });
        try {
            this.shares = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        } catch {
            this.shares = {};
        }
    }

    save() {
        fs.writeFileSync(this.file, JSON.stringify(this.shares, null, 2));
    }

    create({ path: relPath, abs, type, expiresInMinutes }) {
        const token = crypto.randomBytes(16).toString('base64url');
        this.shares[token] = {
            token,
            path: relPath,
            abs,
            type,
            createdAt: Date.now(),
            expiresAt: expiresInMinutes ? Date.now() + expiresInMinutes * 60000 : null,
            downloads: 0,
        };
        this.save();
        return this.shares[token];
    }

    // Returns the share, or null when it is missing or expired (expired ones are purged).
    get(token) {
        const share = this.shares[token];
        if (!share) return null;
        if (share.expiresAt && share.expiresAt < Date.now()) {
            this.remove(token);
            return null;
        }
        return share;
    }

    list() {
        return Object.keys(this.shares)
            .map((token) => this.get(token))
            .filter(Boolean)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    countDownload(token) {
        if (this.shares[token]) {
            this.shares[token].downloads++;
            this.save();
        }
    }

    remove(token) {
        const existed = Boolean(this.shares[token]);
        delete this.shares[token];
        if (existed) this.save();
        return existed;
    }
}

module.exports = { ShareStore };
