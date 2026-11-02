// End-to-end smoke test: starts the app on a random port against a temp folder.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('../src/config');
const { createApp } = require('../src/app');
const { findNetworkIP } = require('../src/lib/network');

async function run(env, fn, host = '127.0.0.1') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-root-'));
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-data-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi there');
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), '# note');
    fs.writeFileSync(path.join(root, '.secret'), 'x');
    const cfg = load([], { SHARE_ROOT: root, DATA_DIR: data, PORT: '0', ...env });
    const server = createApp(cfg).listen(0, host === '127.0.0.1' ? host : '0.0.0.0');
    await new Promise((r) => server.once('listening', r));
    cfg.port = server.address().port;
    const url = `http://${host}:${cfg.port}`;
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

    // Password: cookie integrity, logout, folder management, brute-force limit
    await run({ SHARE_PASSWORD: 'pw123' }, async ({ url }) => {
        const login = await post(`${url}/login`, { password: 'pw123' });
        const cookie = login.headers.get('set-cookie').split(';')[0];
        const [expires, sig] = cookie.slice('sid='.length).split('.');
        const status = (c) => fetch(`${url}/api/list`, { headers: { Cookie: c } }).then((r) => r.status);

        assert.strictEqual(await status(cookie), 200);
        assert.strictEqual(await status(`sid=${expires}.${sig.slice(0, -2)}xx`), 401); // tampered signature
        assert.strictEqual(await status(`sid=${Number(expires) + 1000}.${sig}`), 401); // forged expiry
        assert.strictEqual(await status(`sid=${Date.now() - 1000}.${sig}`), 401); // expired
        assert.strictEqual(await status('sid=garbage'), 401);

        const h = { Cookie: cookie };
        assert.strictEqual((await json(await fetch(`${url}/api/me`, { headers: h }))).canManage, true);
        assert.strictEqual((await fetch(`${url}/api/folders`)).status, 401); // no cookie
        assert.strictEqual((await fetch(`${url}/api/folders`, { headers: h })).status, 200);
        assert.strictEqual((await fetch(`${url}/api/host/dirs`)).status, 401);

        const out = await post(`${url}/logout`, {}, h);
        assert.strictEqual(out.status, 200);
        assert.match(out.headers.get('set-cookie'), /sid=;/);

        // 10 wrong attempts lock out the IP, even for the right password
        for (let i = 0; i < 10; i++) assert.strictEqual((await post(`${url}/login`, { password: 'bad' })).status, 401);
        assert.strictEqual((await post(`${url}/login`, { password: 'bad' })).status, 429);
        assert.strictEqual((await post(`${url}/login`, { password: 'pw123' })).status, 429);
    });

    // Folder management from a non-loopback address: blocked unless a password or ALLOW_SETTINGS
    const lan = findNetworkIP();
    if (!lan) {
        console.log('skipped non-loopback gating tests (no network interface)');
    } else {
        await run({}, async ({ url }) => {
            const me = await json(await fetch(`${url}/api/me`));
            assert.strictEqual(me.canManage, false);
            assert.strictEqual((await fetch(`${url}/api/folders`)).status, 403);
            assert.strictEqual((await post(`${url}/api/folders`, { path: os.tmpdir() })).status, 403);
            assert.strictEqual((await fetch(`${url}/api/host/dirs`)).status, 403);
            assert.strictEqual((await fetch(`${url}/api/list?path=`)).status, 200); // browsing still works
        }, lan);

        await run({ ALLOW_SETTINGS: 'true' }, async ({ url }) => {
            assert.strictEqual((await json(await fetch(`${url}/api/me`))).canManage, true);
            assert.strictEqual((await fetch(`${url}/api/folders`)).status, 200);
        }, lan);
    }

    // LAN-first links, locality flag, PUBLIC_URL, and reverse-proxy safety
    {
        const { isLocalClient, lanAddresses } = require('../src/lib/network');
        for (const ip of ['127.0.0.1', '::1', '::ffff:192.168.1.5', '10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.0.1', 'fd12::1', 'fe80::1'])
            assert.strictEqual(isLocalClient(ip), true, ip);
        for (const ip of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '1.1.1.1', '2001:4860::1', '', 'garbage'])
            assert.strictEqual(isLocalClient(ip), false, ip);
        assert(lanAddresses().every((a) => !a.address.startsWith('169.254.')));

        await run({ PUBLIC_URL: 'https://files.example.com/' }, async ({ url, cfg }) => {
            assert.strictEqual(cfg.publicUrl, 'https://files.example.com');
            const me = await json(await fetch(`${url}/api/me`));
            assert.strictEqual(me.local, true);
            assert.strictEqual(me.hasPublicUrl, true);

            const share = await json(await post(`${url}/api/shares`, { path: 'hello.txt' }));
            assert.strictEqual(share.internetUrl, `https://files.example.com/s/${share.token}`);
            assert(!share.url.includes('example.com') && !share.url.includes('localhost')); // LAN address, not the public one
            assert.strictEqual((await json(await fetch(`${url}/s/${share.token}/api/me`))).local, true);

            // Behind a reverse proxy on this machine every visitor looks like 127.0.0.1: don't trust that
            const viaProxy = { 'X-Forwarded-For': '203.0.113.7' };
            const meProxy = await json(await fetch(`${url}/api/me`, { headers: viaProxy }));
            assert.strictEqual(meProxy.local, false);
            assert.strictEqual(meProxy.canManage, false); // must not get folder management
            assert.strictEqual((await fetch(`${url}/api/folders`, { headers: viaProxy })).status, 403);
            assert.strictEqual((await post(`${url}/api/folders`, { path: os.tmpdir() }, viaProxy)).status, 403);
        });

        // Docker: LAN_URL names the host's address; links keep the port the visitor used
        await run({ LAN_URL: 'http://192.168.1.50:8080/' }, async ({ url, cfg }) => {
            assert.strictEqual(cfg.lanUrl, 'http://192.168.1.50:8080');
            const share = await json(await post(`${url}/api/shares`, { path: 'hello.txt' }));
            assert.strictEqual(share.url, `http://192.168.1.50:8080/s/${share.token}`);
        });
        await run({}, async ({ url, cfg }) => {
            assert.strictEqual(cfg.lanUrl, '');
            const postAs = (host) => new Promise((resolve, reject) => {
                const body = JSON.stringify({ path: 'hello.txt' });
                const req = require('http').request(`${url}/api/shares`, { method: 'POST', headers: { Host: host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
                    let text = '';
                    res.on('data', (c) => (text += c));
                    res.on('end', () => resolve(JSON.parse(text)));
                });
                req.on('error', reject);
                req.end(body);
            });
            const made = await postAs('localhost:9000');
            assert(made.url.includes(':9000/s/'), made.url); // the mapped port, not the one we listen on
            const viaName = await postAs('nas.local:9000');
            assert(viaName.url.startsWith('http://nas.local:9000/s/'), viaName.url); // a LAN name is used as is
            assert.strictEqual((await fetch(`${url}/healthz`)).status, 200);
        });
        await run({ SHARE_PASSWORD: 'secret1' }, async ({ url }) => {
            assert.strictEqual((await fetch(`${url}/healthz`)).status, 200); // reachable without logging in
        });

        await run({ PUBLIC_URL: 'ftp://nope' }, async ({ url, cfg }) => {
            assert.strictEqual(cfg.publicUrl, '');
            const share = await json(await post(`${url}/api/shares`, { path: 'hello.txt' }));
            assert.strictEqual(share.internetUrl, null);
        });
    }

    // Device-to-device signalling relay
    await run({ STUN_SERVERS: 'stun:stun.example.com:3478,junk' }, async ({ url }) => {
        // Minimal SSE client: collects events and lets the test wait for one
        const connect = async (query, headers = {}) => {
            const ctl = new AbortController();
            const res = await fetch(`${url}/api/p2p/events?${query}`, { headers, signal: ctl.signal });
            assert.strictEqual(res.status, 200);
            const events = [];
            const waiters = [];
            (async () => {
                const reader = res.body.getReader();
                const dec = new TextDecoder();
                let buf = '';
                try {
                    for (;;) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buf += dec.decode(value, { stream: true });
                        let i;
                        while ((i = buf.indexOf('\n\n')) >= 0) {
                            const block = buf.slice(0, i); buf = buf.slice(i + 2);
                            const ev = /^event: (.+)$/m.exec(block), data = /^data: (.+)$/m.exec(block);
                            if (ev && data) { events.push({ event: ev[1], data: JSON.parse(data[1]) }); waiters.splice(0).forEach((w) => w()); }
                        }
                    }
                } catch { /* aborted */ }
            })();
            const next = async (name) => {
                for (let t = 0; t < 100; t++) {
                    const k = events.findIndex((e) => e.event === name);
                    if (k >= 0) return events.splice(k, 1)[0].data;
                    await new Promise((r) => { waiters.push(r); setTimeout(r, 50); });
                }
                throw new Error(`timed out waiting for ${name}`);
            };
            return { next, events, close: () => ctl.abort() };
        };
        const signal = (from, to, data, extra = {}) =>
            post(`${url}/api/p2p/signal`, { to, data }, { 'X-Peer-Id': from, ...extra });

        assert.deepStrictEqual(await json(await fetch(`${url}/api/p2p/config`)), { iceServers: [{ urls: ['stun:stun.example.com:3478'] }] });

        const a = await connect('name=Alice&kind=phone');
        const helloA = await a.next('hello');
        assert.strictEqual(helloA.name, 'Alice');
        assert.deepStrictEqual(helloA.peers, []);

        const b = await connect('name=' + encodeURIComponent('<b>Bob</b>') + '&kind=bogus');
        const helloB = await b.next('hello');
        assert.strictEqual(helloB.name, 'bBob/b'); // markup stripped
        assert.deepStrictEqual(helloB.peers.map((p) => p.name), ['Alice']);
        const joined = await a.next('peer-joined');
        assert.strictEqual(joined.id, helloB.id);
        assert.strictEqual(joined.kind, 'laptop'); // unknown kind falls back

        // a different network (forwarded from a public address) lands in another room
        const far = await connect('name=Far', { 'X-Forwarded-For': '203.0.113.9' });
        const helloFar = await far.next('hello');
        assert.deepStrictEqual(helloFar.peers, []);

        // relay A -> B, only within the room
        assert.strictEqual((await signal(helloA.id, helloB.id, { k: 'offer', tid: 't1' })).status, 200);
        const got = await b.next('signal');
        assert.strictEqual(got.from, helloA.id);
        assert.deepStrictEqual(got.data, { k: 'offer', tid: 't1' });
        assert.strictEqual((await signal(helloA.id, 'nobody', { k: 'x' })).status, 404);
        assert.strictEqual((await signal('forged-id', helloB.id, { k: 'x' })).status, 403);
        assert.strictEqual((await signal(helloA.id, helloB.id, { k: 'big', pad: 'x'.repeat(70000) })).status, 400);
        // rooms are isolated in both directions, and a peer id only works from its own network
        assert.strictEqual((await signal(helloA.id, helloFar.id, { k: 'x' })).status, 404);
        assert.strictEqual((await signal(helloFar.id, helloA.id, { k: 'x' })).status, 403);
        assert.strictEqual((await signal(helloFar.id, helloA.id, { k: 'x' }, { 'X-Forwarded-For': '203.0.113.9' })).status, 404);

        // leaving is announced
        b.close();
        assert.strictEqual((await a.next('peer-left')).id, helloB.id);
        a.close(); far.close();
    });

    // P2P can be switched off, and needs the password like everything else
    await run({ ALLOW_P2P: 'false' }, async ({ url }) => {
        assert.strictEqual((await json(await fetch(`${url}/api/me`))).canP2P, false);
        assert.strictEqual((await fetch(`${url}/api/p2p/config`)).status, 404);
    });
    await run({ SHARE_PASSWORD: 'pw123' }, async ({ url }) => {
        assert.strictEqual((await fetch(`${url}/api/p2p/events`)).status, 401);
        assert.strictEqual((await post(`${url}/api/p2p/signal`, { to: 'x', data: {} })).status, 401);
    });

    // Password-protected share links
    await run({}, async ({ url, root, cfg }) => {
        const mk = async (body) => json(await post(`${url}/api/shares`, body));
        const locked = await mk({ path: 'hello.txt', password: 'open-sesame' });
        const open = await mk({ path: 'docs' });
        const base = `${url}/s/${locked.token}`;

        // the password is validated, hashed, and never returned or stored in clear
        assert.strictEqual(locked.protected, true);
        assert.strictEqual(open.protected, false);
        assert.strictEqual((await post(`${url}/api/shares`, { path: 'hello.txt', password: 'abc' })).status, 400);
        assert.strictEqual((await post(`${url}/api/shares`, { path: 'hello.txt', password: 'x'.repeat(129) })).status, 400);
        assert.strictEqual((await post(`${url}/api/shares`, { path: 'hello.txt', password: ['a', 'b', 'c', 'd'] })).status, 400);
        const listed = await json(await fetch(`${url}/api/shares`));
        assert(listed.every((s) => !('pw' in s)) && !JSON.stringify(listed).includes('scrypt'));
        const stored = fs.readFileSync(path.join(cfg.dataDir, 'shares.json'), 'utf8');
        assert(stored.includes('scrypt$') && !stored.includes('open-sesame'));

        // locked: visitors only get the unlock page; every API call is refused
        const page = await fetch(base);
        assert.strictEqual(page.status, 200);
        assert.match(await page.text(), /This link is protected/);
        for (const p of ['/api/list?path=', '/api/file?path=hello.txt', '/api/thumb?path=hello.txt', '/api/me', '/api/text?path=hello.txt'])
            assert.strictEqual((await fetch(`${base}${p}`)).status, 401, p);
        assert.strictEqual((await post(`${base}/api/zip`, { paths: ['hello.txt'] })).status, 401);
        assert.strictEqual((await json(await fetch(`${url}/api/shares`))).find((s) => s.token === locked.token).downloads, 0);

        // wrong password, then the right one
        assert.strictEqual((await post(`${base}/unlock`, { password: 'nope' })).status, 401);
        assert.strictEqual((await post(`${base}/unlock`, {})).status, 401);
        const ok = await post(`${base}/unlock`, { password: 'open-sesame' });
        assert.strictEqual(ok.status, 200);
        const setCookie = ok.headers.get('set-cookie');
        assert.match(setCookie, new RegExp(`Path=/s/${locked.token}`));
        assert.match(setCookie, /HttpOnly/i);
        const cookie = setCookie.split(';')[0];
        const h = { Cookie: cookie };

        assert.strictEqual((await fetch(base, { headers: h })).status, 200);
        assert.notStrictEqual(await (await fetch(base, { headers: h })).text().then((t) => /This link is protected/.test(t)), true);
        assert.deepStrictEqual((await json(await fetch(`${base}/api/list?path=`, { headers: h }))).items.map((i) => i.name), ['hello.txt']);
        assert.strictEqual(await (await fetch(`${base}/api/file?path=hello.txt&download=1`, { headers: h })).text(), 'hi there');
        assert.strictEqual((await fetch(`${base}/api/file?path=docs/note.md`, { headers: h })).status, 403); // still limited to the file

        // the cookie is only good for its own link, and can't be forged or stretched
        assert.strictEqual((await fetch(`${url}/s/${open.token}/api/list`)).status, 200); // unprotected link needs nothing
        const other = await mk({ path: 'hello.txt', password: 'another-one' });
        assert.strictEqual((await fetch(`${url}/s/${other.token}/api/list`, { headers: h })).status, 401);
        const [expires, sig] = cookie.slice('su='.length).split('.');
        assert.strictEqual((await fetch(`${base}/api/list`, { headers: { Cookie: `su=${expires}.${sig.slice(0, -2)}xx` } })).status, 401);
        assert.strictEqual((await fetch(`${base}/api/list`, { headers: { Cookie: `su=${Number(expires) + 99999}.${sig}` } })).status, 401);
        assert.strictEqual((await fetch(`${base}/api/list`, { headers: { Cookie: `su=${Date.now() - 1}.${sig}` } })).status, 401);

        // revoking the link kills access even with a valid cookie
        await fetch(`${url}/api/shares/${locked.token}`, { method: 'DELETE' });
        assert.strictEqual((await fetch(`${base}/api/list`, { headers: h })).status, 404);
    });

    // Brute force on a protected link is throttled
    await run({}, async ({ url }) => {
        const share = await json(await post(`${url}/api/shares`, { path: 'hello.txt', password: 'correct-horse' }));
        const base = `${url}/s/${share.token}`;
        for (let i = 0; i < 10; i++) assert.strictEqual((await post(`${base}/unlock`, { password: `guess${i}` })).status, 401);
        assert.strictEqual((await post(`${base}/unlock`, { password: 'guess-again' })).status, 429);
        assert.strictEqual((await post(`${base}/unlock`, { password: 'correct-horse' })).status, 429); // even the right one while locked out
        const fresh = await json(await post(`${url}/api/shares`, { path: 'hello.txt', password: 'correct-horse' }));
        assert.strictEqual((await post(`${url}/s/${fresh.token}/unlock`, { password: 'correct-horse' })).status, 200); // other links unaffected
    });

    // Protected links work for visitors who are not signed in to the site
    await run({ SHARE_PASSWORD: 'site-pw' }, async ({ url }) => {
        const login = await post(`${url}/login`, { password: 'site-pw' });
        const admin = { Cookie: login.headers.get('set-cookie').split(';')[0] };
        const share = await json(await post(`${url}/api/shares`, { path: 'docs', password: 'link-pw' }, admin));
        const base = `${url}/s/${share.token}`;
        assert.strictEqual((await fetch(`${base}/api/list`)).status, 401);
        const ok = await post(`${base}/unlock`, { password: 'link-pw' });
        assert.strictEqual(ok.status, 200);
        assert.strictEqual((await fetch(`${base}/api/list`, { headers: { Cookie: ok.headers.get('set-cookie').split(';')[0] } })).status, 200);
        assert.strictEqual((await fetch(`${url}/api/list`)).status, 401); // the site itself stays locked
    });

    console.log('All smoke tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
