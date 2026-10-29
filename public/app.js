(() => {
'use strict';

const BASE = document.documentElement.dataset.base || '';
const $ = (id) => document.getElementById(id);
const FILE = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>';
const SVG = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    audio: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    pdf: FILE + '<path d="M9 14h2a1.5 1.5 0 0 0 0-3H9v6"/>',
    text: FILE + '<path d="M9 13h6M9 17h6"/>',
    archive: '<path d="M4 8h16v12H4z"/><path d="M3 4h18v4H3zM10 12h4"/>',
    other: FILE,
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    folderplus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevleft: '<path d="m15 5-7 7 7 7"/>',
    chevright: '<path d="m9 5 7 7-7 7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    gallery: '<rect x="3" y="3" width="8" height="11" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="16" width="8" height="5" rx="1.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
// Static, trusted markup only (never user data).
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${SVG[name] || SVG.other}</svg>`;
function decorate(root = document) {
    for (const el of root.querySelectorAll('[data-icon]')) {
        el.querySelector(':scope > svg')?.remove();
        el.insertAdjacentHTML('afterbegin', svg(el.dataset.icon));
    }
}
function badge(kind, content) {
    const el = h('span', { class: `badge ${kind}` });
    if (content) el.append(content); else el.innerHTML = svg(kind);
    return el;
}
const PREVIEWABLE = new Set(['image', 'video', 'audio', 'pdf', 'text']);
const store = {
    get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const state = {
    me: {}, path: '', items: [], query: '', selected: new Set(),
    view: store.get('view', 'list'), sort: store.get('sort', 'name'), asc: store.get('asc', '1') === '1',
    searching: false, previewIndex: -1, zoom: 1, brand: {}, slide: null,
    sidebar: store.get('sidebar', innerWidth >= 760 ? '1' : '0') === '1', details: store.get('details', '0') === '1',
    treeKids: new Map(), treeOpen: new Set(['']),
};
const KIND_LABEL = { folder: 'Folder', image: 'Image', video: 'Video', audio: 'Audio', pdf: 'PDF document', text: 'Text / code', archive: 'Archive', other: 'File' };

// ---------- helpers ----------
function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null) el.append(c);
    return el;
}

function formatBytes(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let i = -1;
    do { bytes /= 1024; i++; } while (bytes >= 1024 && i < units.length - 1);
    return `${bytes.toFixed(bytes < 10 ? 1 : 0)} ${units[i]}`;
}
const formatDate = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function toast(message, isError = false) {
    const el = h('div', { class: `toast${isError ? ' error' : ''}` }, message);
    $('toasts').append(el);
    setTimeout(() => el.remove(), isError ? 5000 : 2500);
}

async function api(url, options = {}) {
    const res = await fetch(`${BASE}/api${url}`, options);
    if (res.status === 401) { location.href = '/login'; throw new Error('Login required'); }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
    }
    return res;
}
const post = (url, body) => api(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const q = (p) => encodeURIComponent(p);
const fileUrl = (p, download) => `${BASE}/api/file?path=${q(p)}${download ? '&download=1' : ''}`;

// Small resized copy of an image (generated and cached by the server). Falls back to the original
// if the server can't make one (unsupported format, sharp not installed, corrupt file).
const THUMBABLE = /\.(jpe?g|png|gif|webp|bmp|tiff?|avif)$/i;
function thumbImg(item, width, props = {}) {
    const small = state.me.thumbs && THUMBABLE.test(item.name);
    const img = h('img', { loading: 'lazy', decoding: 'async', alt: '', ...props,
        src: small ? `${BASE}/api/thumb?path=${q(item.path)}&w=${width}&v=${Math.round(item.modified || 0)}` : fileUrl(item.path) });
    if (small) img.addEventListener('error', () => { img.src = fileUrl(item.path); }, { once: true });
    return img;
}

const parentOf = (p) => p.split('/').slice(0, -1).join('/');

// ---------- data / routing ----------
function pathFromHash() {
    return decodeURIComponent(location.hash.replace(/^#\/?/, ''));
}
const go = (p) => { location.hash = '#/' + p.split('/').filter(Boolean).map(encodeURIComponent).join('/'); };

async function load() {
    state.path = pathFromHash();
    state.selected.clear();
    state.query = '';
    $('search').value = '';
    state.searching = false;
    $('status').textContent = 'Loading…';
    try {
        const data = await (await api(`/list?path=${q(state.path)}`)).json();
        state.items = data.items;
        state.treeKids.set(state.path, folderNodes(data.items));
        $('status').textContent = '';
    } catch (error) {
        state.items = [];
        $('status').textContent = error.message;
    }
    render();
    ensureTree();
}

async function runSearch() {
    const text = state.query.trim();
    if (!text) { state.searching = false; return load(); }
    try {
        const data = await (await api(`/search?path=${q(state.path)}&q=${q(text)}`)).json();
        state.items = data.items;
        state.searching = true;
        state.selected.clear();
        $('status').textContent = `${data.items.length} result(s)${data.truncated ? ' (truncated)' : ''}`;
        render();
    } catch (error) { toast(error.message, true); }
}

// ---------- rendering ----------
function sortedItems() {
    const dir = state.asc ? 1 : -1;
    const key = state.sort;
    return [...state.items].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1; // folders first
        let r;
        if (key === 'size') r = (a.size || 0) - (b.size || 0);
        else if (key === 'modified') r = a.modified - b.modified;
        else r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        return r * dir;
    });
}

function renderCrumbs() {
    const nav = $('crumbs');
    nav.replaceChildren(h('a', { href: '#/' }, state.brand.name || state.me.rootName || 'Home'));
    let acc = '';
    for (const part of state.path.split('/').filter(Boolean)) {
        acc += (acc ? '/' : '') + part;
        nav.append(h('span', { class: 'sep' }, '›'), h('a', { href: '#/' + acc.split('/').map(encodeURIComponent).join('/') }, part));
    }
}

function renderRow(item) {
    const isFolder = item.type === 'folder';
    const checked = state.selected.has(item.path);
    const checkbox = h('input', {
        type: 'checkbox', checked, 'aria-label': 'Select ' + item.name,
        onclick: (e) => { e.stopPropagation(); toggleSelect(item.path, e.target.checked); },
    });
    const thumb = item.kind === 'image'
        ? badge(item.kind, thumbImg(item, state.view === 'grid' ? 320 : 160))
        : badge(item.kind);
    const where = state.searching && parentOf(item.path) ? h('small', {}, parentOf(item.path)) : null;

    const action = (icon, title, onclick) => {
        const b = h('button', { class: 'icon-btn', title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); onclick(); } });
        b.innerHTML = svg(icon);
        return b;
    };
    const actions = h('div', { class: 'row-actions' },
        isFolder ? null : action('download', 'Download', () => { location.href = fileUrl(item.path, true); }),
        state.me.canShare ? action('link', 'Share link', () => shareDialog(item.path)) : null);

    return h('div', {
        class: `row${checked ? ' selected' : ''}`, 'data-path': item.path, tabindex: 0,
        onclick: () => openItem(item),
        oncontextmenu: (e) => showCtx(e, item),
        onkeydown: (e) => { if (e.key === 'Enter') openItem(item); },
    },
        checkbox, thumb,
        h('div', { class: 'name', title: item.name }, item.name, where),
        h('div', { class: 'meta' }, isFolder ? '' : formatBytes(item.size)),
        h('div', { class: 'meta date' }, formatDate(item.modified)),
        actions);
}

function render() {
    $('root-name').textContent = state.brand.name || state.me.rootName || 'Files';
    renderCrumbs();
    const list = $('list');
    list.className = `list${state.view === 'grid' ? ' grid' : state.view === 'gallery' ? ' gallery' : ''}`;
    const items = sortedItems();
    if (!items.length) {
        list.replaceChildren(h('div', { class: 'empty' }, badge(state.searching ? 'other' : 'folder'),
            h('strong', {}, state.searching ? 'No matches' : 'This folder is empty'),
            state.searching ? 'Try a different search term.'
                : (!state.path && state.me.canManage ? 'No folders are shared yet. Use the ⚙ button to add one.'
                    : (state.me.canUpload ? 'Drag files here or use Upload.' : ''))));
    }
    else if (state.view === 'gallery') renderGallery(list, items);
    else list.replaceChildren(...items.map(renderRow));
    for (const v of ['list', 'grid', 'gallery']) $('btn-' + v).classList.toggle('on', state.view === v);
    $('btn-order').innerHTML = svg(state.asc ? 'up' : 'down');
    const folders = state.items.filter((i) => i.type === 'folder').length;
    const files = state.items.length - folders;
    const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
    $('summary').textContent = [folders && plural(folders, 'folder'), files && plural(files, 'file')].filter(Boolean).join(' · ');
    $('sort').value = state.sort;
    const atVirtualRoot = state.me.multiRoot && !state.path;
    $('btn-upload').hidden = !state.me.canUpload || atVirtualRoot;
    $('btn-mkdir').hidden = !state.me.canModify || atVirtualRoot;
    renderTree();
    updateSelectionUI();
}

function updateSelectionUI() {
    const n = state.selected.size;
    $('sel-count').textContent = n ? `${n} selected` : 'Select all';
    $('select-all').checked = n > 0 && n === state.items.length;
    $('select-all').indeterminate = n > 0 && n < state.items.length;
    $('selbar').hidden = n === 0;
    $('selbar-count').textContent = `${n} selected`;
    $('btn-rename').hidden = !state.me.canModify || n !== 1;
    $('btn-share').hidden = !state.me.canShare || n !== 1;
    for (const row of $('list').querySelectorAll('[data-path]')) {
        const on = state.selected.has(row.dataset.path);
        row.classList.toggle('selected', on);
        row.querySelector('input').checked = on;
    }
    renderDetails();
}

// ---------- gallery ----------
function renderGallery(list, items) {
    const folders = items.filter((i) => i.type === 'folder');
    const images = items.filter((i) => i.kind === 'image');
    const others = items.filter((i) => i.type !== 'folder' && i.kind !== 'image');
    const parts = [];
    if (folders.length) {
        parts.push(h('div', { class: 'chips' }, folders.map((f) => {
            const chip = h('div', { class: 'chip', onclick: () => go(f.path), oncontextmenu: (e) => showCtx(e, f) }, f.name);
            chip.insertAdjacentHTML('afterbegin', svg('folder'));
            return chip;
        })));
    }
    if (images.length) {
        parts.push(h('div', { class: 'masonry' }, images.map((item) => h('div', {
            class: `shot${state.selected.has(item.path) ? ' selected' : ''}`, 'data-path': item.path,
            onclick: () => openItem(item), oncontextmenu: (e) => showCtx(e, item),
        },
            h('input', { type: 'checkbox', checked: state.selected.has(item.path), 'aria-label': 'Select ' + item.name,
                onclick: (e) => { e.stopPropagation(); toggleSelect(item.path, e.target.checked); } }),
            thumbImg(item, 640, { alt: item.name }),
            h('div', { class: 'cap' }, item.name)))));
    }
    if (others.length) parts.push(h('div', { class: 'others' }, others.map(renderRow)));
    list.replaceChildren(...parts);
}

// ---------- folder tree ----------
const folderNodes = (items) => items.filter((i) => i.type === 'folder')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map((i) => ({ name: i.name, path: i.path }));

async function loadKids(p) {
    if (state.treeKids.has(p)) return;
    try {
        const data = await (await api(`/list?path=${q(p)}`)).json();
        state.treeKids.set(p, folderNodes(data.items));
    } catch { state.treeKids.set(p, []); }
}

async function ensureTree() {
    let acc = '';
    state.treeOpen.add('');
    await loadKids('');
    for (const part of state.path.split('/').filter(Boolean)) {
        acc += (acc ? '/' : '') + part;
        state.treeOpen.add(acc);
        await loadKids(acc);
    }
    renderTree();
}

function renderTree() {
    const root = $('tree');
    const addNode = (node, depth) => {
        const kids = state.treeKids.get(node.path);
        const open = state.treeOpen.has(node.path);
        const twist = h('span', {
            class: `twist${open ? ' open' : ''}${kids && !kids.length ? ' leaf' : ''}`,
            onclick: async (e) => {
                e.stopPropagation();
                if (open) state.treeOpen.delete(node.path);
                else { state.treeOpen.add(node.path); await loadKids(node.path); }
                renderTree();
            },
        }, '▸');
        const icon = h('span');
        icon.innerHTML = svg('folder');
        root.append(h('div', {
            class: `node${node.path === state.path ? ' current' : ''}`, style: `padding-left:${depth * 14 + 4}px`,
            onclick: () => { go(node.path); if (innerWidth < 760) setPanels({ sidebar: false }); },
        }, twist, icon, h('span', { class: 'label' }, node.name)));
        if (open && kids) kids.forEach((k) => addNode(k, depth + 1));
    };
    root.replaceChildren();
    addNode({ name: state.brand.name || state.me.rootName || 'Home', path: '' }, 0);
}

function refreshAll() {
    state.treeKids.clear();
    state.treeOpen = new Set(['']);
    return load();
}

function setPanels(next = {}) {
    Object.assign(state, next);
    store.set('sidebar', state.sidebar ? '1' : '0');
    store.set('details', state.details ? '1' : '0');
    $('sidebar').classList.toggle('collapsed', !state.sidebar);
    $('details').hidden = !state.details;
    $('btn-details').classList.toggle('on', state.details);
    $('scrim').hidden = !(innerWidth < 760 && (state.sidebar || state.details));
    renderDetails();
}

// ---------- details panel ----------
function renderDetails() {
    const el = $('details');
    if (el.hidden) return;
    const selected = state.items.filter((i) => state.selected.has(i.path));
    const row = (k, v) => [h('dt', {}, k), h('dd', {}, v)];

    if (selected.length === 1) {
        const item = selected[0];
        const isFolder = item.type === 'folder';
        const preview = item.kind === 'image'
            ? badge('image', thumbImg(item, 640))
            : badge(item.kind);
        preview.classList.add('dt-preview');
        const dims = h('dd', {}, '—');
        if (item.kind === 'image') {
            const probe = new Image();
            probe.onload = () => { dims.textContent = `${probe.naturalWidth} × ${probe.naturalHeight}`; };
            probe.src = fileUrl(item.path);
        }
        const actions = h('div', { class: 'dt-actions' },
            btnIcon(isFolder ? 'folder' : (PREVIEWABLE.has(item.kind) ? 'eye' : 'download'), isFolder ? 'Open' : (PREVIEWABLE.has(item.kind) ? 'Preview' : 'Download'), () => openItem(item)),
            isFolder ? null : btnIcon('download', 'Download', () => { location.href = fileUrl(item.path, true); }),
            state.me.canShare ? btnIcon('link', 'Share', () => shareDialog(item.path)) : null);
        el.replaceChildren(preview, h('h3', {}, item.name), h('dl', {},
            row('Type', KIND_LABEL[item.kind] || 'File'),
            isFolder ? null : row('Size', formatBytes(item.size)),
            row('Modified', formatDate(item.modified)),
            row('Location', '/' + parentOf(item.path)),
            item.kind === 'image' ? [h('dt', {}, 'Dimensions'), dims] : null), actions);
    } else if (selected.length > 1) {
        const total = selected.reduce((sum, i) => sum + (i.size || 0), 0);
        el.replaceChildren(h('h3', {}, `${selected.length} items selected`),
            h('dl', {}, row('Total size', formatBytes(total))));
    } else {
        const files = state.items.filter((i) => i.type !== 'folder');
        const preview = badge('folder');
        preview.classList.add('dt-preview');
        el.replaceChildren(preview, h('h3', {}, state.path.split('/').pop() || state.brand.name || state.me.rootName || 'Home'),
            h('dl', {}, row('Folders', String(state.items.length - files.length)), row('Files', String(files.length)),
                row('Total size', formatBytes(files.reduce((sum, i) => sum + i.size, 0)))),
            h('p', { class: 'muted' }, 'Select an item to see its details.'));
    }
}

function btnIcon(icon, label, onclick) {
    const b = h('button', { class: 'btn', onclick }, label);
    b.insertAdjacentHTML('afterbegin', svg(icon));
    return b;
}

// ---------- context menu ----------
function hideCtx() { $('ctx').hidden = true; }

function showCtx(event, item) {
    event.preventDefault();
    if (!state.selected.has(item.path)) { state.selected = new Set([item.path]); updateSelectionUI(); }
    const single = state.selected.size === 1;
    const isFolder = item.type === 'folder';
    const entry = (icon, label, fn, cls = '') => {
        const b = h('button', { class: cls, onclick: () => { hideCtx(); fn(); } }, label);
        b.insertAdjacentHTML('afterbegin', svg(icon));
        return b;
    };
    const menu = $('ctx');
    menu.replaceChildren(...[
        single ? entry(isFolder ? 'folder' : 'eye', isFolder ? 'Open' : (PREVIEWABLE.has(item.kind) ? 'Preview' : 'Download'), () => openItem(item)) : null,
        single && !isFolder ? entry('download', 'Download', () => { location.href = fileUrl(item.path, true); }) : null,
        entry('download', single && !isFolder ? 'Download as ZIP' : 'Download selected as ZIP', downloadZip),
        single && state.me.canShare ? entry('link', 'Share link…', () => shareDialog(item.path)) : null,
        entry('info', 'Details', () => setPanels({ details: true })),
        state.me.canModify ? h('hr') : null,
        single && state.me.canModify ? entry('edit', 'Rename…', renameSelected) : null,
        state.me.canModify ? entry('trash', state.selected.size > 1 ? `Delete ${state.selected.size} items…` : 'Delete…', deleteSelected, 'danger') : null,
    ].filter(Boolean));
    menu.hidden = false;
    const { offsetWidth: w, offsetHeight: hgt } = menu;
    menu.style.left = Math.max(8, Math.min(event.clientX, innerWidth - w - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(event.clientY, innerHeight - hgt - 8)) + 'px';
}

function toggleSelect(p, on) {
    if (on) state.selected.add(p); else state.selected.delete(p);
    updateSelectionUI();
}

// ---------- opening / preview ----------
function previewables() { return sortedItems().filter((i) => PREVIEWABLE.has(i.kind)); }

function openItem(item) {
    if (item.type === 'folder') return go(item.path);
    if (PREVIEWABLE.has(item.kind)) return openPreview(item);
    location.href = fileUrl(item.path, true);
}

async function openPreview(item) {
    const list = previewables();
    state.previewIndex = list.findIndex((i) => i.path === item.path);
    state.zoom = 1;
    $('preview').hidden = false;
    $('pv-title').textContent = `${item.name} · ${formatBytes(item.size)}`;
    $('pv-download').href = fileUrl(item.path, true);
    $('pv-prev').hidden = state.previewIndex <= 0;
    $('pv-next').hidden = state.previewIndex >= list.length - 1;
    const isImage = item.kind === 'image';
    for (const id of ['pv-zoom-in', 'pv-zoom-out', 'pv-zoom-reset']) $(id).hidden = !isImage;
    $('pv-play').hidden = !list.some((i) => i.kind === 'image');

    const body = $('pv-body');
    const src = fileUrl(item.path);
    if (item.kind === 'image') body.replaceChildren(h('img', { src, alt: item.name, id: 'pv-img' }));
    else if (item.kind === 'video') body.replaceChildren(h('video', { src, controls: true, autoplay: true }));
    else if (item.kind === 'audio') body.replaceChildren(h('audio', { src, controls: true, autoplay: true }));
    else if (item.kind === 'pdf') body.replaceChildren(h('iframe', { src, title: item.name }));
    else {
        body.replaceChildren(h('pre', {}, 'Loading…'));
        try {
            const data = await (await api(`/text?path=${q(item.path)}`)).json();
            if (state.previewIndex === list.findIndex((i) => i.path === item.path)) body.firstChild.textContent = data.content;
        } catch (error) { body.firstChild.textContent = error.message; }
    }
}

function toggleSlideshow(force) {
    const on = force ?? !state.slide;
    clearInterval(state.slide);
    state.slide = null;
    if (on) {
        state.slide = setInterval(() => {
            const list = previewables().filter((i) => i.kind === 'image');
            if (!list.length) return toggleSlideshow(false);
            const current = list.findIndex((i) => i.path === (previewables()[state.previewIndex] || {}).path);
            openPreview(list[(current + 1) % list.length]);
        }, 3500);
    }
    $('pv-play').innerHTML = svg(on ? 'pause' : 'play');
    $('pv-play').classList.toggle('pv-play-on', on);
}

function closePreview() {
    toggleSlideshow(false);
    $('preview').hidden = true;
    $('pv-body').replaceChildren(); // stops media playback
}

function stepPreview(delta) {
    const list = previewables();
    const next = list[state.previewIndex + delta];
    if (next) openPreview(next);
}

function setZoom(z) {
    state.zoom = Math.min(8, Math.max(0.25, z));
    const img = $('pv-img');
    if (img) img.style.transform = `scale(${state.zoom})`;
}

// ---------- dialogs ----------
function dialog(title, content, actions = []) {
    const box = $('dialog-box');
    box.replaceChildren(h('h2', {}, title), content, h('div', { class: 'actions' }, ...actions));
    $('dialog').hidden = false;
    const focusable = box.querySelector('input[type=text]');
    if (focusable) { focusable.focus(); focusable.select(); }
}
const closeDialog = () => { $('dialog').hidden = true; };
const btn = (label, onclick, cls = '') => h('button', { class: `btn ${cls}`, onclick }, label);

function promptName(title, initial, confirmLabel) {
    return new Promise((resolve) => {
        const input = h('input', { type: 'text', value: initial });
        const done = (v) => { closeDialog(); resolve(v); };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(input.value.trim()); });
        dialog(title, input, [btn('Cancel', () => done(null)), btn(confirmLabel, () => done(input.value.trim()), 'primary')]);
    });
}

function confirmDialog(message, confirmLabel) {
    return new Promise((resolve) => {
        const done = (v) => { closeDialog(); resolve(v); };
        dialog('Please confirm', h('p', {}, message), [btn('Cancel', () => done(false)), btn(confirmLabel, () => done(true), 'danger')]);
    });
}

// ---------- actions ----------
async function downloadZip() {
    const paths = [...state.selected];
    try {
        $('status').textContent = 'Preparing ZIP…';
        const res = await post('/zip', { paths });
        const blob = await res.blob();
        const a = h('a', { href: URL.createObjectURL(blob), download: 'files.zip' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        $('status').textContent = '';
    } catch (error) { $('status').textContent = ''; toast(error.message, true); }
}

async function makeFolder() {
    const name = await promptName('New folder', '', 'Create');
    if (!name) return;
    try { await post('/mkdir', { path: state.path, name }); toast('Folder created'); load(); }
    catch (error) { toast(error.message, true); }
}

async function renameSelected() {
    const [p] = [...state.selected];
    const item = state.items.find((i) => i.path === p);
    const name = await promptName('Rename', item.name, 'Rename');
    if (!name || name === item.name) return;
    try { await post('/rename', { path: p, name }); toast('Renamed'); state.searching ? runSearch() : load(); }
    catch (error) { toast(error.message, true); }
}

async function deleteSelected() {
    const n = state.selected.size;
    if (!(await confirmDialog(`Permanently delete ${n} item${n > 1 ? 's' : ''}? This cannot be undone.`, 'Delete'))) return;
    try { await post('/delete', { paths: [...state.selected] }); toast('Deleted'); state.searching ? runSearch() : load(); }
    catch (error) { toast(error.message, true); }
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = h('textarea', {}, text);
    document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    return Promise.resolve();
}

function shareDialog(target) {
    const p = typeof target === 'string' ? target : [...state.selected][0];
    if (p === undefined) return toast('Select a file or folder to share', true);
    const expiry = h('select', {},
        h('option', { value: '60' }, '1 hour'), h('option', { value: '1440', selected: true }, '24 hours'),
        h('option', { value: '10080' }, '7 days'), h('option', { value: '43200' }, '30 days'),
        h('option', { value: '0' }, 'Never'));
    const result = h('div');
    const create = btn('Create link', async () => {
        try {
            const share = await (await post('/shares', { path: p, expiresInMinutes: Number(expiry.value) })).json();
            const linkRow = (value) => h('div', { class: 'field' },
                h('input', { type: 'text', value, readonly: true }),
                btn('Copy', () => copyText(value).then(() => toast('Link copied'))));
            result.replaceChildren(
                h('div', { class: 'link-label' }, 'On this network'),
                linkRow(share.url),
                h('p', { class: 'net-note' }, 'For anyone on the same Wi-Fi or LAN. The file goes straight from this computer, using no internet data.'),
                h('img', { class: 'qr', alt: 'QR code', src: `${BASE}/api/qr?text=${q(share.url)}` }),
                share.internetUrl ? h('div', {},
                    h('div', { class: 'link-label' }, 'Over the internet'),
                    linkRow(share.internetUrl),
                    h('p', { class: 'net-note' }, 'For people outside your network. The file travels over the internet.')) : null);
            create.remove();
        } catch (error) { toast(error.message, true); }
    }, 'primary');
    dialog('Share link', h('div', {}, h('p', {}, p.split('/').pop()),
        h('div', { class: 'field' }, 'Expires after', expiry), result), [btn('Close', closeDialog), create]);
}

async function sharesManager() {
    try {
        const shares = await (await api('/shares')).json();
        const body = shares.length ? h('div', {}, ...shares.map((s) => h('div', { class: 'share-item' },
            h('div', {}, `${s.type === 'folder' ? '📁' : '📄'} /${s.path}`),
            h('a', { class: 'link', href: s.url, target: '_blank', rel: 'noopener' }, s.url),
            s.internetUrl ? h('a', { class: 'link', href: s.internetUrl, target: '_blank', rel: 'noopener' }, s.internetUrl) : null,
            h('div', {}, `${s.downloads} download(s) · ${s.expiresAt ? 'expires ' + formatDate(s.expiresAt) : 'never expires'} `,
                btn('Copy', () => copyText(s.url).then(() => toast('Link copied'))),
                ' ', btn('Revoke', async () => { await api(`/shares/${s.token}`, { method: 'DELETE' }); sharesManager(); }, 'danger')))))
            : h('p', {}, 'No active share links.');
        dialog('Share links', body, [btn('Close', closeDialog)]);
    } catch (error) { toast(error.message, true); }
}

// ---------- shared folders (configured in the UI) ----------
async function foldersDialog() {
    try {
        const folders = await (await api('/folders')).json();
        const body = h('div', {},
            h('p', { class: 'muted' }, 'Choose which folders on this computer are shown to everyone who opens this site.'),
            folders.length ? folders.map((f) => h('div', { class: 'share-item' },
                h('strong', {}, f.name, f.exists ? '' : '  (missing)'),
                h('div', { class: 'muted' }, f.path),
                h('div', {},
                    btn('Rename', async () => {
                        const name = await promptName('Rename shared folder', f.name, 'Rename');
                        if (!name || name === f.name) return foldersDialog();
                        try { await api(`/folders/${f.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); await refreshAll(); }
                        catch (error) { toast(error.message, true); }
                        foldersDialog();
                    }), ' ',
                    btn('Stop sharing', async () => {
                        if (!(await confirmDialog(`Stop sharing "${f.name}"? Files stay on disk; its share links stop working.`, 'Stop sharing'))) return foldersDialog();
                        try { await api(`/folders/${f.id}`, { method: 'DELETE' }); await refreshAll(); toast('Folder removed'); }
                        catch (error) { toast(error.message, true); }
                        foldersDialog();
                    }, 'danger'))))
                : h('p', {}, 'No folders shared yet.'));
        dialog('Shared folders', body, [btn('Close', closeDialog), btn('Add folder…', () => folderPicker(''), 'primary')]);
    } catch (error) { toast(error.message, true); }
}

