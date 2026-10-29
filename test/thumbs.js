// Thumbnail tests. Skipped (not failed) when the optional `sharp` module isn't installed.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let sharp;
try { sharp = require('sharp'); } catch { console.log('skipped thumbnail tests (sharp not installed)'); process.exit(0); }

const { load } = require('../src/config');
const { createApp } = require('../src/app');

(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'th-root-'));
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'th-data-'));
    const big = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: { r: 200, g: 60, b: 20 } } })
        .jpeg({ quality: 95 }).toBuffer();
    fs.writeFileSync(path.join(root, 'photo.jpg'), big);
    fs.writeFileSync(path.join(root, 'broken.jpg'), 'not really an image');
    fs.writeFileSync(path.join(root, 'note.txt'), 'hello');
    fs.writeFileSync(path.join(root, 'vector.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');

    const cfg = load([], { SHARE_ROOT: root, DATA_DIR: data, PORT: '0' });
    const server = createApp(cfg).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const url = `http://127.0.0.1:${server.address().port}`;
    const thumb = (query) => fetch(`${url}/api/thumb?${query}`);

    try {
        assert.strictEqual((await (await fetch(`${url}/api/me`)).json()).thumbs, true);

        // generated, resized, small, correctly cached
        const first = await thumb('path=photo.jpg&w=320&v=1');
        assert.strictEqual(first.status, 200);
        assert.strictEqual(first.headers.get('content-type'), 'image/webp');
        assert.match(first.headers.get('cache-control'), /immutable/);
        const bytes = Buffer.from(await first.arrayBuffer());
        const meta = await sharp(bytes).metadata();
        assert.deepStrictEqual([meta.width, meta.height], [320, 160]); // aspect ratio kept
        assert(bytes.length < big.length / 10, `thumbnail ${bytes.length} vs original ${big.length}`);
        assert.strictEqual(fs.readdirSync(path.join(data, 'thumbs')).filter((f) => f.endsWith('.webp')).length, 1);

        // second request is served from the cache (no new file), without a version it isn't immutable
        const again = await thumb('path=photo.jpg&w=320');
        assert.strictEqual(again.status, 200);
        assert.match(again.headers.get('cache-control'), /max-age=300/);
        assert.strictEqual(fs.readdirSync(path.join(data, 'thumbs')).length, 1);

        // sizes snap to the allowed set; small images are not enlarged
        assert.strictEqual((await sharp(Buffer.from(await (await thumb('path=photo.jpg&w=1')).arrayBuffer())).metadata()).width, 160);
        assert.strictEqual((await sharp(Buffer.from(await (await thumb('path=photo.jpg&w=99999')).arrayBuffer())).metadata()).width, 640);

        // concurrent requests for a new size share one job and all succeed
        fs.copyFileSync(path.join(root, 'photo.jpg'), path.join(root, 'photo2.jpg'));
        const burst = await Promise.all(Array.from({ length: 8 }, () => thumb('path=photo2.jpg&w=160')));
        assert(burst.every((r) => r.status === 200));

        // a changed file gets a fresh thumbnail
        const small = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#00f' } }).jpeg().toBuffer();
        await new Promise((r) => setTimeout(r, 20));
        fs.writeFileSync(path.join(root, 'photo2.jpg'), small);
        const changed = await sharp(Buffer.from(await (await thumb('path=photo2.jpg&w=320')).arrayBuffer())).metadata();
        assert.strictEqual(changed.width, 320);
        assert.strictEqual(changed.height, 320);

        // things that can't have thumbnails say so, and nothing escapes the shared folder
        assert.strictEqual((await thumb('path=broken.jpg')).status, 415);
        assert.strictEqual((await thumb('path=note.txt')).status, 415);
        assert.strictEqual((await thumb('path=vector.svg')).status, 415);
        assert.strictEqual((await thumb('path=missing.jpg')).status, 404);
        assert.strictEqual((await thumb(`path=${encodeURIComponent('../x.jpg')}`)).status, 403);
        assert.strictEqual((await thumb('path=')).status, 404);
        assert.strictEqual(fs.readdirSync(path.join(data, 'thumbs')).filter((f) => f.endsWith('.tmp')).length, 0);

        // share links: thumbnails work for the shared file only, and never count as downloads
        const share = await (await fetch(`${url}/api/shares`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'photo.jpg' }),
        })).json();
        const base = `${url}/s/${share.token}/api`;
        assert.strictEqual((await fetch(`${base}/thumb?path=photo.jpg&w=160`)).status, 200);
        assert.strictEqual((await fetch(`${base}/thumb?path=photo2.jpg&w=160`)).status, 403);
        assert.strictEqual((await (await fetch(`${url}/api/shares`)).json())[0].downloads, 0);

        // cache trimming keeps the folder under its limit
        const { Thumbnails } = require('../src/services/thumbnails');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'th-trim-'));
        for (let i = 0; i < 5; i++) {
            const file = path.join(dir, `f${i}.webp`);
            fs.writeFileSync(file, Buffer.alloc(1000));
            fs.utimesSync(file, new Date(2020, 0, i + 1), new Date(2020, 0, i + 1));
        }
        await new Thumbnails(dir, 2500).trim();
        assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['f3.webp', 'f4.webp']); // oldest removed first
    } finally {
        server.close();
    }
    console.log('Thumbnail tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
