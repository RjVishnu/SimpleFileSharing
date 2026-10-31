// Resumable (chunked) upload tests.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('../src/config');
const { createApp } = require('../src/app');

(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ru-root-'));
    fs.mkdirSync(path.join(root, 'in'));
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ru-data-'));
    const cfg = load([], { SHARE_ROOT: root, DATA_DIR: data, PORT: '0', MAX_UPLOAD_MB: '1' });
    const server = createApp(cfg).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const url = `http://127.0.0.1:${server.address().port}/api/upload/session`;
    const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const put = (id, offset, buf) => fetch(`${url}/${id}?offset=${offset}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: buf });
    const start = (extra = {}) => fetch(url, json({ path: 'in', name: 'big.bin', size: 1000, ...extra }));

    try {
        const data1 = crypto.randomBytes(1000);

        // chunks in order, with a resume in the middle
        const s = await (await start()).json();
        assert.strictEqual(s.offset, 0);
        assert.strictEqual((await (await put(s.id, 0, data1.subarray(0, 400))).json()).offset, 400);
        assert.strictEqual((await (await fetch(`${url}/${s.id}`)).json()).offset, 400); // "where was I?"

        // wrong offset is refused and tells the client where to continue
        const bad = await put(s.id, 100, data1.subarray(100, 300));
        assert.strictEqual(bad.status, 409);
        assert.strictEqual((await bad.json()).offset, 400);

        // finishing early is refused
        assert.strictEqual((await fetch(`${url}/${s.id}/finish`, json({}))).status, 409);

        // a chunk that would run past the declared size is refused
        assert.strictEqual((await put(s.id, 400, crypto.randomBytes(700))).status, 413);

        assert.strictEqual((await (await put(s.id, 400, data1.subarray(400))).json()).offset, 1000);
        const done = await (await fetch(`${url}/${s.id}/finish`, json({}))).json();
        assert.deepStrictEqual(done.files, [{ name: 'big.bin', size: 1000 }]);
        assert(fs.readFileSync(path.join(root, 'in', 'big.bin')).equals(data1));
        assert.strictEqual((await fetch(`${url}/${s.id}`)).status, 404); // session is gone

        // a second upload with the same name never overwrites
        const s2 = await (await start()).json();
        await put(s2.id, 0, data1);
        assert.strictEqual((await (await fetch(`${url}/${s2.id}/finish`, json({}))).json()).files[0].name, 'big (1).bin');

        // an interrupted chunk is not counted and can be retried
        const s3 = await (await start()).json();
        const ctl = new AbortController();
        const dropped = fetch(`${url}/${s3.id}?offset=0`, {
            method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, signal: ctl.signal,
            body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(300)); setTimeout(() => ctl.abort(), 30); } }), duplex: 'half',
        }).catch(() => {});
        await dropped;
        await new Promise((r) => setTimeout(r, 100));
        assert.strictEqual((await (await fetch(`${url}/${s3.id}`)).json()).offset, 0);
        await put(s3.id, 0, data1);
        assert.strictEqual((await fetch(`${url}/${s3.id}/finish`, json({}))).status, 200);

        // validation
        assert.strictEqual((await start({ size: 2 * 1024 * 1024 })).status, 413); // over MAX_UPLOAD_MB
        assert.strictEqual((await start({ size: -1 })).status, 400);
        assert.strictEqual((await start({ name: 'evil.exe' })).status, 400);
        assert.strictEqual((await start({ name: '..' })).status, 400);
        assert.strictEqual((await start({ path: '../..' })).status, 403);
        assert.strictEqual((await start({ path: 'nope' })).status, 404);
        assert.strictEqual((await put('0'.repeat(32), 0, Buffer.alloc(1))).status, 404);

        // abandoning cleans up
        const s4 = await (await start()).json();
        assert.strictEqual((await fetch(`${url}/${s4.id}`, { method: 'DELETE' })).status, 200);
        assert.strictEqual((await fetch(`${url}/${s4.id}`)).status, 404);
        assert.deepStrictEqual(fs.readdirSync(path.join(os.tmpdir(), 'sharecode-uploads')).filter((f) => f === `r-${s4.id}`), []);

        // uploads off => no sessions
        const off = createApp(load([], { SHARE_ROOT: root, DATA_DIR: data, PORT: '0', ALLOW_UPLOAD: 'false' })).listen(0, '127.0.0.1');
        await new Promise((r) => off.once('listening', r));
        const offRes = await fetch(`http://127.0.0.1:${off.address().port}/api/upload/session`, json({ path: 'in', name: 'a.bin', size: 1 }));
        assert.strictEqual(offRes.status, 403);
        off.close();

        console.log('resumable upload tests passed');
    } finally {
        server.close();
        process.exit(process.exitCode || 0);
    }
})().catch((e) => { console.error(e); process.exit(1); });
