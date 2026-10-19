# AT Protocol Archive

A static, framework-free archive. Items are records in contributors' own
Bluesky repositories; the site reads them directly from each user's PDS.
No server, no database, no build step.

## File structure

```
archive/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── contributor-request.yml
│   └── workflows/
│       └── add-contributor.yml
├── css/
│   └── style.css
├── js/
│   ├── atproto.js
│   ├── browse.js
│   ├── item.js
│   └── upload.js
├── scripts/
│   └── add-contributor.mjs
├── .nojekyll
├── README.md
├── contributors.json
├── index.html
├── item.html
└── upload.html
```

The `.github` folder, `.nojekyll`, and `scripts/` must sit at the repo root,
alongside `index.html`, for GitHub Pages and the workflow to find them.

## Files

- `index.html` browse, search, tag filter, sorting
- `item.html` per-item detail page (preview, download, metadata)
- `upload.html` sign in with an app password, upload, manage your items
- `contributors.json` list of handles whose repos are included
- `js/atproto.js` all AT Protocol calls (shared)
- `js/browse.js`, `js/item.js`, `js/upload.js` page logic
- `css/style.css` styling with light and dark mode

## Setup

1. **Pick a namespace.** In `js/atproto.js`, change `com.example.archive.item`
   to a name under a domain you control (for example `net.yourdomain.archive.item`).
   Do this before uploading anything.
2. **List contributors.** Edit `contributors.json` with the handles to include,
   for example `["alice.bsky.social", "bob.example.com"]`. Only listed handles
   appear in the archive.
3. **Run locally.** Browsers block modules opened from `file://`, so serve the folder:
   ```
   cd archive
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000.
4. **Deploy.** Upload the folder to any static host: GitHub Pages, Netlify,
   or Cloudflare Pages. No server configuration is needed.

### GitHub Pages

1. Create a repository and push the contents of the `archive` folder to its root
   (so `index.html` sits at the top level).
2. In the repo, go to **Settings → Pages**, set **Source** to *Deploy from a branch*,
   choose `main` and `/ (root)`, and save.
3. After a minute the site is live at `https://<user>.github.io/<repo>/`.

Notes:
- The `.nojekyll` file tells GitHub not to run Jekyll, so files are served exactly as written.
- All paths are relative, so the site works both at `<user>.github.io` and under a project subpath.
- GitHub Pages serves over HTTPS, which the AT Protocol endpoints require.
- Editing `contributors.json` or the namespace means committing and pushing; GitHub rebuilds the site automatically.

## Contributing

1. Create a Bluesky account (or use your own) and make an app password under
   Settings → Privacy and security → App passwords.
2. Open a **Request to contribute** issue in the repository and enter your handle.
   A workflow validates it and adds it to `contributors.json` automatically,
   then replies on the issue and closes it.
3. Sign in on `upload.html` and upload. Files and metadata are stored in your repo.

Maintainers: the workflow lives in `.github/workflows/add-contributor.yml`, the
issue form in `.github/ISSUE_TEMPLATE/contributor-request.yml`, and the logic
in `scripts/add-contributor.mjs`. Repo Settings → Actions must allow read and
write workflow permissions.

## Security notes

- The app password is typed into a page that runs JavaScript. Only deploy code
  you trust, and treat the site's source as sensitive. Anyone who can edit the
  deployed files could capture passwords.
- Use app passwords, never your main password. Revoke an app password in
  Bluesky settings if you think it leaked.
- The session lives in memory only and is cleared when the page closes.
- Previews are limited to images, audio, video, PDF, and plain text. HTML is
  never rendered inline, so an uploaded file can't run scripts on the PDS origin.

## Known limits (please read)

- **Discovery is manual.** The archive only shows handles in `contributors.json`.
  Without a server or crawler, there's no way to find every repo that uses the
  collection. Anyone can upload to their own repo, but it won't appear here
  until they're listed.
- **Only `did:plc` accounts** are supported for reading and writing. `did:web`
  accounts would need extra lookup code.
- **Deleting** removes the record from the repo, and the archive will stop
  showing it. Blobs may remain on the PDS until garbage collection. Copies made
  by others may still exist.
- **Blob limits.** PDS servers impose size and type limits that vary. The
  default here is 50 MB. Test with a PDF before relying on large files.
- **CORS.** Browser reads depend on each PDS allowing cross-origin requests.
  Bluesky's PDS does, but a third-party PDS may not. If one fails, the archive
  shows it as unavailable instead of breaking.
- **Not yet tested against live servers.** This code was written against the
  documented XRPC endpoints but hasn't been run here. Start with one test
  account and one small file, and check the browser console for errors.

## Verification checklist

- [ ] Namespace changed from `com.example`
- [ ] Test account in `contributors.json`
- [ ] Sign in works on `upload.html`
- [ ] Uploading a small PDF creates an item that appears on `index.html`
- [ ] Clicking the item opens `item.html` and the preview loads
- [ ] Deleting an item removes it from the list
