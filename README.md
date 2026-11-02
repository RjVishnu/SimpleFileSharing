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
- Photo thumbnails in lists, grid and gallery (cached, original untouched)
- **Send to device**: direct phone-to-computer transfer over the local network, never stored on the server
- Multi-select → ZIP download (files and folders)
- Upload via button or drag & drop, with progress; name conflicts become `name (1).ext`. Files over 8 MB upload in chunks and **resume** after a dropped connection (even after a page reload: choose the same file again)
- **Share links**: per file or folder, optional expiry and **optional link password**, QR code, download counter, revoke anytime. Links are read-only and limited to what was shared; they work without the site password
- Optional password login, dark mode, mobile friendly
- New folder / rename / delete (enabled when a password is set, or `ALLOW_MODIFY=true`)

## Choosing shared folders (in the UI)

Click the ⚙ button in the top bar to add or remove shared folders, rename them, and pick folders from a built-in browser of this computer (or type a path). With one folder the site shows its contents directly; with several, the home page lists them. Changes apply immediately and are saved in `data/settings.json`; the first run starts from `--dir` / `SHARE_ROOT` / `config.js`.

Removing a folder only stops sharing it (files stay on disk) and its share links stop working. Because this lets a visitor expose any folder on the host, the ⚙ button is only available when a password is set, when you open the site from the same computer, or when `ALLOW_SETTINGS=true`.

## Thumbnails

Lists, the grid and the gallery show small resized copies of photos instead of the full files, so a folder of large photos opens quickly and uses far less data. They are made on first view (about 0.1 s per 12-megapixel photo), cached under `data/thumbs` (limited to `THUMB_CACHE_MB`, oldest removed first), and a changed photo gets a new thumbnail. Opening a photo, downloading, and share-link download counts all use the original, untouched file.

Thumbnails need the optional `sharp` package (installed by `npm install`; it has native parts). If it is missing, or for formats it can't read, the original image is shown instead. They are not available in the packaged `.exe` (`pkg` can't bundle sharp's native files; the build prints two warnings about this), so run `node server.js` where you want them. Turn off with `THUMBNAILS=false`.

## Send to a nearby device (direct, nothing stored on the server)

Click **Send to device** to see other phones and computers that have this site open on the same network, pick one and choose a file. The other person gets an Accept / Decline card, and the file then travels straight from your browser to theirs over WebRTC. The server only introduces the two devices; it never receives the file, and no internet data is used.

- Works for any size. Chrome and Edge on a secure page (localhost or HTTPS) stream the file to disk; on plain-HTTP LAN pages the receiver assembles it in memory first, so for multi-GB files prefer a share link.
- Devices on the local network see each other; visitors from the internet only see others behind the same public address.
- Both devices need to be open on the page. For a transfer that doesn't need the other person present, use a share link.
- Across different networks the browsers usually can't reach each other directly. Set `STUN_SERVERS` (for example `stun:stun.l.google.com:19302`) to allow it; this tells that STUN server the devices' public addresses, which is why it is off by default. If the connection still fails, use a share link.
- **Share a folder from your computer.** In the same dialog, **Choose folder…** offers a folder on your computer to everyone on the network. Their Send to device list then shows "Sharing <folder>" with a **Browse** button: they open folders and download files, straight from your browser. Nothing is uploaded to the server, and it works when the server runs elsewhere, for example in Docker. Chrome, Edge, Firefox and desktop Safari can pick a folder; it also works on plain-HTTP LAN pages. It stops when you click **Stop sharing** or close or reload the tab (browsers cannot keep a folder open after that), hidden files (names starting with a dot) are never offered, and up to 8 people can browse at once. Anyone on your network can browse it while it is on, with no password, so share only what you are happy for them to see. Downloads are one file at a time; each asks where to save on a secure page.
- Turn it off with `ALLOW_P2P=false`.

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
| This machine's LAN address (Docker) | `--lan-url` / `LAN_URL` (e.g. `http://192.168.1.50:5002`) | detected |
| Internet address | `--public-url` / `PUBLIC_URL` (e.g. `https://files.example.com`) | none |
| Thumbnails | `THUMBNAILS`, `THUMB_CACHE_MB` | `true`, `500` |
| Direct transfer | `ALLOW_P2P` | `true` |
| STUN servers (cross-network direct transfer) | `--stun` / `STUN_SERVERS` (comma-separated `stun:` URLs) | none |
| Share-link storage | `DATA_DIR` | `./data` |

