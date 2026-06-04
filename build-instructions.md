# Build instructions

> Pagelate is a Manifest V3 fork of
> [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web).

## Preliminary information

- The build just copies `src/` into per-browser folders, swaps in the right manifest,
  and zips them. There is no transpilation/bundling step (no Babel, no polyfills) — the
  source is shipped as-is.
- For debugging in **Firefox** you can load `src/manifest.json` directly
  (`about:debugging` → Load Temporary Add-on); a reload then picks up edits without a
  rebuild.
- For **Chrome** you must load a build (it needs `chrome_manifest.json` renamed to
  `manifest.json`, which the build does), or temporarily copy `chrome_manifest.json`
  over `manifest.json` yourself.
- Run `npm install` once before building.
- The `extra/` folder is **not** part of the extension build.

## Two manifests, kept in sync

- **Firefox** uses `src/manifest.json` (background `scripts` event page,
  `browser_specific_settings.gecko`, `strict_min_version: 115.0`).
- **Chrome** uses `src/chrome_manifest.json` (background `service_worker`,
  `minimum_chrome_version: 116`). During the build it is renamed to `manifest.json`
  (see `gulpfile.js` → `chrome-rename`).

Any permission/resource change must be made in **both** files.

## How to build

```bash
npm install
npm run build          # = npx gulp ; cleans ./build, then builds Firefox + Chromium
npm run build:sign     # same, plus prompts for a key file and writes a signed .crx
```

### Output (`./build`)

`<version>` is the `version` field from `src/manifest.json`.

| Folder | Zip | Use |
|--------|-----|-----|
| `Pagelate_<version>_Firefox/` | `Pagelate_<version>_Firefox.zip` | AMO upload / listed |
| `Pagelate_<version>_Firefox_selfhosted/` | `Pagelate_<version>_Firefox_selfhosted.zip` | self-distributed XPI (adds a `gecko.update_url`) |
| `Pagelate_<version>_Chromium/` | `Pagelate_<version>_Chromium.zip` | Chrome Web Store upload |
| — | `Pagelate_<version>_Chromium.crx` | only with `build:sign`; for self-hosted Chrome installs |

## Loading an unpacked build

- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  pick `build/Pagelate_<version>_Firefox/manifest.json`.
- **Chrome:** `chrome://extensions` → enable Developer mode → Load unpacked →
  pick the `build/Pagelate_<version>_Chromium` folder.

> Reminder: Chrome must load the **built** folder; editing `src/` has no effect on a
> loaded Chrome build until you rebuild.

## Self-hosted auto-updates (optional)

For installs outside the stores, the self-hosted variants point at update manifests in
this repo:

- Chrome: `chrome_manifest.json` → `update_url` → `dist/chromium/updates.xml`
- Firefox: the `_Firefox_selfhosted` build → `gecko.update_url` → `dist/firefox/updates.json`

When you publish a release, bump the `version` in both `dist/chromium/updates.xml` and
`dist/firefox/updates.json` and point them at the new release assets.

See [PUBLISHING.md](PUBLISHING.md) for store submission.
