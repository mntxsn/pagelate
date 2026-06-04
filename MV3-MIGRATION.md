# Manifest V3 Migration Plan (Chrome + Firefox)

Status: all phases implemented (P1–P6) and building; runtime testing pending. Started
2026-06-03. See "Testing status" at the bottom for what still needs hands-on verification.

Goal: migrate TWP from Manifest V2 (persistent background page) to Manifest V3 for
**both** Chrome (service worker) and Firefox (event page), without losing functionality.

## Strategy

The migration is done **incrementally while still on MV2**, so every change stays
testable and the extension keeps working after each phase. The manifest is flipped to
MV3 **last**, only after every service-worker incompatibility is removed.

Reason: flipping the manifest first would break everything at once with no way to
isolate regressions.

## Build context

- Firefox build uses `src/manifest.json`.
- Chrome build uses `src/chrome_manifest.json` (renamed to `manifest.json` during the
  gulp build — see `gulpfile.js` `chrome-rename`).
- Both manifests must be migrated and kept in sync.

## Service-worker incompatibilities (the blockers)

| # | API | File | Replacement |
|---|-----|------|-------------|
| A | `XMLHttpRequest` | `translationService.js` (auth, sid, bing-auth, `makeRequest`) | `fetch` |
| B | `XMLHttpRequest` | `textToSpeech.js` | `fetch` |
| C | `DOMParser` | `translationService.js` (`cbTransformResponse`) | SW-safe HTML parsing |
| D | `DOMParser` | `textToSpeech.js` | SW-safe parsing |
| E | `AudioContext` / `window` / `new Audio()` | `textToSpeech.js` | Offscreen document (Chrome) / keep page audio (Firefox) |
| F | `matchMedia("(prefers-color-scheme: dark)")` | `background.js` | Offscreen document or content-script signal |
| G | In-memory state (`tabToMimeType`, `tabHasContentScript`, `pageLanguageState`, `navigationsInfo`, `currentTabId`) | `background.js` | `chrome.storage.session` |
| H | Multiple background scripts loaded via array | manifest | `importScripts()` in a SW loader (Chrome) / `scripts` array (Firefox) |

Note: `webRequest` here is **non-blocking** (only reads `responseHeaders` for the
mimetype). Non-blocking `webRequest` still works under MV3, so no
`declarativeNetRequest` rewrite is required — only the state (G) must move to
`storage.session`.

`OffscreenCanvas` (used by `standardize_color` in `background.js`) **is** available in
a service worker, so it needs no change.

## Phases

### Phase 1 — `XMLHttpRequest` → `fetch` (blocker A) ✅
MV2-compatible, self-contained, no manifest change. Preserves exact behavior:
method, headers, body, response type, and **cookie behavior**. The original XHR did
**not** set `withCredentials`, so it sent no cross-origin cookies — the fetch default
(`credentials: "same-origin"`) matches this, so **no** `credentials` option is set.
(An earlier attempt used `credentials: "include"`, which broke Yandex because it sent
cookies the original code never sent; Google/Bing tolerated them. Reverted.)

- [x] `translationService.js`: `GoogleHelper_v2.findAuth` GET → fetch/text
- [x] `translationService.js`: `YandexHelper.findSID` GET → fetch/text
- [x] `translationService.js`: `BingHelper.findAuth` GET → fetch/text
- [x] `translationService.js`: `Service.makeRequest` → fetch (method/headers/body, `response.json()`)
- [x] `textToSpeech.js`: `BingHelper.findAuth` GET → fetch/text (SW-appropriate, stays in worker)

**Deferred to Phase 3 (on purpose):** `textToSpeech.js` `Speech.makeRequest` was **not**
converted. It fetches an audio **blob** and pipes it through `FileReader` into
`new Audio(...)`. `FileReader` and `Audio` are *also* SW-incompatible, so this whole
audio sub-pipeline moves into the offscreen document in Phase 3 — where XHR/FileReader/
Audio all work natively. Converting only its XHR now would be throwaway work.

Subtle behavior note: XHR `onload` always resolved (even on HTTP 4xx/5xx, with a possibly
`null` JSON body); `fetch` does not reject on HTTP error status either, but
`response.json()` will reject on a non-JSON error body, whereas XHR `responseType:"json"`
would have yielded `null`. Callers treat both as failure, so this is acceptable — flag it
during testing.

**Test after Phase 1:** translate a page with Google, Bing and Yandex; confirm all still
work in the current (MV2) Firefox + Chrome builds. (TTS is unchanged in this phase.)

### Phase 2 — `DOMParser` removal (blocker C) ✅
The Bing `cbTransformResponse` parsed the response with `DOMParser`
(structure + HTML-entity decoding) over a simple `<bN>...</bN>` tag shape.

Done:
- Added `Utils.parseHtmlFragmentNodes` (+ `Utils.decodeEntities`): a DOM-free parser
  that returns the top-level nodes (`{ isText, nodeName, textContent }`) in document
  order, mirroring `DOMParser(...).body.childNodes` for this tag shape, with entity
  decoding and inner-tag stripping (like DOM `textContent`).
- `cbTransformResponse` now feature-detects: it uses `DOMParser` when available
  (Firefox background **event page** has a DOM → zero behavior change there) and the
  DOM-free fallback only when `DOMParser` is undefined (Chrome MV3 service worker).
  The node-walk logic is single-sourced for both paths.
- Validated the fallback with a Node self-test (12 cases: reordering, text between
  tags, nesting, `&amp;`/`&lt;`/`&#39;`/numeric/hex entities, empty elements,
  `dontSortResults`). All pass.