async function folderPicker(start) {
    try {
        const data = await (await api(`/host/dirs?path=${q(start)}`)).json();
        const name = h('input', { type: 'text', placeholder: 'Display name (optional)' });
        const jump = h('input', { type: 'text', placeholder: 'Type or paste a path and press Enter, e.g. D:\\Photos' });
        jump.addEventListener('keydown', (e) => { if (e.key === 'Enter' && jump.value.trim()) folderPicker(jump.value.trim()); });
        const row = (label, target) => {
            const el = h('div', { class: 'node', onclick: () => folderPicker(target) }, label);
            el.insertAdjacentHTML('afterbegin', svg('folder'));
            return el;
        };
        const list = h('div', { class: 'picker' },
            data.parent !== null ? row('.. (up)', data.parent) : null,
            data.dirs.length ? data.dirs.map((d) => row(d.name, d.path)) : h('p', { class: 'muted' }, 'No sub-folders here.'));
        const choose = btn('Share this folder', async () => {
            try {
                await post('/folders', { path: data.path, name: name.value.trim() });
                toast('Folder added');
                await refreshAll();
            } catch (error) { toast(error.message, true); }
            foldersDialog();
        }, 'primary');
        choose.disabled = !data.path;
        dialog('Pick a folder', h('div', {},
            h('div', { class: 'field' }, h('strong', {}, data.path || 'Drives')),
            h('div', { class: 'field' }, jump),
            list,
            h('div', { class: 'field' }, name)),
            [btn('Back', foldersDialog), choose]);
    } catch (error) { toast(error.message, true); }
}

