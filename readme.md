# <img src="src/icons/icon-128.png" height="50"> Pagelate — Translate Web Pages

Translate whole web pages and selected text in real time using Google or Bing.
For Firefox and Chromium-based browsers.

[![Get it for Firefox](https://img.shields.io/badge/Firefox-Add--ons-FF7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/firefox/addon/pagelate-translate-web-pages/)
[![Get it for Chrome](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/laoiicghdpoomdjjolbkagjiggjccafm)

> Pagelate is a fork of [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web)
> by Filipe Ps, continued independently with a modernized UI and a Manifest V3 codebase.

## Install

- **Firefox Add-ons (AMO):** [Pagelate – Translate Web Pages](https://addons.mozilla.org/firefox/addon/pagelate-translate-web-pages/)
- **Chrome Web Store:** [Pagelate – Translate Web Pages](https://chromewebstore.google.com/detail/laoiicghdpoomdjjolbkagjiggjccafm)

Or load an unpacked build — see [Build](#build).

## Features

- Full-page translation (Google / Bing)
- Translate selected text, with text-to-speech
- DeepL for selected text via the official DeepL Free API (optional, needs a free key)
- LibreTranslate for selected text via your own / a public server (optional, privacy-friendly)
- Per-site and per-language rules (always / never translate)
- Custom dictionary (skip chosen words)
- Light / dark theme that follows your OS (with manual override)
- Keyboard shortcuts

## Browser support

| Browser | Minimum version | Background |
|---------|-----------------|------------|
| Firefox | **115** (`strict_min_version`) | event page |
| Chrome / Chromium (Edge, Brave, …) | **116** (`minimum_chrome_version`) | service worker + offscreen document |

Chrome 116 is required for the offscreen document (text-to-speech audio and
OS color-scheme detection, which a service worker cannot do itself).

## What's different from upstream

- Migrated to **Manifest V3** (Chrome service worker + Firefox event page; DOM-only
  work runs in an offscreen document on Chrome).
- **Redesigned options page and popup**: top-tab layout, design tokens, real dark mode,
  toggle switches, settings search.
- **Modernized "translate selected text" popup**: labeled service pills, accent colour
  for the active service, theme-aware icons.
- **Removed Yandex** (its free endpoint is blocked server-side and unfixable from an
  extension).
- **DeepL** no longer scrapes the DeepL website in a pop-up tab; it uses the official
  **DeepL Free API** with your key, and shows the result directly in the popup.
- Donations go to [GitHub Sponsors](https://github.com/sponsors/mntxsn).

See [CHANGELOG.md](CHANGELOG.md) for the full list of changes.

## Build

Requires Node.js and npm.

```bash
npm install
npm run build           # builds Firefox + Chromium into ./build
```

Output (where `<version>` is the `version` from `src/manifest.json`):

- `build/Pagelate_<version>_Firefox/` + `…_Firefox.zip` — AMO / listed
- `build/Pagelate_<version>_Firefox_selfhosted/` + `…_Firefox_selfhosted.zip` — self-hosted (has an `update_url`)
- `build/Pagelate_<version>_Chromium/` + `…_Chromium.zip` — Chrome Web Store

Load the unpacked build during development:

- **Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on →
  `build/Pagelate_<version>_Firefox/manifest.json`
- **Chrome:** `chrome://extensions` → Developer mode → Load unpacked →
  `build/Pagelate_<version>_Chromium`

Tip: for fast iteration in Firefox you can load `src/manifest.json` directly (a plain
reload then picks up source edits, no rebuild needed).

See [build-instructions.md](build-instructions.md) for details, and
[PUBLISHING.md](PUBLISHING.md) for how to upload to the stores.

## Privacy

The extension itself collects no data. To translate, the page contents or selected
text are sent to the translation service you choose:

- **Google** / **Bing** — sent to Google / Microsoft.
- **DeepL** — sent to DeepL via the official API (only if you configure a key).
- **LibreTranslate** — sent to the server you configure (can be your own).

## Donations

If you find Pagelate useful, consider sponsoring development:
[github.com/sponsors/mntxsn](https://github.com/sponsors/mntxsn)

## License

[Mozilla Public License 2.0](LICENSE).
