const path = require('path');

const GROUPS = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
    video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
    audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma'],
    pdf: ['.pdf'],
    text: [
        '.txt', '.md', '.json', '.js', '.html', '.css', '.xml', '.csv', '.log',
        '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.jsx', '.tsx', '.yml', '.yaml',
    ],
    archive: ['.zip', '.rar', '.7z', '.tar', '.gz'],
};

// Types a browser can render directly; everything else is a download.
const PREVIEWABLE = new Set(['image', 'video', 'audio', 'pdf', 'text']);

function kindOf(name, isDirectory) {
    if (isDirectory) return 'folder';
    const ext = path.extname(name).toLowerCase();
    for (const [kind, exts] of Object.entries(GROUPS)) {
        if (exts.includes(ext)) return kind;
    }
    return 'other';
}

const isPreviewable = (kind) => PREVIEWABLE.has(kind);

module.exports = { kindOf, isPreviewable };
