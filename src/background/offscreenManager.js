"use strict";

/**
 * Manages the Chrome MV3 offscreen document that hosts DOM-dependent features
 * (text-to-speech audio + DOM parsing) which a service worker cannot
 * perform itself. No-op where `chrome.offscreen` is unavailable (Firefox event
 * page / MV2 persistent background page), which keep doing this work in-process.
 */
(function () {
  if (typeof chrome === "undefined" || !chrome.offscreen) return;

  let creating = null;

  async function ensureOffscreenDocument() {
    try {
      const has = chrome.offscreen.hasDocument
        ? await chrome.offscreen.hasDocument()
        : false;
      if (has) return;
      if (creating) {
        await creating;
        return;
      }
      creating = chrome.offscreen
        .createDocument({
          url: chrome.runtime.getURL("offscreen/offscreen.html"),
          reasons: ["AUDIO_PLAYBACK", "DOM_PARSER"],
          justification:
            "Play text-to-speech audio and parse translation markup; these DOM APIs are unavailable in a service worker.",
        })
        .catch((e) => console.error(e))
        .finally(() => {
          creating = null;
        });
      await creating;
    } catch (e) {
      console.error(e);
    }
  }

  // Create eagerly so the offscreen document is alive to receive TTS messages
  // (its own listener handles them). Also (best effort) ensure it exists when a
  // TTS request arrives, in case the worker had been suspended.
  ensureOffscreenDocument();

  chrome.runtime.onMessage.addListener((request) => {
    if (request && request.action === "textToSpeech") {
      ensureOffscreenDocument();
    }
  });

  // Config proxy for the offscreen document, which has no chrome.storage of its
  // own (offscreen documents only get chrome.runtime). It asks the worker for
  // the resolved config on startup and writes through it.
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request) return;
    if (request.action === "twpGetConfig") {
      twpConfig.onReady(() => sendResponse(twpConfig.export()));
      return true; // keep the message channel open for the async response
    } else if (request.action === "twpConfigSet" && request.changes) {
      // Persist on the offscreen document's behalf; the storage.onChanged
      // relay below propagates it back to every context.
      chrome.storage.local.set(request.changes);
    }
  });

  // Relay storage changes to the offscreen document, which can't observe
  // chrome.storage directly. Storage-capable contexts ignore this message.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    chrome.runtime
      .sendMessage({ action: "twpConfigChanged", changes })
      .catch(() => {});
  });

  // Exposed for potential explicit use elsewhere in the worker.
  self.twpEnsureOffscreenDocument = ensureOffscreenDocument;
})();
