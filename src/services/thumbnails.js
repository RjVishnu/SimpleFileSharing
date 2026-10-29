const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// sharp is optional (native module). Without it the UI simply keeps loading the original images.
// It is also skipped inside the packaged .exe: pkg cannot bundle its native files, and merely requiring it
// there crashes the process with an unhandled rejection.
let sharp = null;
function loadSharp() {
    if (sharp || process.pkg) return sharp;
    try { sharp = require('sharp'); sharp.cache(false); sharp.concurrency(1); } catch { /* not installed */ }
    return sharp;
}

const SIZES = [160, 320, 640]; // bounded set keeps the cache small
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.avif']);
const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
const PARALLEL = 3;

// Resized copies of images, generated on first request and cached on disk.
class Thumbnails {
    constructor(dir, maxCacheBytes) {
        this.dir = dir;
        this.maxCacheBytes = maxCacheBytes;
        this.pending = new Map(); // cache file -> promise, so concurrent requests share one job
        this.running = 0;
        this.queue = [];
        this.sinceTrim = 0;
        this.ready = Boolean(loadSharp());
        if (this.ready) this.trim().catch(() => {});
    }

    supports(file) {
        return this.ready && EXTENSIONS.has(path.extname(file).toLowerCase());
    }

    static size(requested) {
        const want = Number(requested) || 320;
        return SIZES.find((s) => s >= want) || SIZES[SIZES.length - 1];
    }

    // Returns the path of a cached thumbnail for `abs`, creating it if needed; null if it can't be made.
    async get(abs, stats, requested) {
        if (!this.supports(abs) || stats.size > MAX_SOURCE_BYTES) return null;
        const width = Thumbnails.size(requested);
        const key = crypto.createHash('sha1').update(`${abs}|${stats.mtimeMs}|${stats.size}|${width}`).digest('hex');
        const target = path.join(this.dir, `${key}.webp`);

        try { await fs.access(target); return target; } catch { /* not cached yet */ }

        if (!this.pending.has(target)) {
            const job = this.limited(() => this.make(abs, target, width)).finally(() => this.pending.delete(target));
            this.pending.set(target, job);
        }
        return this.pending.get(target);
    }

    limited(task) {
        return new Promise((resolve, reject) => {
            const run = () => {
                this.running++;
                task().then(resolve, reject).finally(() => { this.running--; this.queue.shift()?.(); });
            };
            if (this.running < PARALLEL) run(); else this.queue.push(run);
        });
    }

    async make(abs, target, width) {
        await fs.mkdir(this.dir, { recursive: true });
        const temp = `${target}.${process.pid}.tmp`;
        try {
            await sharp(abs, { failOn: 'none', animated: false })
                .rotate() // respect the camera's orientation
                .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 74 })
                .toFile(temp);
            await fs.rename(temp, target);
        } catch (error) {
            await fs.unlink(temp).catch(() => {});
            return null; // corrupt or unsupported image: the caller falls back to the original
        }
        if (++this.sinceTrim >= 100) { this.sinceTrim = 0; this.trim().catch(() => {}); }
        return target;
    }

    // Keep the cache under its size limit by deleting the least recently written files.
    async trim() {
        let names;
        try { names = await fs.readdir(this.dir); } catch { return; }
        const files = [];
        let total = 0;
        for (const name of names) {
            try {
                const stats = await fs.stat(path.join(this.dir, name));
                files.push({ name, size: stats.size, time: stats.mtimeMs });
                total += stats.size;
            } catch { /* removed meanwhile */ }
        }
        files.sort((a, b) => a.time - b.time);
        for (const file of files) {
            if (total <= this.maxCacheBytes) break;
            await fs.unlink(path.join(this.dir, file.name)).catch(() => {});
            total -= file.size;
        }
    }
}

module.exports = { Thumbnails };
