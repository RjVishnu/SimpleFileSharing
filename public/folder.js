// Share a folder straight from this browser, and browse another device's shared folder.
// The files stay on the sharing computer and are read when someone downloads them; the server only
// introduces the two browsers (see p2p.js). Sharing works only while the tab stays open.
(() => {
    'use strict';

    const P2P = window.P2P;
    if (!P2P || !P2P.internals) return;
    const { signal, iceServers, openSink, emit: emitP2P, state, hooks, drain } = P2P.internals;

    const CHUNK = 16 * 1024;
    const BLOCK = 256 * 1024;
    const HIGH = 4 * 1024 * 1024;
    const PAGE = 100; // directory entries per message, keeps every message small
    const MAX_VIEWERS = 8;
    const MAX_DOWNLOADS = 4; // at once, per viewer
    const CONNECT_TIMEOUT = 20000;

    const listeners = {};
    const emit = (name, data) => (listeners[name] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    const text = (value) => JSON.stringify(value);

    // ======================= sharing side =======================
    const host = { name: '', files: new Map(), dirs: new Map(), viewers: new Map() };

    // `list` is the File list from <input webkitdirectory>; paths look like "Photos/2024/a.jpg".
    function share(list) {
        const files = new Map();
        const dirs = new Map([['', new Map()]]);
        let root = '';
        for (const file of list) {
            const parts = String(file.webkitRelativePath || '').split('/');
            root = root || parts[0];
            parts.shift();
            if (!parts.length || parts.some((p) => p.startsWith('.'))) continue; // hidden files stay private
            let dir = '';
            for (let i = 0; i < parts.length - 1; i++) {
                const next = dir ? `${dir}/${parts[i]}` : parts[i];
                dirs.get(dir).set(parts[i], { name: parts[i], type: 'folder' });
                if (!dirs.has(next)) dirs.set(next, new Map());
                dir = next;
            }
            const name = parts[parts.length - 1];
            files.set(parts.join('/'), file);
            dirs.get(dir).set(name, { name, type: 'file', size: file.size, modified: file.lastModified });
        }
        if (!files.size) return 0;
        host.name = root || 'Shared folder';
        host.files = files;
        host.dirs = dirs;
        P2P.setSharing(host.name);
        emit('host', info());
        return files.size;
    }

    function stop() {
        for (const v of host.viewers.values()) closeViewer(v);
        host.files = new Map();
        host.dirs = new Map();
        host.name = '';
        P2P.setSharing('');
        emit('host', info());
    }

    const info = () => ({ sharing: Boolean(host.name), name: host.name, files: host.files.size, viewers: [...host.viewers.values()].map((v) => v.peerName) });

    function closeViewer(v) {
        host.viewers.delete(v.bid);
        try { v.pc.close(); } catch { /* already closed */ }
        emit('host', info());
    }

    function listing(path) {
        const dir = host.dirs.get(path);
        if (!dir) return null;
        return [...dir.values()].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === 'folder' ? -1 : 1));
    }

    function serveCtl(dc) {
        dc.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            if (msg.t !== 'ls') return;
            const items = listing(String(msg.path || ''));
            if (!items) return dc.send(text({ t: 'ls', rid: msg.rid, error: 'Folder not found' }));
            for (let i = 0; i === 0 || i < items.length; i += PAGE) {
                dc.send(text({ t: 'ls', rid: msg.rid, items: items.slice(i, i + PAGE), more: i + PAGE < items.length }));
            }
        };
    }

    function serveFile(v, dc) {
        if (v.downloads >= MAX_DOWNLOADS) { dc.onopen = () => dc.close(); return; }
        v.downloads++;
        dc.binaryType = 'arraybuffer';
        dc.onclose = () => { v.downloads--; };
        dc.onmessage = async (e) => {
            if (dc.requested || typeof e.data !== 'string') return;
            dc.requested = true;
            let msg;
            try { msg = JSON.parse(e.data); } catch { return dc.close(); }
            const file = host.files.get(String(msg.path || ''));
            if (!file) return dc.send(text({ t: 'err', message: 'That file is no longer available' }));
            try {
                dc.send(text({ t: 'meta', name: file.name, size: file.size }));
                for (let offset = 0; offset < file.size; offset += BLOCK) {
                    const block = await file.slice(offset, offset + BLOCK).arrayBuffer();
                    for (let i = 0; i < block.byteLength; i += CHUNK) {
                        if (dc.bufferedAmount > HIGH) await drain(dc);
                        if (dc.readyState !== 'open') return;
                        dc.send(new Uint8Array(block, i, Math.min(CHUNK, block.byteLength - i)));
                    }
                }
                dc.send(text({ t: 'end', size: file.size }));
            } catch {
                // the file changed or was removed on disk while sending
                if (dc.readyState === 'open') dc.send(text({ t: 'err', message: 'The file could not be read on the other computer' }));
            }
        };
    }

    async function onOffer(from, name, data) {
        const reply = (d) => signal(from, d).catch(() => {});
        if (!host.name) return reply({ k: 'b-deny', bid: data.bid });
        if (host.viewers.size >= MAX_VIEWERS) return reply({ k: 'b-deny', bid: data.bid, reason: 'busy' });
        const v = { bid: data.bid, peerId: from, peerName: name, downloads: 0, pending: [] };
        host.viewers.set(v.bid, v); // registered first so early ICE candidates are kept
        v.pc = new RTCPeerConnection({ iceServers: await iceServers() });
        v.pc.onicecandidate = (e) => { if (e.candidate) reply({ k: 'b-ice', bid: v.bid, c: e.candidate }); };
        v.pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(v.pc.connectionState)) closeViewer(v); };
        v.pc.ondatachannel = (e) => {
            if (e.channel.label === 'ctl') {
                serveCtl(e.channel);
                e.channel.onclose = () => closeViewer(v); // viewer closed the window
            } else if (e.channel.label === 'f') serveFile(v, e.channel);
        };
        try {
            await v.pc.setRemoteDescription(data.sdp);
            for (const c of v.pending.splice(0)) await v.pc.addIceCandidate(c).catch(() => {});
            await v.pc.setLocalDescription(await v.pc.createAnswer());
            await reply({ k: 'b-answer', bid: v.bid, sdp: v.pc.localDescription });
            emit('host', info());
        } catch {
            closeViewer(v);
        }
    }

    // ======================= browsing side =======================
    const conns = new Map(); // bid -> connection to someone else's shared folder

    // Opens a connection to a device that is sharing a folder. Resolves once the link is up.
    async function open(peerId) {
        const peer = state.peers.get(peerId);
        const c = {
            bid: crypto.randomUUID(), peerId, peerName: peer ? peer.name : 'device', pendingIce: [], rid: 0, lists: new Map(), closed: false,
        };
        conns.set(c.bid, c);
        const servers = await iceServers();
        c.pc = new RTCPeerConnection({ iceServers: servers });
        c.pc.onicecandidate = (e) => { if (e.candidate) signal(peerId, { k: 'b-ice', bid: c.bid, c: e.candidate }).catch(() => {}); };
        c.ctl = c.pc.createDataChannel('ctl');
        c.ctl.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            const pending = c.lists.get(msg.rid);
            if (!pending) return;
            if (msg.error) { c.lists.delete(msg.rid); return pending.reject(new Error(msg.error)); }
            pending.items.push(...msg.items);
            if (!msg.more) { c.lists.delete(msg.rid); pending.resolve(pending.items); }
        };
        const failAll = (message) => {
            for (const p of c.lists.values()) p.reject(new Error(message));
            c.lists.clear();
        };
        c.ctl.onclose = () => { if (!c.closed) { c.closed = true; conns.delete(c.bid); failAll('The other computer stopped sharing or disconnected'); emit('closed', { bid: c.bid }); } };

        const opened = new Promise((resolve, reject) => {
            c.fail = reject;
            c.ctl.onopen = resolve;
            c.timer = setTimeout(() => reject(new Error('Could not connect directly. The devices may be on different networks, or a firewall is in the way.')), CONNECT_TIMEOUT);
        });
        c.pc.onconnectionstatechange = () => { if (c.pc.connectionState === 'failed') c.fail(new Error('Could not connect directly. A firewall may be in the way.')); };
        try {
            await c.pc.setLocalDescription(await c.pc.createOffer());
            await signal(peerId, { k: 'b-offer', bid: c.bid, sdp: c.pc.localDescription });
            await opened;
        } catch (error) {
            close(c);
            throw error;
        } finally {
            clearTimeout(c.timer);
        }
        return c;
    }

    function close(c) {
        c.closed = true;
        conns.delete(c.bid);
        signal(c.peerId, { k: 'b-close', bid: c.bid }).catch(() => {});
        try { c.pc.close(); } catch { /* already closed */ }
    }

    // Entries of a folder on the other computer; "" is the top.
    function list(c, path) {
        return new Promise((resolve, reject) => {
            if (c.closed || c.ctl.readyState !== 'open') return reject(new Error('Not connected'));
            const rid = ++c.rid;
            c.lists.set(rid, { items: [], resolve, reject });
            c.ctl.send(text({ t: 'ls', rid, path }));
        });
    }

    // Save one file. Shows up in the transfer tray like any other transfer.
    async function download(c, path, size, name) {
        const tid = crypto.randomUUID();
        const s = { tid, dir: 'recv', name, size, peerName: c.peerName, done: 0, finished: false, lastEmit: 0 };
        let sink;
        try {
            sink = await openSink({ name, type: '' }); // asks where to save; must happen right after the click
        } catch { return; } // cancelled
        const dc = c.pc.createDataChannel('f');
        dc.binaryType = 'arraybuffer';
        const progress = (force) => {
            const now = Date.now();
            if (!force && now - s.lastEmit < 120) return;
            s.lastEmit = now;
            emitP2P('progress', { tid, dir: 'recv', name, size, done: s.done, peerName: c.peerName });
        };
        const finish = (error) => {
            if (s.finished) return;
            s.finished = true;
            hooks.delete(tid);
            if (error) sink.abort().catch(() => {});
            try { dc.close(); } catch { /* closed */ }
            emitP2P(error ? 'error' : 'done', { tid, dir: 'recv', name, size, peerName: c.peerName, message: error });
        };
        hooks.set(tid, () => finish('Cancelled'));
        emitP2P('start', { tid, dir: 'recv', name, size, peerName: c.peerName });

        let queue = Promise.resolve();
        dc.onopen = () => dc.send(text({ path }));
        dc.onclose = () => finish(s.finished ? undefined : 'The other computer disconnected');
        dc.onmessage = (e) => {
            if (typeof e.data === 'string') {
                const msg = JSON.parse(e.data);
                if (msg.t === 'err') return finish(msg.message);
                if (msg.t !== 'end') return;
                queue = queue.then(async () => {
                    if (s.done !== size) throw new Error('The file arrived incomplete');
                    await sink.close();
                    progress(true);
                    finish();
                }).catch((err) => finish(err.message));
                return;
            }
            s.done += e.data.byteLength;
            queue = queue.then(() => sink.write(e.data)).catch((err) => finish(err.message || 'Could not save the file'));
            progress();
        };
    }

    // ======================= signalling =======================
    P2P.on('bsignal', async ({ from, name, data }) => {
        if (data.k === 'b-offer') {
            if (typeof data.bid !== 'string' || data.bid.length > 64) return;
            return onOffer(from, name, data);
        }
        const v = host.viewers.get(data.bid);
        if (v && v.peerId === from) {
            if (data.k === 'b-ice') {
                if (v.pc && v.pc.remoteDescription) await v.pc.addIceCandidate(data.c).catch(() => {});
                else v.pending.push(data.c);
            } else if (data.k === 'b-close') closeViewer(v);
            return;
        }
        const c = conns.get(data.bid);
        if (!c || c.peerId !== from) return;
        if (data.k === 'b-answer') {
            await c.pc.setRemoteDescription(data.sdp);
            for (const ice of c.pendingIce.splice(0)) await c.pc.addIceCandidate(ice).catch(() => {});
        } else if (data.k === 'b-ice') {
            if (c.pc.remoteDescription) await c.pc.addIceCandidate(data.c).catch(() => {});
            else c.pendingIce.push(data.c);
        } else if (data.k === 'b-deny') {
            c.fail(new Error(data.reason === 'busy' ? 'That computer has too many people connected right now' : 'That computer is not sharing a folder any more'));
        }
    });

    window.addEventListener('pagehide', () => { for (const c of [...conns.values()]) close(c); });

    window.P2PFolder = {
        share, stop, info, open, close, list, download,
        on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); },
    };
})();