## Docker

```bash
mkdir files                          # the folder to share
docker compose up -d --build
```

Open http://localhost:5002. Put files in `./files`; uploads are written there. Settings go in a `.env` file next to `docker-compose.yml` or in the shell, for example:

```bash
SHARE_PASSWORD=choose-one
LAN_URL=http://192.168.1.50:5002     # this machine's address on your network
```

Or without compose:

```bash
docker build -t fileserver .
docker run -d --name fileserver --init -p 5002:5002   -v "$PWD/files:/share" -v fileserver-data:/data   -e SHARE_PASSWORD=choose-one -e LAN_URL=http://192.168.1.50:5002 fileserver
```

- **Set `LAN_URL`.** Inside a container the server only sees its own private address (like 172.17.0.2), which other devices cannot reach. `LAN_URL` is the address people on your network use (this machine's IP and the published port); share links are built from it. If you open the app through the machine's real address instead of `localhost`, links use that address and port automatically.
- **Set `SHARE_PASSWORD`.** Without one, deleting, renaming and choosing folders are only allowed from the host itself, and a container cannot tell the host apart from other devices, so they stay off. A password turns them on. Alternatively set `ALLOW_SETTINGS=true` on a network you trust.
- Two volumes: `/share` is the shared folder and `/data` holds share links, your folder choices and the thumbnail cache. Keep `/data` as a volume so links survive updates. To share more than one folder, mount each one (for example `-v /mnt/photos:/share/photos` or `-v /mnt/photos:/photos`) and pick them in the app.
- The container runs as the unprivileged `node` user (uid 1000). If uploads fail with "permission denied", make the shared folder writable for that user, or add `user: "1000:1000"` (or your own uid) to the compose service.
- Thumbnails work in the image. Direct device-to-device sending works on the same network; it does not pass through the container's files.
- Behind a reverse proxy (nginx, Caddy, Traefik) forward the `X-Forwarded-For` header and set `PUBLIC_URL`. A health check is built in (`/healthz`).

## Security notes

- Without a password anyone on your network can browse and download the shared folder; set one for anything beyond a trusted LAN. Traffic is plain HTTP.
- Paths are resolved inside the shared root (traversal and symlink escapes rejected); dotfiles are hidden and inaccessible.
- Served files get `Content-Security-Policy: sandbox` so uploaded HTML/SVG can't run scripts.
- A share link can have its own password (4 to 128 characters, set in the Share dialog). It is stored only as a salted scrypt hash. Visitors see an unlock page, and a correct password sets a cookie that works for that link only, for 12 hours or until the server restarts. Wrong guesses are limited to 10 per visitor and 40 per link every 15 minutes. Send the password separately from the link. Over plain HTTP the password and cookie can be read by anyone on the network path, so for anything sensitive use HTTPS.
- Login is rate-limited; sessions use a signed HttpOnly SameSite=Strict cookie and reset on restart.

## Layout

```
server.js            entry point
config.js            default settings
src/config.js        merges flags / env / defaults
src/app.js           express wiring (admin scope + share-link scope)
src/routes/          browse, files, upload (+ resumable chunks), manage, shares, folders, p2p (device-to-device signalling)
src/middleware/      auth, share-link unlock, security headers
src/services/        share-link store, shared-folder settings store, thumbnails
src/lib/             scope, path safety, file types, network, password hashing
public/              single-page UI (index.html, app.js, app.css, brand.js, p2p.js, folder.js, login, unlock)
test/                end-to-end tests (npm test): smoke.js, thumbs.js
docs/archive/        notes from the previous implementation
```
