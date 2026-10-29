// Direct device-to-device file transfer over WebRTC.
// The server only relays the handshake (see src/routes/p2p.js); file bytes go straight between the two browsers.
(() => {
    'use strict';

    const BASE = document.documentElement.dataset.base || '';
    const CHUNK = 16 * 1024; // safe message size for every browser
    const BLOCK = 256 * 1024; // how much of the file is read from disk at a time
    const HIGH = 4 * 1024 * 1024; // pause sending above this much queued data
    const LOW = 1024 * 1024;
    const ANSWER_TIMEOUT = 90000; // the other person has to accept
    const CONNECT_TIMEOUT = 20000;

    const listeners = {};
    const emit = (name, data) => (listeners[name] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

    const state = { id: null, name: '', peers: new Map(), source: null, iceServers: null };
    const sessions = new Map(); // transfer id -> session

    const ADJECTIVES = ['Blue', 'Green', 'Red', 'Swift', 'Calm', 'Brave', 'Quiet', 'Sunny', 'Lucky', 'Witty', 'Amber', 'Coral'];
    const ANIMALS = ['Fox', 'Otter', 'Panda', 'Heron', 'Lynx', 'Koala', 'Falcon', 'Gecko', 'Tiger', 'Whale', 'Robin', 'Badger'];

    function deviceName() {
        try {
            const saved = localStorage.getItem('p2p-name');
            if (saved) return saved;
        } catch { /* storage unavailable */ }
        const pick = (list) => list[Math.floor(Math.random() * list.length)];
        const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
        try { localStorage.setItem('p2p-name', name); } catch { /* ignore */ }
        return name;
    }

    const deviceKind = () => (/iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'phone' : 'laptop');

    async function signal(to, data) {
        const res = await fetch(`${BASE}/api/p2p/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Peer-Id': state.id || '' },
            body: JSON.stringify({ to, data }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not reach that device');
    }

    // ---------- discovery ----------
    function start() {
        if (state.source) return;
        state.name = deviceName();
        const connect = () => {
            const source = new EventSource(`${BASE}/api/p2p/events?name=${encodeURIComponent(state.name)}&kind=${deviceKind()}`);
            state.source = source;
            source.addEventListener('hello', (e) => {
                const data = JSON.parse(e.data);
                state.id = data.id;
                state.peers = new Map(data.peers.map((p) => [p.id, p]));
                emit('peers', list());
            });
            source.addEventListener('peer-joined', (e) => { const p = JSON.parse(e.data); state.peers.set(p.id, p); emit('peers', list()); });
            source.addEventListener('peer-left', (e) => { state.peers.delete(JSON.parse(e.data).id); emit('peers', list()); });
            source.addEventListener('signal', (e) => onSignal(JSON.parse(e.data)));
            source.onerror = () => { state.peers.clear(); emit('peers', list()); }; // EventSource reconnects by itself
        };
        connect();
    }

    const list = () => [...state.peers.values()];

    async function iceServers() {
        if (!state.iceServers) {
            try { state.iceServers = (await (await fetch(`${BASE}/api/p2p/config`)).json()).iceServers; } catch { state.iceServers = []; }
        }
        return state.iceServers;
    }

    // ---------- shared plumbing ----------
    function newSession(dir, peerId, info, tid) {
        const peer = state.peers.get(peerId);
        const s = {
            tid: tid || crypto.randomUUID(), dir, peerId, peerName: peer ? peer.name : 'device',
            name: info.name, size: info.size, type: info.type || '', done: 0, finished: false,
            pendingIce: [], lastEmit: 0,
        };
        sessions.set(s.tid, s);
        return s;
    }

    function progress(s, force) {
        const now = Date.now();
        if (!force && now - s.lastEmit < 120) return;
        s.lastEmit = now;
        emit('progress', { tid: s.tid, dir: s.dir, name: s.name, size: s.size, done: s.done, peerName: s.peerName });
    }

    function end(s, error) {
        if (s.finished) return;
        s.finished = true;
        clearTimeout(s.timer);
        sessions.delete(s.tid);
        if (error && s.sink) s.sink.abort().catch(() => {});
        setTimeout(() => { try { s.pc && s.pc.close(); } catch { /* already closed */ } }, 300);
        emit(error ? 'error' : 'done', { tid: s.tid, dir: s.dir, name: s.name, size: s.size, peerName: s.peerName, message: error });
    }

    function makePC(s, servers) {
        const pc = new RTCPeerConnection({ iceServers: servers });
        s.pc = pc;
        pc.onicecandidate = (e) => { if (e.candidate) signal(s.peerId, { k: 'ice', tid: s.tid, c: e.candidate }).catch(() => {}); };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed') end(s, 'Could not connect directly. The devices may be on different networks, or a firewall is in the way.');
        };
        return pc;
    }

    async function addIce(s, candidate) {
        if (s.pc && s.pc.remoteDescription) await s.pc.addIceCandidate(candidate).catch(() => {});
        else s.pendingIce.push(candidate);
    }

    const flushIce = async (s) => { for (const c of s.pendingIce.splice(0)) await s.pc.addIceCandidate(c).catch(() => {}); };

    // ---------- sending ----------
    async function send(peerId, file) {
        const s = newSession('send', peerId, { name: file.name, size: file.size, type: file.type });
        s.file = file;
        emit('start', { tid: s.tid, dir: 'send', name: s.name, size: s.size, peerName: s.peerName });
        try {
            const pc = makePC(s, await iceServers());
            const dc = pc.createDataChannel('file');
            dc.binaryType = 'arraybuffer';
            s.dc = dc;
            dc.onopen = () => { clearTimeout(s.timer); pump(s).catch((e) => end(s, e.message || 'Sending failed')); };
            dc.onclose = () => { if (!s.finished) end(s, 'The other device disconnected'); };
            dc.onmessage = (e) => { if (typeof e.data === 'string' && JSON.parse(e.data).t === 'ok') { s.done = s.size; progress(s, true); end(s); } };

            await pc.setLocalDescription(await pc.createOffer());
            await signal(peerId, { k: 'offer', tid: s.tid, sdp: pc.localDescription, file: { name: s.name, size: s.size, type: s.type } });
            s.timer = setTimeout(() => end(s, 'No answer. The other person did not accept in time.'), ANSWER_TIMEOUT);
        } catch (error) {
            end(s, error.message || 'Could not start the transfer');
        }
        return s.tid;
    }

    const drain = (dc) => new Promise((resolve) => {
        dc.bufferedAmountLowThreshold = LOW;
        const done = () => { dc.onbufferedamountlow = null; resolve(); };
        dc.onbufferedamountlow = done;
        if (dc.readyState !== 'open') done();
    });

    async function pump(s) {
        const { dc, file } = s;
        for (let offset = 0; offset < file.size; offset += BLOCK) {
            const block = await file.slice(offset, offset + BLOCK).arrayBuffer();
            for (let i = 0; i < block.byteLength; i += CHUNK) {
                if (s.finished) return;
                if (dc.bufferedAmount > HIGH) await drain(dc);
                if (dc.readyState !== 'open') throw new Error('The other device disconnected');
                dc.send(new Uint8Array(block, i, Math.min(CHUNK, block.byteLength - i)));
            }
            s.done = Math.min(offset + BLOCK, file.size);
            progress(s);
        }
        dc.send(JSON.stringify({ t: 'end', size: file.size }));
    }

    // ---------- receiving ----------
    async function openSink(s) {
        if (window.showSaveFilePicker && window.isSecureContext) {
            const handle = await window.showSaveFilePicker({ suggestedName: s.name });
            const writable = await handle.createWritable();
            return { write: (chunk) => writable.write(chunk), close: () => writable.close(), abort: () => writable.abort() };
        }
        // Plain-HTTP pages cannot stream to disk, so the file is assembled in memory and then downloaded.
        const parts = [];
        return {
            write: (chunk) => { parts.push(chunk); },
            close: () => {
                const url = URL.createObjectURL(new Blob(parts, { type: s.type || 'application/octet-stream' }));
                const a = Object.assign(document.createElement('a'), { href: url, download: s.name });
                document.body.append(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            },
            abort: async () => { parts.length = 0; },
        };
    }

    async function accept(s) {
        try {
            s.sink = await openSink(s);
        } catch (error) {
            decline(s); // the person cancelled the save dialog
            return;
        }
        try {
            const pc = makePC(s, await iceServers());
            let queue = Promise.resolve();
            pc.ondatachannel = (e) => {
                const dc = e.channel;
                dc.binaryType = 'arraybuffer';
                s.dc = dc;
                clearTimeout(s.timer);
                dc.onclose = () => { if (!s.finished) end(s, 'The other device disconnected'); };
                dc.onmessage = (m) => {
                    if (typeof m.data === 'string') {
                        const msg = JSON.parse(m.data);
                        if (msg.t !== 'end') return;
                        queue = queue.then(async () => {
                            if (s.done !== s.size) throw new Error('The file arrived incomplete');
                            await s.sink.close();
                            dc.send(JSON.stringify({ t: 'ok' }));
                            progress(s, true);
                            end(s);
                        }).catch((err) => end(s, err.message));
                        return;
                    }
                    s.done += m.data.byteLength;
                    queue = queue.then(() => s.sink.write(m.data)).catch((err) => end(s, err.message || 'Could not save the file'));
                    progress(s);
                };
            };
            await pc.setRemoteDescription(s.offer);
            await flushIce(s);
            await pc.setLocalDescription(await pc.createAnswer());
            await signal(s.peerId, { k: 'answer', tid: s.tid, sdp: pc.localDescription });
            s.timer = setTimeout(() => end(s, 'Could not connect directly. The devices may be on different networks.'), CONNECT_TIMEOUT);
            emit('start', { tid: s.tid, dir: 'recv', name: s.name, size: s.size, peerName: s.peerName });
        } catch (error) {
            end(s, error.message || 'Could not receive the file');
        }
    }

    function decline(s) {
        signal(s.peerId, { k: 'decline', tid: s.tid }).catch(() => {});
        s.finished = true;
        sessions.delete(s.tid);
    }

    // ---------- incoming signalling ----------
    async function onSignal({ from, name, data }) {
        let s = sessions.get(data.tid);
        if (data.k === 'offer') {
            if (!data.file || typeof data.file.name !== 'string' || !Number.isFinite(data.file.size) || data.file.size < 0) return;
            if (!state.peers.has(from)) state.peers.set(from, { id: from, name, kind: 'laptop' });
            s = newSession('recv', from, data.file, data.tid);
            s.offer = data.sdp;
            s.timer = setTimeout(() => end(s, 'Request expired'), ANSWER_TIMEOUT);
            emit('incoming', { tid: s.tid, name: s.name, size: s.size, peerName: name, accept: () => accept(s), decline: () => decline(s) });
        } else if (!s || s.peerId !== from) {
            // unknown or someone else's transfer id: ignore
        } else if (data.k === 'ice') {
            await addIce(s, data.c);
        } else if (data.k === 'answer' && s.dir === 'send') {
            clearTimeout(s.timer);
            await s.pc.setRemoteDescription(data.sdp);
            await flushIce(s);
            s.timer = setTimeout(() => end(s, 'Could not connect directly. The devices may be on different networks, or a firewall is in the way.'), CONNECT_TIMEOUT);
        } else if (data.k === 'decline') {
            end(s, `${s.peerName} declined the file`);
        } else if (data.k === 'cancel') {
            end(s, `${s.peerName} cancelled the transfer`);
        }
    }

    function cancel(tid) {
        const s = sessions.get(tid);
        if (!s) return;
        signal(s.peerId, { k: 'cancel', tid }).catch(() => {});
        end(s, 'Cancelled');
    }

    window.P2P = {
        start,
        send,
        cancel,
        peers: list,
        get name() { return state.name; },
        rename(name) {
            const clean = String(name || '').trim().slice(0, 40);
            if (!clean) return;
            try { localStorage.setItem('p2p-name', clean); } catch { /* ignore */ }
            if (state.source) { state.source.close(); state.source = null; state.name = clean; start(); }
        },
        on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); },
    };
})();