Limitation: `decodeEntities` covers the entities `escapeHTML` produces plus common
named + numeric references — not the full HTML entity set. Acceptable because Firefox
keeps full `DOMParser`; the subset only applies in Chrome's SW. Revisit if Chrome
testing surfaces an uncovered entity.

**Test after Phase 2:** Bing page translation in Firefox (uses the DOMParser path —
should be byte-for-byte unchanged). The fallback path gets exercised once a Chrome MV3
service-worker build exists (Phase 6).

### Phase 2b — `textToSpeech.js` `DOMParser` (blocker D) → deferred to Phase 3
The remaining `DOMParser` in `textToSpeech.js` belongs to the audio pipeline that moves
into the offscreen document in Phase 3, so it is handled there.

### Phase 3 — Text-to-speech audio + `DOMParser` (blockers E, D) ✅
`AudioContext` / `new Audio()` / `DOMParser` / `FileReader` / `XMLSerializer` all need a
document. Approach: **run the whole `textToSpeech.js` where a DOM exists**, instead of
porting each API.
- **Chrome (service worker):** added an **offscreen document**
  (`offscreen/offscreen.html` + `offscreen/offscreen.js`) that loads `textToSpeech.js`
  (+ its deps). It keeps its own `chrome.runtime.onMessage` listener, so TTS messages
  from the popup/content scripts are handled there with full DOM. `background/
  offscreenManager.js` (loaded only in the SW) creates the offscreen document eagerly
  and on each `textToSpeech` request. `textToSpeech.js` is **not** imported by the SW
  loader.
- **Firefox (background event page) / MV2:** the background context has a DOM, so
  `textToSpeech.js` runs there as before — no offscreen, no change. Guarded
  `"AudioContext" in window` → `typeof AudioContext !== "undefined"` so the module also
  loads cleanly in a DOM-less context.
- The `textToSpeech.js` `DOMParser` (blocker D) needs no change: it only ever runs in a
  DOM context (offscreen / event page / MV2).

### Phase 4 — Dark-mode detection (blocker F) ✅
`background.js` now feature-detects `matchMedia`:
- present (MV2 / Firefox event page) → used directly as before;
- absent (Chrome SW) → the offscreen document (`offscreen/offscreen.js`) watches
  `(prefers-color-scheme: dark)` and pushes `offscreenColorScheme` messages (plus
  answers `getColorScheme` on demand); `background.js` updates its `darkMode` from them
  and re-tints the icon.

### Phase 5 — Background state (blocker G) — pragmatic ✅
Decision: **kept in memory, not moved to `chrome.storage.session`.** Rationale: every
piece of state (`tabToMimeType`, `tabHasContentScript`, `pageLanguageState`,
`currentTabId`, `navigationsInfo`/`tabsInfo`) is rebuilt by the existing tab/navigation
event handlers, so a cold service-worker start just yields empty objects that self-heal
on the next event — no crashes, only a brief, self-correcting loss of cosmetic/per-tab
state (icon tint, PDF detection, selected-text routing). A full `storage.session`
rewrite would make every currently-synchronous access async across `background.js` — a
large, high-regression change for marginal benefit. Left as optional future hardening.

### Phase 6 — Manifest flip (blocker H) ✅
- `background/service-worker.js` `importScripts(...)` the lib + background scripts in the
  original order (excluding `textToSpeech.js`, which lives in the offscreen document; and
  adding `offscreenManager.js`).
- `manifest.json` (Firefox) and `chrome_manifest.json` (Chrome) both → `manifest_version: 3`:
  - **Firefox:** `background.scripts` (event page) with the full list incl.
    `textToSpeech.js`; keeps both `action` and `page_action` (Firefox MV3 still supports
    pageAction). `strict_min_version` 115.
  - **Chrome:** `background.service_worker: "background/service-worker.js"`; `action`
    only (Chrome MV3 has no pageAction — code already guards `if (chrome.pageAction)`);
    `offscreen` permission; `minimum_chrome_version` 116.
  - `browser_action` → `action`. `background.js` aliases `chrome.browserAction =
    chrome.action` at startup so existing `chrome.browserAction.*` calls keep working.
  - `<all_urls>` moved to `host_permissions`.
  - `web_accessible_resources` → MV3 object form (`resources` + `matches`).
  - `optional_permissions` (`webNavigation`) unchanged.
- `gulpfile.js` needed no change: it copies `src/**/**` (picks up `offscreen/`) and
  babels `background/*.js` (picks up `service-worker.js` / `offscreenManager.js`).

## ⚠️ Testing status

- **Built OK:** both `gulp firefox-build` and `gulp` (Firefox + Chrome) produce valid
  MV3 manifests (verified: mv=3, correct `background`, `action`/`page_action`,
  `host_permissions`, MV3 `web_accessible_resources`).
- **Not yet runtime-tested.** `web-ext lint` could not run here (crashes under Node 25).
  The following MUST be verified by loading the builds:
  - **Firefox (testable now):** load `build/TWP_<ver>_Firefox/manifest.json` as a
    temporary add-on. Check: page translation (Google/Bing), selected-text translation,
    TTS, context menus, hotkeys, icon/theming, options page, auto-translate-on-link.
    Firefox keeps DOM in the event page, so behavior should match MV2 closely. Watch for:
    `page_action` acceptance under MV3, event-page unload resetting per-tab state.
  - **Chrome (needs a Chrome install):** load `build/TWP_<ver>_Chromium`. Highest-risk
    paths: the offscreen TTS (creation race on first request), the DOM-free Bing
    response parser (`Utils.parseHtmlFragmentNodes`), `action.openPopup` availability,
    and SW cold-start state loss.

## Coordination with MODERNIZATION.md #5

The build-target bump (drop core-js/gulp-babel) should land together with or right
after the manifest flip, since both touch the manifests and `background.scripts`.
