# Changelog

## 1.0.0

First Pagelate release. Highlights on top of the fork baseline below:

- **Removed Yandex** entirely (dead, unfixable free endpoint): service, language
  table, UI buttons, manifest icon, and locale strings.
- **DeepL reworked**: dropped the fragile website-scraping (which opened a deepl.com
  tab); DeepL now uses the official **DeepL Free API** with the user's key and shows
  the result directly in the popup. The DeepL pill appears only when a key is set.
- **Modernized the "translate selected text" popup**: labeled service pills (Google /
  Bing / DeepL), accent colour for the active service, theme-aware (dark/light) icons
  and expand arrow.
- **LibreTranslate / DeepL options**: added setup hints and links (public LibreTranslate
  mirrors; DeepL Free API key).
- **Bug fixes**: popup three-dots now closes the popup (Firefox toolbar popup);
  settings import on Chrome (`browser.commands.update` guard); in-page shortcut editor
  on modern Chrome; Chrome offscreen document config access (no more `twpConfig is not
  defined` / `chrome.storage` errors).
- Documented browser minimums (Firefox 115, Chrome 116) and added store-publishing
  docs ([PUBLISHING.md](PUBLISHING.md)).

## Pagelate fork

Pagelate is a fork of [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web).
Changes relative to the upstream `master` it was forked from:

### Platform
- Migrated the whole extension to **Manifest V3**.
  - Chrome: background **service worker** (`background/service-worker.js`) + an
    **offscreen document** for text-to-speech audio and color-scheme detection.
  - Firefox: background **event page** (keeps DOM APIs).
  - `XMLHttpRequest` → `fetch` in the translation service; `DOMParser` made
    service-worker-safe (feature-detected fallback).
  - `webRequest` kept (non-blocking); `<all_urls>` moved to `host_permissions`;
    `browser_action` → `action` (with a `chrome.browserAction` compat shim).

### UI / UX
- New shared theme (`src/css/twp-theme.css` + `twp-theme.js`): design tokens,
  real light/dark following the OS with a manual toggle.
- Options page redesigned: **top-tab layout**, settings grouped into **cards**,
  consistent **setting rows**, **toggle switches** for booleans, **settings search**,
  empty-state hints, accessibility (focus styles, `aria-current`).
- Popup redesigned: toolbar header, language grid, card layout, dark-mode aware.
- Bing service icon background made transparent (works in dark mode).

### Cleanup / behavior
- Removed the legacy "old popup" and its setting.
- Removed "Show release notes when updating" and the release-notes page.
- Removed two experimental toggles (mobile-popup-on-desktop, page padding).
- Popup three-dots menu now opens the options page directly.
- **Yandex removed** (its free endpoint is blocked server-side and unfixable from an
  extension). See 1.0.0 above.
- All donation entry points now go to **GitHub Sponsors**
  (https://github.com/sponsors/mntxsn).

### Branding
- Renamed to **Pagelate**, new extension ID, repository and update URLs.
