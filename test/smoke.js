// End-to-end smoke test: starts the app on a random port against a temp folder.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('../src/config');
const { createApp } = require('../src/app');

async function run(env, fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-root-'));
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-data-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi there');
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), '# note');
    fs.writeFileSync(path.join(root, '.secret'), 'x');
    const cfg = load([], { SHARE_ROOT: root, DATA_DIR: data, PORT: '0', ...env });
    const server = createApp(cfg).listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    cfg.port = server.address().port;
    const url = `http://127.0.0.1:${cfg.port}`;
    try { await fn({ url, root, cfg }); } finally { server.close(); }
}

const json = (r) => r.json();
const post = (url, body, headers = {}) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

(async () => {
    await run({}, async ({ url, root }) => {
        const list = await json(await fetch(`${url}/api/list?path=`));
        assert.deepStrictEqual(list.items.map((i) => i.name).sort(), ['docs', 'hello.txt']); // dotfile hidden
        assert.strictEqual((await fetch(`${url}/api/file?path=${encodeURIComponent('../x')}`)).status, 403);
        assert.strictEqual((await fetch(`${url}/api/file?path=.secret`)).status, 403);
        assert.strictEqual(await (await fetch(`${url}/api/file?path=hello.txt`)).text(), 'hi there');
        assert.strictEqual((await json(await fetch(`${url}/api/search?q=note`))).items.length, 1);
        assert.strictEqual((await json(await fetch(`${url}/api/text?path=hello.txt`))).content, 'hi there');

        // upload (+ rename on conflict, blocked extension)
        const form = new FormData();
        form.append('files', new Blob(['data']), 'hello.txt');
        form.append('files', new Blob(['x']), 'bad.exe');
        const up = await json(await fetch(`${url}/api/upload?path=`, { method: 'POST', body: form }));
        assert.strictEqual(up.uploaded, 1);
        assert.strictEqual(up.files[0].name, 'hello (1).txt');
        assert.strictEqual(up.rejected.length, 1);
        assert(fs.existsSync(path.join(root, 'hello (1).txt')));

        // zip
        const zip = await post(`${url}/api/zip`, { paths: ['hello.txt', 'docs'] });
        assert.strictEqual(zip.status, 200);
        assert.strictEqual((await zip.arrayBuffer()).byteLength > 100, true);

        // modify disabled without password
        assert.strictEqual((await post(`${url}/api/delete`, { paths: ['hello.txt'] })).status, 403);

        // share link: file share is limited to that file and read-only
        const share = await json(await post(`${url}/api/shares`, { path: 'hello.txt', expiresInMinutes: 5 }));
        const sbase = `${url}/s/${share.token}`;
        assert.strictEqual((await fetch(sbase)).status, 200);
        const sl = await json(await fetch(`${sbase}/api/list?path=`));
        assert.deepStrictEqual(sl.items.map((i) => i.name), ['hello.txt']);
        assert.strictEqual((await fetch(`${sbase}/api/file?path=hello.txt&download=1`)).status, 200);
        assert.strictEqual((await fetch(`${sbase}/api/file?path=docs/note.md`)).status, 403);
        assert.strictEqual((await fetch(`${sbase}/api/shares`)).status, 404);
        assert.strictEqual((await post(`${sbase}/api/delete`, { paths: ['hello.txt'] })).status, 403);
        assert.strictEqual((await json(await fetch(`${url}/api/shares`)))[0].downloads, 1);
        assert.strictEqual((await fetch(`${url}/api/qr?text=hello`)).status, 200);

        // folder share can't escape
        const fs2 = await json(await post(`${url}/api/shares`, { path: 'docs' }));
        const fb = `${url}/s/${fs2.token}`;
        assert.strictEqual((await fetch(`${fb}/api/file?path=${encodeURIComponent('../hello.txt')}`)).status, 403);
        assert.strictEqual((await fetch(`${fb}/api/file?path=note.md`)).status, 200);

        // revoke
        await fetch(`${url}/api/shares/${share.token}`, { method: 'DELETE' });
        assert.strictEqual((await fetch(sbase)).status, 404);
    });

    await run({ SHARE_PASSWORD: 'pw123' }, async ({ url, root }) => {
        assert.strictEqual((await fetch(`${url}/api/list`)).status, 401);
        assert.strictEqual((await fetch(`${url}/`, { redirect: 'manual' })).status, 302);
        assert.strictEqual((await post(`${url}/login`, { password: 'nope' })).status, 401);
        const ok = await post(`${url}/login`, { password: 'pw123' });
        assert.strictEqual(ok.status, 200);
        const cookie = ok.headers.get('set-cookie').split(';')[0];
        const h = { Cookie: cookie };
        assert.strictEqual((await fetch(`${url}/api/list`, { headers: h })).status, 200);

        assert.strictEqual((await post(`${url}/api/mkdir`, { path: '', name: 'new' }, h)).status, 200);
        assert.strictEqual((await post(`${url}/api/mkdir`, { path: '', name: '../evil' }, h)).status, 400);
        assert.strictEqual((await post(`${url}/api/rename`, { path: 'new', name: 'renamed' }, h)).status, 200);
        assert(fs.existsSync(path.join(root, 'renamed')));
        assert.strictEqual((await post(`${url}/api/delete`, { paths: ['renamed', 'hello.txt'] }, h)).status, 200);
        assert(!fs.existsSync(path.join(root, 'hello.txt')));
        assert.strictEqual((await post(`${url}/api/delete`, { paths: [''] }, h)).status, 400);

        // share links work without the password
        const share = await json(await post(`${url}/api/shares`, { path: 'docs' }, h));
        assert.strictEqual((await fetch(`${url}/s/${share.token}/api/list`)).status, 200);
    });

    // Shared folders configured from the UI
    await run({}, async ({ url, root }) => {
        const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-extra-'));
        fs.writeFileSync(path.join(extra, 'pic.txt'), 'extra file');
        const me1 = await json(await fetch(`${url}/api/me`));
        assert.strictEqual(me1.canManage, true); // loopback
        assert.strictEqual(me1.multiRoot, false);

        assert.strictEqual((await post(`${url}/api/folders`, { path: 'relative/dir' })).status, 400);
        assert.strictEqual((await post(`${url}/api/folders`, { path: path.join(extra, 'nope') })).status, 400);
        const added = await post(`${url}/api/folders`, { path: extra, name: 'Extra' });
        assert.strictEqual(added.status, 201);
        assert.strictEqual((await post(`${url}/api/folders`, { path: extra })).status, 409); // duplicate

        const me2 = await json(await fetch(`${url}/api/me`));
        assert.strictEqual(me2.multiRoot, true);
        const top = await json(await fetch(`${url}/api/list?path=`));
        assert.strictEqual(top.items.length, 2);
        const mainName = top.items.find((i) => i.name !== 'Extra').name;
        assert.strictEqual((await json(await fetch(`${url}/api/list?path=Extra`))).items[0].path, 'Extra/pic.txt');
        assert.strictEqual(await (await fetch(`${url}/api/file?path=${encodeURIComponent('Extra/pic.txt')}`)).text(), 'extra file');
        assert.strictEqual((await fetch(`${url}/api/file?path=${encodeURIComponent('Extra/../x')}`)).status, 403);
        assert.strictEqual((await json(await fetch(`${url}/api/search?q=pic`))).items.length, 1);
        assert.strictEqual((await json(await fetch(`${url}/api/list?path=${mainName}`))).items.length, 2);
        assert.strictEqual((await post(`${url}/api/mkdir`, { path: '', name: 'x' })).status, 403);

        // share links keep working across layout changes, and die when the folder is unshared
        const share = await json(await post(`${url}/api/shares`, { path: 'Extra/pic.txt' }));
        assert.strictEqual((await fetch(`${url}/s/${share.token}/api/file?path=pic.txt`)).status, 200);

        const folders = await json(await fetch(`${url}/api/folders`));
        const extraId = folders.find((f) => f.name === 'Extra').id;
        const renamed = await fetch(`${url}/api/folders/${extraId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Renamed' }),
        });
        assert.strictEqual(renamed.status, 200);
        assert.strictEqual((await fetch(`${url}/s/${share.token}`)).status, 200);

        assert.strictEqual((await fetch(`${url}/api/folders/${extraId}`, { method: 'DELETE' })).status, 200);
        assert.strictEqual((await fetch(`${url}/s/${share.token}`)).status, 404);
        assert.strictEqual((await json(await fetch(`${url}/api/me`))).multiRoot, false);
        assert(fs.existsSync(path.join(extra, 'pic.txt'))); // nothing deleted from disk

        const dirs = await json(await fetch(`${url}/api/host/dirs?path=${encodeURIComponent(os.tmpdir())}`));
        assert(Array.isArray(dirs.dirs) && dirs.dirs.length > 0);
    });

    console.log('All smoke tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
