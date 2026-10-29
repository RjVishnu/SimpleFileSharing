# File Server

A small Node.js file server for sharing a folder on your network: browse, preview, upload, zip-download, and hand out expiring share links.

## Run

```bash
npm install
npm start                       # uses config.js defaults
node server.js --dir "D:\Photos" --port 5002 --password secret
npm test                        # end-to-end smoke tests
```

Windows/Linux executables: `npm run build-exe` / `npm run build-linux` (uses `pkg`; the Windows build is tested, the Linux one is not). Output goes to `dist/`.

## Features

- Browse with breadcrumbs, list/grid view, sorting, recursive name search
- Preview images (zoom, wheel, click), video, audio, PDF, text/code; prev/next with ← → keys
- Multi-select → ZIP download (files and folders)
- Upload via button or drag & drop, with progress; name conflicts become `name (1).ext`
- **Share links**: per file or folder, optional expiry, QR code, download counter, revoke anytime. Links are read-only and limited to what was shared; they work without the password
- Optional password login, dark mode, mobile friendly
- New folder / rename / delete (enabled when a password is set, or `ALLOW_MODIFY=true`)

## Choosing shared folders (in the UI)

Click the ⚙ button in the top bar to add or remove shared folders, rename them, and pick folders from a built-in browser of this computer (or type a path). With one folder the site shows its contents directly; with several, the home page lists them. Changes apply immediately and are saved in `data/settings.json`; the first run starts from `--dir` / `SHARE_ROOT` / `config.js`.

Removing a folder only stops sharing it (files stay on disk) and its share links stop working. Because this lets a visitor expose any folder on the host, the ⚙ button is only available when a password is set, when you open the site from the same computer, or when `ALLOW_SETTINGS=true`.

## Same network first, internet only if needed

- The server is on your network, so two people on the same Wi-Fi/LAN exchange files directly through it: nothing leaves the building and no internet data is used. Share links are always built from the server's LAN address (virtual adapters such as WSL, Docker and VirtualBox are skipped) and come with a QR code.
- The top bar shows whether you are connected from the **Local network** or over the **Internet**.
- To also reach people outside the network, expose the server yourself (router port-forward, reverse proxy, or a tunnel) and set `PUBLIC_URL`. Share dialogs then show a second, clearly labelled "Over the internet" link.
- If a reverse proxy or tunnel runs on the same machine as the server, make it send `X-Forwarded-For` (most do). Requests carrying forwarding headers are never treated as "from this computer", so internet visitors cannot manage folders. Set a password before exposing the server to the internet; traffic is plain HTTP unless the proxy adds HTTPS.

## Configuration

CLI flags override environment variables, which override `config.js`.

| Setting | Flag / env | Default |
|---|---|---|
| Shared folder | `--dir` / `SHARE_ROOT` | `config.js` → `./shared-files` if missing |
| Port / host | `--port`, `--host` / `PORT`, `HOST` | `5002` / `0.0.0.0` |
| Password | `--password` / `SHARE_PASSWORD` | none (open access) |
| Allow upload | `ALLOW_UPLOAD` | `true` |
| Allow delete/rename/mkdir | `ALLOW_MODIFY` | `true` only if a password is set |
| Max upload size | `MAX_UPLOAD_MB` | `2048` |
| Blocked upload types | `BLOCKED_EXT` | `.exe,.bat,.cmd,.com,.msi,.scr,.ps1,.vbs,.dll` |
| Max items per ZIP | `MAX_ZIP_FILES` | `500` |
| Branding | `--brand-name`, `--brand-color`, `--brand-logo` / `BRAND_NAME`, `BRAND_COLOR` (`#rrggbb`), `BRAND_LOGO` (image path) | none |
| Internet address | `--public-url` / `PUBLIC_URL` (e.g. `https://files.example.com`) | none |
| Share-link storage | `DATA_DIR` | `./data` |

## Security notes

- Without a password anyone on your network can browse and download the shared folder; set one for anything beyond a trusted LAN. Traffic is plain HTTP.
- Paths are resolved inside the shared root (traversal and symlink escapes rejected); dotfiles are hidden and inaccessible.
- Served files get `Content-Security-Policy: sandbox` so uploaded HTML/SVG can't run scripts.
- Login is rate-limited; sessions use a signed HttpOnly SameSite=Strict cookie and reset on restart.

## Layout

```
server.js            entry point
config.js            default settings
src/config.js        merges flags / env / defaults
src/app.js           express wiring (admin scope + share-link scope)
src/routes/          browse, files, upload, manage, shares, folders
src/middleware/      auth, security headers
src/services/        share-link store, shared-folder settings store
src/lib/             scope, path safety, file types, network
public/              single-page UI (index.html, app.js, app.css, brand.js, login)
test/smoke.js        end-to-end tests (npm test)
docs/archive/        notes from the previous implementation
```
