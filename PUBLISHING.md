# Publishing Pagelate

How to release Pagelate to the **Chrome Web Store** and **Firefox Add-ons (AMO)**.
Build details are in [build-instructions.md](build-instructions.md).

---

## 0. Before every release

1. **Bump the version** in all of:
   - `src/manifest.json` (Firefox)
   - `src/chrome_manifest.json` (Chrome)
   - `package.json`
   - (only if you self-host updates) `dist/chromium/updates.xml` and
     `dist/firefox/updates.json` → new version + release-asset URLs.

   Stores **reject** a version that is not strictly higher than the published one, and
   reject re-uploading an already-used version. Use a simple increasing scheme
   (e.g. `1.0.0` → `1.0.1` → `1.1.0`).

2. **Build:** `npm run build`.

3. **Smoke-test the built zips** in both browsers (load unpacked) — translate a page,
   translate a selection, open options, import/export settings.

4. Update [CHANGELOG.md](CHANGELOG.md).

### Artifacts produced

| Store | File to upload |
|-------|----------------|
| Chrome Web Store | `build/Pagelate_<version>_Chromium.zip` |
| Firefox AMO (listed) | `build/Pagelate_<version>_Firefox.zip` |
| Firefox self-distributed | `build/Pagelate_<version>_Firefox_selfhosted.zip` |

---

## 1. Shared listing assets

Prepare these once and reuse for both stores:

- **Name:** Pagelate – Translate Web Pages
- **Summary** (short, ≤132 chars) and **detailed description** (English; localized
  versions optional).
- **Icon:** 128×128 — already shipped (`src/icons/icon-128.png`).
- **Screenshots:** at least 1–2. Chrome wants **1280×800** or 640×400; AMO accepts
  PNG/JPG screenshots of any reasonable size. Show: full-page translation, the
  selected-text popup, the options page.
- **Privacy policy URL:** host the contents of [`PRIVACY`](PRIVACY) somewhere public
  (e.g. a GitHub Pages page or a repo file URL). Both stores ask for it.
- **Category / language**, support URL (the repo issues page), homepage
  (`https://github.com/mntxsn/pagelate`).

### Permission justifications (both stores ask)

| Permission | Why |
|------------|-----|
| `<all_urls>` (host) | Translate page content on any site the user visits. |
| `storage` | Save the user's settings locally. |
| `activeTab` / `contextMenus` | Trigger translation from the toolbar button and the right-click menu. |
| `offscreen` (Chrome) | Play text-to-speech audio and read the OS color scheme — APIs unavailable in a service worker. |
| `webNavigation` (optional) | Detect in-page navigations to keep auto-translate working; requested only if the user opts in. |

**Data collection:** the extension collects no analytics/PII. Page text is sent only
to the translation service the user selects (Google, Bing, or — if the user configures
them — DeepL/LibreTranslate). Declare "No data collected" on Chrome and the matching
"no data collection" disclosure on AMO.

---

## 2. Chrome Web Store

**One-time setup**

- A Google account + the **Chrome Web Store Developer Dashboard**
  (<https://chrome.google.com/webstore/devconsole>).
- Pay the **one-time US$5** developer registration fee.

**Submit**

1. Dashboard → **Add new item** → upload `Pagelate_<version>_Chromium.zip`.
2. Fill in the store listing (assets above), privacy practices, and permission
   justifications.
3. Submit for review. First review can take from hours to a few days.

**Updates:** upload a new zip with a higher `version` to the same item.

**Edge (optional):** the same Chromium zip works on the Microsoft Edge Add-ons store
(<https://partner.microsoft.com/dashboard/microsoftedge>) — separate, free account.

---

## 3. Firefox Add-ons (AMO)

**One-time setup**

- A Firefox account + **addons.mozilla.org Developer Hub**
  (<https://addons.mozilla.org/developers/>). Free.
- The add-on ID is already fixed in `src/manifest.json`
  (`browser_specific_settings.gecko.id = {59b67141-…}`) — keep it stable across releases.

**Listed (recommended): on AMO**

1. Developer Hub → **Submit a New Add-on** → "On this site".
2. Upload `Pagelate_<version>_Firefox.zip`.
3. The validator runs (`strict_min_version: 115.0` is honored). Fix any errors.
4. **Source code:** Pagelate's build does no minification/bundling, so the uploaded zip
   *is* the source. If AMO asks for source anyway, link the repo and
   `build-instructions.md`.
5. **Data collection consent:** answer the data-collection questions — declare that no
   data is collected by the add-on.
6. Submit for review.

**Self-distributed (signed XPI, not on AMO)**

- Use `Pagelate_<version>_Firefox_selfhosted.zip` (it carries a `gecko.update_url` →
  `dist/firefox/updates.json` for auto-updates).
- Get it signed via the Developer Hub → "On your own site", or with
  [`web-ext sign`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
  using AMO API credentials. Firefox only installs signed XPIs.

**Recommended tool:** [`web-ext`](https://github.com/mozilla/web-ext) for linting and
signing:

```bash
npx web-ext lint  --source-dir build/Pagelate_<version>_Firefox
npx web-ext sign  --source-dir build/Pagelate_<version>_Firefox_selfhosted \
                  --api-key <JWT_issuer> --api-secret <JWT_secret>
```

---

## 4. Post-release

- Tag the release in git and attach the zips (and `.crx` if self-hosting Chrome).
- If self-hosting, confirm `dist/chromium/updates.xml` and `dist/firefox/updates.json`
  point at the new assets so existing installs auto-update.
- Add the live store URLs to [readme.md](readme.md) (the `coming soon` placeholders).