// ---------- nearby devices (direct transfer, never stored on the server) ----------
const KIND_ICON = { phone: '📱', tablet: '📱', laptop: '💻' };
let p2pTray = null;
let p2pDialogOpen = false;

function trayCard(id, ...children) {
    if (!p2pTray) { p2pTray = h('div', { class: 'p2p-tray' }); document.body.append(p2pTray); }
    let card = [...p2pTray.children].find((c) => c.dataset.tid === id);
    if (!card) { card = h('div', { class: 'p2p-card' }); card.dataset.tid = id; p2pTray.append(card); }
    card.classList.remove('error');
    card.replaceChildren(...children.filter(Boolean));
    return card;
}
const dropCard = (id, delay = 0) => setTimeout(() => p2pTray && [...p2pTray.children].find((c) => c.dataset.tid === id)?.remove(), delay);

function renderP2PDialog() {
    const peers = window.P2P.peers();
    const input = h('input', { type: 'file', multiple: true, hidden: true });
    let target = null;
    input.onchange = () => {
        [...input.files].forEach((file) => window.P2P.send(target, file));
        input.value = '';
        p2pDialogOpen = false;
        closeDialog();
    };
    const body = h('div', {},
        h('p', { class: 'muted' }, 'You appear as ', h('strong', {}, window.P2P.name), ' to other devices on this network. ',
            h('a', { href: '#', onclick: async (e) => {
                e.preventDefault();
                const name = await promptName('Name shown to nearby devices', window.P2P.name, 'Save');
                if (name) window.P2P.rename(name);
                renderP2PDialog();
            } }, 'Rename')),
        peers.length
            ? peers.map((p) => h('div', { class: 'p2p-device' },
                h('span', { class: 'ico' }, KIND_ICON[p.kind] || '💻'),
                h('span', { class: 'who' }, p.name),
                btn('Send file…', () => { target = p.id; input.click(); }, 'primary')))
            : h('p', {}, 'No other devices found yet. Open this site on another phone or computer on the same Wi-Fi and it will show up here.'),
        h('p', { class: 'p2p-help' }, 'Files go straight from your device to theirs. They are not uploaded to the server and use no internet data.'),
        input);
    dialog('Send to a nearby device', body, [btn('Close', () => { p2pDialogOpen = false; closeDialog(); })]);
    p2pDialogOpen = true;
}

