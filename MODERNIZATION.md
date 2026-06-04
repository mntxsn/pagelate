# Modernization, Bugs & Performance

Findings and action list for TWP (Translate Web Pages). Created 2026-06-03.

Legend: ✅ done · 📋 recommended (concrete proposal included, intentionally not yet
applied because it needs runtime testing or a product decision) · 🚧 in progress.

---

## ✅ 1. Fixed `tabToMimeType` memory leak

`tabToMimeType` (`src/background/background.js`) is populated per tab in
`webRequest.onHeadersReceived` but was never cleaned up in `chrome.tabs.onRemoved`.
Because the background page is **persistent**, the object grew for the whole browser
session.

**Fix:** also `delete tabToMimeType[tabId]` in `onRemoved`. Also `var tabToMimeType`
→ `const`.

---

## ✅ 2. Merged duplicate `onActivated` listeners

There were **3×** `chrome.tabs.onActivated` and **3×** `chrome.tabs.onUpdated`. Two
of the `onActivated` listeners lived in the same scope (the `contextMenus` block) and
ran one after another on every tab switch.

**Fix:** merged the two same-scope `onActivated` listeners into one (side-effect order
preserved). Now 2 instead of 3 `onActivated` registrations.

### Remaining (📋 still open, on purpose)
The third `onActivated` listener lives in the theme closure (icon update) and sends
the same `getCurrentPageLanguageState` message to frame 0 as the context-menu block —
a duplicate round-trip per tab switch. Clean dedup requires sharing state across both
closures (or a small message bus) and will be restructured during the MV3 migration
anyway, so it was left untouched here.

---

## 📋 3. Performance hotspot in `filterKeywordsInText`

`src/contentScript/pageTranslator.js`: inside `while (true)`, `textContext.toLowerCase()`
is recomputed over the **entire** text every iteration (one full string allocation per
keyword, even when the keyword does not occur).

**Why not applied yet:** there is a delicate ordering — `index` is computed from
`textContext.toLowerCase()` (line ~48), and **then** `textContext` is reassigned via
`removeExtraDelimiter(...)` (line ~52). `index` may already be shifted relative to the
new string. An optimization must preserve this exact behavior. Without a test harness
for the custom-dictionary feature the risk of a subtle bug is too high.

**Proposal (after tests exist):** cache the lowercased variant and recompute only after
`textContext` actually mutates, e.g.:

```js
for (const keyWord of sortedCustomDictionary.keys()) {
  let lowerText = textContext.toLowerCase();
  let index;
  while ((index = lowerText.indexOf(keyWord)) !== -1) {
    // ... unchanged logic, BUT keep the removeExtraDelimiter ordering ...
    textContext = frontPart + placeholderText + backPart;
    lowerText = textContext.toLowerCase(); // only after a mutation
  }
  textContext = textContext.replaceAll("#n%o#", "");
}
```

Prerequisite: unit tests that pin the current behavior (including the
`removeExtraDelimiter` quirk).

---

## 📋 4. Hardcoded Google TKK

`src/background/translationService.js`, `GoogleHelper.googleTranslateTKK = "448487.932609646"`.
Magic values for unofficial endpoints are brittle and a common cause of translations
suddenly breaking.

**Recommendation:** document the value centrally (comment with origin/date) and, over
time, make the `GoogleHelper_v2` path (auth fetch) the primary route with TKK only as a
fallback. Pure config/doc change, no behavior change required.

---

## 📋 5. Build target too old / polyfills removable

- `package.json` `browserslist`: `firefox 63`, `chrome 70` (2018-era browsers).
- `manifest.json` `strict_min_version: 64.0`.
- `polyfill.js` pulls in core-js for `Promise`, `replaceAll`, `structuredClone`,
  `Object.fromEntries`, `Array.includes`, etc.

Raising the minimum to e.g. **Firefox 115 ESR / Chrome 110** makes all of these natively
available → `polyfill.js`, `core-js` and `gulp-babel` can be dropped entirely. Result:
smaller bundle, faster build, less maintenance.

**Why not applied yet:** this is a **product decision** (which browsers are still
supported?) and needs a build/smoke test on the target browsers before the polyfills are
removed. Proposed steps:

1. `browserslist` → `["firefox 115", "chrome 110"]`.
2. raise `strict_min_version` / `minimum_chrome_version` in both manifests.
3. remove `polyfill.js` entries from `manifest.json` `content_scripts` and
   `background.scripts`, drop the `polyfill` npm script + the `core-js` dependency.
4. remove `gulp-babel` from `gulpfile.js` (just copy the files).
5. test on the target minimum browsers.

> Note: the MV3 migration (below) makes its own manifest changes; coordinate #5 with it.

---

## 📋 6. Brittle Firefox Alpenglow detection

`src/background/background.js`, `isFirefoxAlpenglow()`: detects the theme via
`JSON.stringify` comparison against pasted giant strings (`theme.properties` /
`theme.colors`). Breaks on the smallest theme change by Mozilla.

**Recommendation:** heuristic over individual color properties instead of exact JSON
comparison.
**Why not applied yet:** the visual behavior (icon tint) can only be verified manually in
Firefox with the Alpenglow theme active.

---

## 📋 7. Legacy idioms (`var`, `.replace` chains)

`var tabToMimeType` is already converted to `const` (see #1). Other spots (e.g. `var`
declarations in `standardize_color`/`hexToRgb`, manual `.replace` chains in
`escapeHTML`/`unescapeHTML`) are purely cosmetic.

**Why only partial:** a blanket `var`→`const/let` sweep across all files produces a lot of
diff noise without behavioral gain and makes reviews harder. Better done incrementally when
touching each file.

---

## 📋 8. `old-popup` legacy

`src/popup/old-popup.{html,css,js}` plus numerous `useOldPopup` branches in
`background.js` (`resetBrowserAction`/`resetPageAction`, etc.).

**Why NOT deleted:** `useOldPopup` is a **user-enabled option**. Removing it would be a
feature removal, not pure cleanup — that needs a deliberate product decision. Once it is
decided that the old popup can go: delete the files, remove the option from
`config.js`/options UI, and collapse all `useOldPopup` branches in `background.js` onto the
new popup path.

---

## Strategic: Manifest V3 — implemented (testing pending)

The full MV2 → MV3 migration (Chrome service worker + Firefox event page) has been
implemented across phases P1–P6; see `MV3-MIGRATION.md` for details and the remaining
runtime-testing checklist. Summary below kept for context.

Largest piece — migration done in code (Chrome + Firefox together). MV2 with a
**persistent** background page is being phased out on Chrome (MV2 is being disabled);
Firefox is pushing toward MV3.

Service-worker blockers and how they're handled:
- `matchMedia("(prefers-color-scheme: dark)")` (background.js) — not available in a
  service worker. → must be detected differently (offscreen document / content-script
  signal / `chrome.runtime.getContexts`).
- `OffscreenCanvas` (`standardize_color`) — usable in a service worker, but setup differs.
- Large in-memory state (`tabToMimeType`, `tabHasContentScript`, `pageLanguageState`,
  `navigationsInfo`) — the SW is terminated/restarted → move to `chrome.storage.session`.
- `webRequest` here is **non-blocking** (only reads `responseHeaders` for the mimetype),
  so it still works under MV3; no `declarativeNetRequest` needed. State must move to
  `storage.session` though.

Planned approach: single `manifest_version: 3` with a `background` key that carries both
`service_worker` (Chrome) and `scripts` (Firefox event page); Chrome ignores `scripts`,
Firefox prefers it. See `MV3-MIGRATION.md` for the detailed plan and progress.
