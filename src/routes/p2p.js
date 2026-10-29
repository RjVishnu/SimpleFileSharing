const crypto = require('crypto');
const express = require('express');
const { HttpError } = require('../lib/paths');

const MAX_PEERS = 500;
const MAX_PER_ROOM = 50;
const MAX_SIGNAL_BYTES = 64 * 1024;

// Direct device-to-device transfer. The server only introduces devices to each other (signalling);
// file data flows over a WebRTC data channel between the two browsers and never touches this server.
// Devices are grouped in a "room": everyone on the local network shares one room, anyone else is
// grouped with visitors from the same public address.
function createP2PRouter(cfg, { roomOf }) {
    const router = express.Router();
    const peers = new Map(); // id -> { id, name, kind, room, res }
    const inRoom = (room) => [...peers.values()].filter((p) => p.room === room);
    const publicInfo = (p) => ({ id: p.id, name: p.name, kind: p.kind });
    const send = (peer, event, data) => peer.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    router.get('/p2p/config', (req, res) => {
        const iceServers = cfg.stunServers.length ? [{ urls: cfg.stunServers }] : [];
        res.json({ iceServers });
    });

    router.get('/p2p/events', (req, res, next) => {
        const room = roomOf(req);
        if (peers.size >= MAX_PEERS || inRoom(room).length >= MAX_PER_ROOM) return next(new HttpError(503, 'Too many connected devices'));

        const clean = (value, fallback, max) => String(value || fallback).replace(/[\u0000-\u001f<>]/g, '').slice(0, max).trim() || fallback;
        const peer = {
            id: crypto.randomBytes(9).toString('base64url'),
            name: clean(req.query.name, 'Device', 40),
            kind: ['phone', 'tablet', 'laptop'].includes(req.query.kind) ? req.query.kind : 'laptop',
            room,
            res,
        };

        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        req.socket.setKeepAlive(true);

        const others = inRoom(room);
        peers.set(peer.id, peer);
        send(peer, 'hello', { id: peer.id, name: peer.name, peers: others.map(publicInfo) });
        others.forEach((p) => send(p, 'peer-joined', publicInfo(peer)));

        const beat = setInterval(() => res.write(': ping\n\n'), 25000);
        req.on('close', () => {
            clearInterval(beat);
            peers.delete(peer.id);
            inRoom(room).forEach((p) => send(p, 'peer-left', { id: peer.id }));
        });
    });

    // Relay a WebRTC offer / answer / ICE candidate / transfer request to another device in the same room.
    router.post('/p2p/signal', (req, res, next) => {
        const from = peers.get(String(req.get('x-peer-id') || ''));
        const to = peers.get(String((req.body && req.body.to) || ''));
        if (!from || from.room !== roomOf(req)) return next(new HttpError(403, 'Not connected'));
        if (!to || to.room !== from.room) return next(new HttpError(404, 'That device is no longer here'));
        const data = req.body.data;
        if (data === undefined || JSON.stringify(data).length > MAX_SIGNAL_BYTES) return next(new HttpError(400, 'Invalid message'));
        send(to, 'signal', { from: from.id, name: from.name, data });
        res.json({ ok: true });
    });

    return router;
}

module.exports = { createP2PRouter };