function initP2P() {
    const P2P = window.P2P;
    $('btn-p2p').hidden = false;
    $('btn-p2p').onclick = renderP2PDialog;
    P2P.on('peers', (peers) => {
        $('btn-p2p').lastChild.textContent = peers.length ? `Send to device (${peers.length})` : 'Send to device';
        if (p2pDialogOpen && !$('dialog').hidden) renderP2PDialog();
    });

    P2P.on('incoming', (req) => {
        const big = req.size > 1.5 * 1024 ** 3 && !(window.showSaveFilePicker && window.isSecureContext);
        trayCard(req.tid,
            h('div', { class: 'p2p-title' }, `${req.peerName} wants to send you a file`),
            h('div', {}, `${req.name} · ${formatBytes(req.size)}`),
            big ? h('div', { class: 'muted' }, 'This is a large file and this browser keeps it in memory while receiving. If it fails, ask for a share link instead.') : null,
            h('div', { class: 'p2p-row' },
                btn('Decline', () => { req.decline(); dropCard(req.tid); }),
                btn('Accept', () => { req.accept(); }, 'primary')));
    });

    const bar = (tid, e, label) => trayCard(tid,
        h('div', { class: 'p2p-title' }, `${label} ${e.name}`),
        h('div', { class: 'muted' }, `${e.peerName} · ${formatBytes(e.done || 0)} of ${formatBytes(e.size)}`),
        h('div', { class: 'bar' }, h('i', { style: `width:${e.size ? Math.min(100, (e.done / e.size) * 100) : 100}%` })),
        h('div', { class: 'p2p-row' }, btn('Cancel', () => P2P.cancel(tid))));
    P2P.on('start', (e) => bar(e.tid, { ...e, done: 0 }, e.dir === 'send' ? 'Sending' : 'Receiving'));
    P2P.on('progress', (e) => bar(e.tid, e, e.dir === 'send' ? 'Sending' : 'Receiving'));
    P2P.on('done', (e) => {
        trayCard(e.tid, h('div', { class: 'p2p-title' }, e.dir === 'send' ? `Sent ${e.name} to ${e.peerName}` : `Received ${e.name} from ${e.peerName}`));
        dropCard(e.tid, 5000);
    });
    P2P.on('error', (e) => {
        trayCard(e.tid, h('div', { class: 'p2p-title' }, e.name), h('div', {}, e.message)).classList.add('error');
        dropCard(e.tid, 9000);
    });
    P2P.start();
}

