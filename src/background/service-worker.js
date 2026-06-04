"use strict";

/**
 * Chrome MV3 service-worker entry point. Loads the background scripts in the same
 * order the MV2 background page did. Firefox uses `background.scripts` in its
 * manifest instead of this file.
 *
 * Note: textToSpeech.js is intentionally NOT imported here — it depends on DOM
 * APIs (Audio/AudioContext/DOMParser) that a service worker lacks, so it runs in
 * the offscreen document (offscreen/offscreen.html) instead.
 */
importScripts(
  "/lib/checkedLastError.js",
  "/lib/stuff.js",
  "/lib/languages.js",
  "/lib/config.js",
  "/lib/platformInfo.js",
  "/lib/i18n.js",
  "/background/translationCache.js",
  "/background/translationService.js",
  "/background/offscreenManager.js",
  "/background/background.js"
);