// ---------- upload ----------
function uploadOne(file, onProgress) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('files', file, file.name);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE}/api/upload?path=${q(state.path)}`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
        xhr.onload = () => {
            let body = {};
            try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
            if (xhr.status >= 200 && xhr.status < 300) resolve(body);
            else reject(new Error(body.error || `Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
    });
}

async function uploadFiles(files) {
    files = [...files];
    if (!files.length || !state.me.canUpload) return;
    if (state.me.multiRoot && !state.path) return toast('Open a shared folder first', true);
    const total = files.reduce((s, f) => s + f.size, 0) || 1;
    let done = 0, ok = 0;
    $('progress').hidden = false;
    for (const [i, file] of files.entries()) {
        const update = (loaded) => {
            const pct = Math.round(((done + loaded) / total) * 100);
            $('progress-bar').style.width = pct + '%';
            $('progress-text').textContent = `Uploading ${i + 1}/${files.length} · ${pct}%`;
        };
        update(0);
        try {
            const res = await uploadOne(file, update);
            for (const r of res.rejected || []) toast(`${r.name}: ${r.error}`, true);
            ok += res.uploaded || 0;
        } catch (error) { toast(`${file.name}: ${error.message}`, true); }
        done += file.size;
    }
    $('progress').hidden = true;
    if (ok) toast(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`);
    load();
}

// ---------- wiring ----------
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('btn-theme').innerHTML = svg(theme === 'dark' ? 'sun' : 'moon');
    store.set('theme', theme);
}

function wire() {
    decorate();
    applyTheme(store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    $('btn-theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    $('btn-list').onclick = () => { state.view = 'list'; store.set('view', 'list'); render(); };
    $('btn-grid').onclick = () => { state.view = 'grid'; store.set('view', 'grid'); render(); };
    $('btn-gallery').onclick = () => { state.view = 'gallery'; store.set('view', 'gallery'); render(); };
    $('btn-sidebar').onclick = () => setPanels({ sidebar: !state.sidebar });
    $('btn-details').onclick = () => setPanels({ details: !state.details });
    $('scrim').onclick = () => setPanels({ sidebar: false, details: false });
    $('pv-play').onclick = () => toggleSlideshow();
    document.addEventListener('click', hideCtx);
    document.addEventListener('scroll', hideCtx, true);
    window.addEventListener('resize', hideCtx);
    $('btn-clear').onclick = () => { state.selected.clear(); updateSelectionUI(); };
    $('sort').onchange = (e) => { state.sort = e.target.value; store.set('sort', state.sort); render(); };
    $('btn-order').onclick = () => { state.asc = !state.asc; store.set('asc', state.asc ? '1' : '0'); render(); };
    $('select-all').onchange = (e) => {
        state.selected = new Set(e.target.checked ? state.items.map((i) => i.path) : []);
        updateSelectionUI();
    };
    let timer;
    $('search').oninput = (e) => { state.query = e.target.value; clearTimeout(timer); timer = setTimeout(runSearch, 300); };

    $('btn-zip').onclick = downloadZip;
    $('btn-share').onclick = () => shareDialog();
    $('btn-rename').onclick = renameSelected;
    $('btn-delete').onclick = deleteSelected;
    $('btn-mkdir').onclick = makeFolder;
    $('btn-upload').onclick = () => $('file-input').click();
    $('file-input').onchange = (e) => { uploadFiles(e.target.files); e.target.value = ''; };
    $('btn-shares').onclick = sharesManager;
    $('btn-folders').onclick = foldersDialog;

    $('pv-close').onclick = closePreview;
    $('pv-prev').onclick = () => stepPreview(-1);
    $('pv-next').onclick = () => stepPreview(1);
    $('pv-zoom-in').onclick = () => setZoom(state.zoom * 1.25);
    $('pv-zoom-out').onclick = () => setZoom(state.zoom / 1.25);
    $('pv-zoom-reset').onclick = () => setZoom(1);
    $('pv-body').addEventListener('wheel', (e) => {
        if (!$('pv-img')) return;
        e.preventDefault();
        setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    $('pv-body').addEventListener('click', (e) => {
        if (e.target === $('pv-img')) setZoom(state.zoom === 1 ? 2 : 1);
        else if (e.target === $('pv-body')) closePreview();
    });
    $('dialog').addEventListener('click', (e) => { if (e.target === $('dialog')) closeDialog(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideCtx();
        if (!$('dialog').hidden) { if (e.key === 'Escape') closeDialog(); return; }
        if ($('preview').hidden) {
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
            if (!typing && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'i') setPanels({ details: !state.details });
            return;
        }
        if (e.key === ' ') { e.preventDefault(); toggleSlideshow(); }
        if (e.key === 'Escape') closePreview();
        else if (e.key === 'ArrowLeft') stepPreview(-1);
        else if (e.key === 'ArrowRight') stepPreview(1);
        else if (e.key === '+' || e.key === '=') setZoom(state.zoom * 1.25);
        else if (e.key === '-') setZoom(state.zoom / 1.25);
    });

    // Drag & drop upload
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    window.addEventListener('dragenter', (e) => { if (hasFiles(e) && state.me.canUpload) { depth++; $('drop').hidden = false; } });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('drop').hidden = true; } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); depth = 0; $('drop').hidden = true;
        uploadFiles([...e.dataTransfer.files].filter((f) => f.size || f.type)); // skips folders
    });

    window.addEventListener('hashchange', load);
}

async function init() {
    wire();
    try { state.me = await (await api('/me')).json(); } catch (error) { $('status').textContent = error.message; return; }
    const m = state.me;
    state.brand = await window.brandReady.catch(() => ({}));
    $('btn-upload').hidden = !m.canUpload;
    $('btn-mkdir').hidden = !m.canModify;
    $('btn-delete').hidden = !m.canModify;
    $('btn-shares').hidden = !m.canShare;
    $('btn-folders').hidden = !m.canManage;
    $('btn-logout').hidden = !m.hasPassword;
    if (m.canP2P && window.P2P && window.RTCPeerConnection) initP2P();
    const badge = $('net-badge');
    badge.hidden = false;
    badge.className = 'net-badge ' + (m.local ? 'local' : 'internet');
    badge.textContent = m.local ? 'Local network' : 'Internet';
    badge.title = m.local ? 'You are on the same network as the server: transfers stay local and use no internet data'
        : 'You are connected over the internet: transfers use internet data';
    document.title = m.mode === 'share' ? 'Shared files' : (state.brand.name || `${m.rootName} – File Server`);
    setPanels();
    if (m.hasPassword) {
        $('btn-logout').onclick = async () => { await fetch('/logout', { method: 'POST' }); location.href = '/login'; };
    }
    load();
}

init();
})();
