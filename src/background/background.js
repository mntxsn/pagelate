"use strict";

// MV3 compatibility: the toolbar button API is `chrome.action`; this code base
// was written against `chrome.browserAction`. Alias it so the existing calls keep
// working under Manifest V3 (where `chrome.browserAction` no longer exists).
// `chrome.pageAction` is left as-is — it is absent under Chrome MV3 and every use
// here is already guarded by `if (chrome.pageAction)`.
if (typeof chrome !== "undefined" && !chrome.browserAction && chrome.action) {
  chrome.browserAction = chrome.action;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMainFramePageLanguageState") {
    chrome.tabs.sendMessage(
      sender.tab.id,
      {
        action: "getCurrentPageLanguageState",
      },
      {
        frameId: 0,
      },
      (pageLanguageState) => {
        checkedLastError();
        sendResponse(pageLanguageState);
      }
    );

    return true;
  } else if (request.action === "getMainFrameTabLanguage") {
    chrome.tabs.sendMessage(
      sender.tab.id,
      {
        action: "getOriginalTabLanguage",
      },
      {
        frameId: 0,
      },
      (tabLanguage) => {
        checkedLastError();
        sendResponse(tabLanguage);
      }
    );

    return true;
  } else if (request.action === "setPageLanguageState") {
    updateContextMenu(request.pageLanguageState);
  } else if (request.action === "openOptionsPage") {
    tabsCreate(chrome.runtime.getURL("/options/options.html"));
  } else if (request.action === "openDonationPage") {
    tabsCreate("https://github.com/sponsors/mntxsn");
  } else if (request.action === "detectTabLanguage") {
    if (!sender.tab) {
      // https://github.com/FilipePS/Traduzir-paginas-web/issues/478
      sendResponse("und");
      return;
    }
    try {
      if (
        (platformInfo.isMobile.any && !platformInfo.isFirefox) ||
        (platformInfo.isDesktop.any && platformInfo.isOpera)
      ) {
        chrome.tabs.sendMessage(
          sender.tab.id,
          { action: "detectLanguageUsingTextContent" },
          { frameId: 0 },
          (result) => sendResponse(result)
        );
      } else {
        chrome.tabs.detectLanguage(sender.tab.id, (result) => {
          checkedLastError();
          sendResponse(result);
        });
      }
    } catch (e) {
      console.error(e);
      sendResponse("und");
    }

    return true;
  } else if (request.action === "getTabHostName") {
    // sender.tab can be undefined when the message originates from a non-tab
    // context (e.g. an extension page); guard against it.
    sendResponse(sender.tab ? new URL(sender.tab.url).hostname : null);
  } else if (request.action === "thisFrameIsInFocus") {
    chrome.tabs.sendMessage(
      sender.tab.id,
      { action: "anotherFrameIsInFocus" },
      checkedLastError
    );
  } else if (request.action === "restorePagesWithServiceNames") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, request, checkedLastError);
      });
    });
  } else if (request.action == "authorizationToOpenOptions") {
    chrome.storage.local.set({
      authorizationToOpenOptions: request.authorizationToOpenOptions,
    });
  }
});

function updateTranslateSelectedContextMenu() {
  if (typeof chrome.contextMenus !== "undefined") {
    chrome.contextMenus.remove("translate-selected-text", checkedLastError);
    if (twpConfig.get("showTranslateSelectedContextMenu") === "yes") {
      chrome.contextMenus.create({
        id: "translate-selected-text",
        title: twpI18n.getMessage("msgTranslateSelectedText"),
        contexts: ["selection"],
      });
    }
  }
}

function updateContextMenu(pageLanguageState = "original") {
  let contextMenuTitle;
  if (pageLanguageState === "translated") {
    contextMenuTitle = twpI18n.getMessage("btnRestore");
  } else {
    const targetLanguage = twpConfig.get("targetLanguage");
    contextMenuTitle = twpI18n.getMessage(
      "msgTranslateFor",
      twpLang.codeToLanguage(targetLanguage)
    );
  }
  if (typeof chrome.contextMenus != "undefined") {
    chrome.contextMenus.remove("translate-web-page", checkedLastError);
    chrome.contextMenus.remove(
      "translate-restore-this-frame",
      checkedLastError
    );

    if (twpConfig.get("enableIframePageTranslation") === "yes") {
      if (twpConfig.get("showTranslatePageContextMenu") == "yes") {
        chrome.contextMenus.create({
          id: "translate-web-page",
          title: contextMenuTitle,
          contexts: ["page", "frame"],
          documentUrlPatterns: [
            "http://*/*",
            "https://*/*",
            "file://*/*",
            "ftp://*/*",
          ],
        });
      }
    } else {
      if (twpConfig.get("showTranslatePageContextMenu") == "yes") {
        chrome.contextMenus.create({
          id: "translate-web-page",
          title: contextMenuTitle,
          contexts: ["page"],
          documentUrlPatterns: [
            "http://*/*",
            "https://*/*",
            "file://*/*",
            "ftp://*/*",
          ],
        });
      }

      chrome.contextMenus.create({
        id: "translate-restore-this-frame",
        title: twpI18n.getMessage("btnTranslateRestoreThisFrame"),
        contexts: ["frame"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason == "install") {
    tabsCreate(chrome.runtime.getURL("/options/options.html"));
    twpConfig.onReady(async () => {
      if (chrome.i18n.getUILanguage() === "zh-CN") {
        twpConfig.set("pageTranslatorService", "bing");
        twpConfig.set("textTranslatorService", "bing");
      }
    });
  } else if (
    details.reason == "update" &&
    chrome.runtime.getManifest().version != details.previousVersion
  ) {
    twpConfig.onReady(async () => {
      if (platformInfo.isMobile.any) {
        if (details.previousVersion.split(".")[0] === "9") {
          twpConfig.set("neverTranslateLangs", []);
          twpConfig.set("neverTranslateSites", []);
          twpConfig.set("alwaysTranslateLangs", []);
          twpConfig.set("alwaysTranslateSites", []);
        }
        return;
      }
    });
    twpConfig.onReady(async () => {
      translationCache.deleteTranslationCache();
    });
    twpConfig.onReady(async () => {
      twpConfig.set(
        "textTranslatorService",
        twpConfig.get("enabledServices")[0]
      );
    });
    twpConfig.onReady(async () => {
      twpConfig.set("proxyServers", {});
    });
  }

  twpConfig.onReady(async () => {
    if (platformInfo.isMobile.any) {
      const enabledServices = twpConfig.get("enabledServices");
      const index = enabledServices.indexOf("deepl");
      if (index !== -1) {
        enabledServices.splice(index, 1);
        twpConfig.set("enabledServices", enabledServices);
      }
    }
  });
});

function resetPageAction(tabId, forceShow = false) {
  if (!chrome.pageAction) return;
  if (twpConfig.get("translateClickingOnce") === "yes" && !forceShow) {
    chrome.pageAction.setPopup({
      popup: "",
      tabId,
    });
  } else {
    chrome.pageAction.setPopup({
      popup: "popup/popup.html",
      tabId,
    });
  }
}

function resetBrowserAction(forceShow = false) {
  if (twpConfig.get("translateClickingOnce") === "yes" && !forceShow) {
    chrome.browserAction.setPopup({
      popup: "",
    });
  } else {
    chrome.browserAction.setPopup({
      popup: "popup/popup.html",
    });
  }
}

function sendToggleTranslationMessage(tabId) {
  if (twpConfig.get("enableIframePageTranslation") === "yes") {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "toggle-translation",
      },
      checkedLastError
    );
  } else {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "toggle-translation",
      },
      { frameId: 0 },
      checkedLastError
    );
  }
}

function sendTranslatePageMessage(tabId, targetLanguage) {
  if (twpConfig.get("enableIframePageTranslation") === "yes") {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "translatePage",
        targetLanguage,
      },
      checkedLastError
    );
  } else {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "translatePage",
        targetLanguage,
      },
      { frameId: 0 },
      checkedLastError
    );
  }
}

if (typeof chrome.contextMenus !== "undefined") {
  const updateActionContextMenu = () => {
    chrome.contextMenus.remove("browserAction-showPopup", checkedLastError);
    chrome.contextMenus.remove("pageAction-showPopup", checkedLastError);
    chrome.contextMenus.remove("never-translate", checkedLastError);
    chrome.contextMenus.remove("more-options", checkedLastError);
    chrome.contextMenus.remove("browserAction-translate-pdf", checkedLastError);
    chrome.contextMenus.remove("pageAction-translate-pdf", checkedLastError);
    // No extension-added items in the toolbar-button (action) context menu.
  };
  updateActionContextMenu();

  const tabHasContentScript = {};
  let currentTabId = null;
  chrome.tabs.onActivated.addListener((activeInfo) => {
    currentTabId = activeInfo.tabId;
    updateActionContextMenu();

    // (merged from a second onActivated listener) refresh the page/selection
    // context menus for the newly activated tab and sync their title with the
    // tab's current translation state.
    twpConfig.onReady(() => {
      updateContextMenu();
      updateTranslateSelectedContextMenu();
    });
    chrome.tabs.sendMessage(
      activeInfo.tabId,
      {
        action: "getCurrentPageLanguageState",
      },
      {
        frameId: 0,
      },
      (pageLanguageState) => {
        checkedLastError();
        if (pageLanguageState) {
          twpConfig.onReady(() => updateContextMenu(pageLanguageState));
        }
      }
    );
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId == "translate-web-page") {
      sendToggleTranslationMessage(tab.id);
    } else if (info.menuItemId == "translate-restore-this-frame") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "toggle-translation",
          },
          { frameId: info.frameId },
          checkedLastError
        );
      });
    } else if (info.menuItemId == "translate-selected-text") {
      if (
        chrome.pageAction &&
        chrome.pageAction.openPopup &&
        (!tab || !tabHasContentScript[tab.id] || tab.isInReaderMode)
      ) {
        chrome.pageAction.setPopup({
          popup:
            "popup/popup-translate-text.html#text=" +
            encodeURIComponent(info.selectionText),
          tabId: tab?.id || currentTabId,
        });
        chrome.pageAction.openPopup();

        resetPageAction(tab?.id || currentTabId);
      } else {
        // a merda do chrome não suporte openPopup
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "TranslateSelectedText",
            selectionText: info.selectionText,
          },
          checkedLastError
        );
      }
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status == "loading") {
      twpConfig.onReady(() => updateContextMenu());
    } else if (changeInfo.status == "complete") {
      chrome.tabs.sendMessage(
        tabId,
        {
          action: "contentScriptIsInjected",
        },
        {
          frameId: 0,
        },
        (response) => {
          checkedLastError();
          tabHasContentScript[tabId] = !!response;
        }
      );
    }
  });

  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    delete tabHasContentScript[tabId];
  });

  chrome.tabs.query({}, (tabs) =>
    tabs.forEach((tab) =>
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "contentScriptIsInjected",
        },
        {
          frameId: 0,
        },
        (response) => {
          checkedLastError();
          if (response) {
            tabHasContentScript[tab.id] = true;
          }
        }
      )
    )
  );
}

twpConfig.onReady(() => {
  if (platformInfo.isMobile.any) {
    chrome.tabs.query({}, (tabs) =>
      tabs.forEach((tab) => {
        if (chrome.pageAction) {
          chrome.pageAction.hide(tab.id);
        }
      })
    );

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status == "loading" && chrome.pageAction) {
        chrome.pageAction.hide(tabId);
      }
    });

    chrome.browserAction.onClicked.addListener((tab) => {
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "showPopupMobile",
        },
        {
          frameId: 0,
        },
        checkedLastError
      );
    });
  } else {
    if (chrome.pageAction) {
      chrome.pageAction.onClicked.addListener((tab) => {
        if (twpConfig.get("translateClickingOnce") === "yes") {
          sendToggleTranslationMessage(tab.id);
        }
      });
    }
    chrome.browserAction.onClicked.addListener((tab) => {
      if (twpConfig.get("translateClickingOnce") === "yes") {
        sendToggleTranslationMessage(tab.id);
      }
    });

    resetBrowserAction();

    twpConfig.onChanged((name, newvalue) => {
      switch (name) {
        case "translateClickingOnce":
          resetBrowserAction();
          chrome.tabs.query(
            {
              currentWindow: true,
              active: true,
            },
            (tabs) => {
              resetPageAction(tabs[0].id);
            }
          );
          break;
      }
    });

    {
      let pageLanguageState = "original";

      function updateIcon(tabId) {
        chrome.tabs.get(tabId, (tabInfo) => {
          if (chrome.pageAction) {
            resetPageAction(tabId);
            // Address-bar icon: monochrome (Firefox themes it via SVG
            // context-fill, dark on light toolbars / light on dark). When the
            // page is translated and the setting is on, switch to the filled
            // colored logo (indigo card + white glyphs) as a "translated" highlight.
            const pageActionIcon =
              pageLanguageState === "translated" &&
              twpConfig.get("popupBlueWhenSiteIsTranslated") === "yes"
                ? "/icons/icon-32.png"
                : "/icons/icon-mono.svg";
            chrome.pageAction.setIcon({
              tabId: tabId,
              path: pageActionIcon,
            });

            if (twpConfig.get("showButtonInTheAddressBar") == "no") {
              chrome.pageAction.hide(tabId);
            } else {
              chrome.pageAction.show(tabId);
            }
          }

          if (chrome.browserAction) {
            if (
              pageLanguageState === "translated" &&
              twpConfig.get("popupBlueWhenSiteIsTranslated") === "yes"
            ) {
              chrome.browserAction.setIcon({
                tabId: tabId,
                path: "/icons/icon-32-translated.png",
              });
            } else {
              chrome.browserAction.setIcon({
                tabId: tabId,
                path: "/icons/icon-32.png",
              });
            }
          }
        });
      }

      function updateIconInAllTabs() {
        chrome.tabs.query({}, (tabs) =>
          tabs.forEach((tab) => updateIcon(tab.id))
        );
      }

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status == "loading") {
          pageLanguageState = "original";
          updateIcon(tabId);
        } else if (changeInfo.status == "complete") {
          chrome.tabs.sendMessage(
            tabId,
            {
              action: "getCurrentPageLanguageState",
            },
            {
              frameId: 0,
            },
            (_pageLanguageState) => {
              checkedLastError();
              if (_pageLanguageState) {
                pageLanguageState = _pageLanguageState;
                updateIcon(tabId);
              }
            }
          );
        }
      });

      chrome.tabs.onActivated.addListener((activeInfo) => {
        pageLanguageState = "original";
        updateIcon(activeInfo.tabId);
        chrome.tabs.sendMessage(
          activeInfo.tabId,
          {
            action: "getCurrentPageLanguageState",
          },
          {
            frameId: 0,
          },
          (_pageLanguageState) => {
            checkedLastError();
            if (_pageLanguageState) {
              pageLanguageState = _pageLanguageState;
              updateIcon(activeInfo.tabId);
            }
          }
        );
      });

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "setPageLanguageState") {
          pageLanguageState = request.pageLanguageState;
          updateIcon(sender.tab.id);
        }
      });

      twpConfig.onChanged((name, newvalue) => {
        switch (name) {
          case "showButtonInTheAddressBar":
          case "popupBlueWhenSiteIsTranslated":
            updateIconInAllTabs();
            break;
        }
      });
    }
  }
});

if (typeof chrome.commands !== "undefined") {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "hotkey-toggle-translation") {
      chrome.tabs.query(
        {
          currentWindow: true,
          active: true,
        },
        (tabs) => sendToggleTranslationMessage(tabs[0].id)
      );
    } else if (command === "hotkey-translate-selected-text") {
      chrome.tabs.query(
        {
          currentWindow: true,
          active: true,
        },
        (tabs) =>
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "TranslateSelectedText",
            },
            checkedLastError
          )
      );
    } else if (command === "hotkey-swap-page-translation-service") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) =>
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "swapTranslationService",
              newServiceName: twpConfig.swapPageTranslationService(),
            },
            checkedLastError
          )
      );
    } else if (command === "hotkey-show-original") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) =>
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "translatePage",
              targetLanguage: "original",
            },
            checkedLastError
          )
      );
    } else if (command === "hotkey-translate-page-1") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          twpConfig.setTargetLanguage(twpConfig.get("targetLanguages")[0]);
          sendTranslatePageMessage(
            tabs[0].id,
            twpConfig.get("targetLanguages")[0]
          );
        }
      );
    } else if (command === "hotkey-translate-page-2") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          twpConfig.setTargetLanguage(twpConfig.get("targetLanguages")[1]);
          sendTranslatePageMessage(
            tabs[0].id,
            twpConfig.get("targetLanguages")[1]
          );
        }
      );
    } else if (command === "hotkey-translate-page-3") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          twpConfig.setTargetLanguage(twpConfig.get("targetLanguages")[2]);
          sendTranslatePageMessage(
            tabs[0].id,
            twpConfig.get("targetLanguages")[2]
          );
        }
      );
    } else if (command === "hotkey-hot-translate-selected-text") {
      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "hotTranslateSelectedText",
            },
            checkedLastError
          );
        }
      );
    }
  });
}

twpConfig.onReady(async () => {
  updateContextMenu();
  updateTranslateSelectedContextMenu();

  twpConfig.onChanged((name, newvalue) => {
    if (name === "showTranslateSelectedContextMenu") {
      updateTranslateSelectedContextMenu();
    }
  });

  if (!twpConfig.get("installDateTime")) {
    twpConfig.set("installDateTime", Date.now());
  }
});

twpConfig.onReady(async () => {
  let navigationsInfo = {};
  let tabsInfo = {};

  function tabsOnRemoved(tabId) {
    delete navigationsInfo[tabId];
    delete tabsInfo[tabId];
  }

  function runtimeOnMessage(request, sender, sendResponse) {
    if (request.action === "setPageLanguageState") {
      tabsInfo[sender.tab.id] = {
        pageLanguageState: request.pageLanguageState,
        host: new URL(sender.tab.url).host,
      };
    }
  }

  //TODO ver porque no Firefox o evento OnCommitted executa antes de OnCreatedNavigationTarget e OnBeforeNavigate quando [target="_blank"]

  function webNavigationOnCreatedNavigationTarget(details) {
    const navInfo = navigationsInfo[details.tabId] || {};
    navInfo.sourceTabId = details.sourceTabId;
    navigationsInfo[details.tabId] = navInfo;
  }

  function webNavigationOnBeforeNavigate(details) {
    if (details.frameId !== 0) return;

    const navInfo = navigationsInfo[details.tabId] || {
      sourceTabId: details.tabId,
    };
    navInfo.beforeNavigateIsExecuted = true;
    if (tabsInfo[navInfo.sourceTabId]) {
      navInfo.sourceHost = tabsInfo[navInfo.sourceTabId].host;
      navInfo.sourcePageLanguageState =
        tabsInfo[navInfo.sourceTabId].pageLanguageState;
    }
    navigationsInfo[details.tabId] = navInfo;

    if (navInfo.promise_resolve) {
      navInfo.promise_resolve();
    }
  }

  async function webNavigationOnCommitted(details) {
    if (details.frameId !== 0) return;

    const navInfo = navigationsInfo[details.tabId] || {
      sourceTabId: details.tabId,
    };
    navInfo.transitionType = details.transitionType;
    navigationsInfo[details.tabId] = navInfo;

    if (!navInfo.beforeNavigateIsExecuted) {
      await new Promise((resolve) => (navInfo.promise_resolve = resolve));
    }
  }

  function webNavigationOnDOMContentLoaded(details) {
    if (details.frameId !== 0) return;

    const navInfo = navigationsInfo[details.tabId];

    if (navInfo && navInfo.sourceHost) {
      const host = new URL(details.url).host;
      if (
        navInfo.transitionType === "link" &&
        navInfo.sourcePageLanguageState === "translated" &&
        navInfo.sourceHost === host
      ) {
        setTimeout(
          () =>
            chrome.tabs.sendMessage(
              details.tabId,
              {
                action: "autoTranslateBecauseClickedALink",
              },
              {
                frameId: 0,
              },
              checkedLastError
            ),
          500
        );
      }
    }

    delete navigationsInfo[details.tabId];
  }

  function enableTranslationOnClickingALink() {
    disableTranslationOnClickingALink();
    if (!chrome.webNavigation) return;

    chrome.tabs.onRemoved.addListener(tabsOnRemoved);
    chrome.runtime.onMessage.addListener(runtimeOnMessage);

    chrome.webNavigation.onCreatedNavigationTarget.addListener(
      webNavigationOnCreatedNavigationTarget
    );
    chrome.webNavigation.onBeforeNavigate.addListener(
      webNavigationOnBeforeNavigate
    );
    chrome.webNavigation.onCommitted.addListener(webNavigationOnCommitted);
    chrome.webNavigation.onDOMContentLoaded.addListener(
      webNavigationOnDOMContentLoaded
    );
  }

  function disableTranslationOnClickingALink() {
    navigationsInfo = {};
    tabsInfo = {};
    chrome.tabs.onRemoved.removeListener(tabsOnRemoved);
    chrome.runtime.onMessage.removeListener(runtimeOnMessage);

    if (chrome.webNavigation) {
      chrome.webNavigation.onCreatedNavigationTarget.removeListener(
        webNavigationOnCreatedNavigationTarget
      );
      chrome.webNavigation.onBeforeNavigate.removeListener(
        webNavigationOnBeforeNavigate
      );
      chrome.webNavigation.onCommitted.removeListener(webNavigationOnCommitted);
      chrome.webNavigation.onDOMContentLoaded.removeListener(
        webNavigationOnDOMContentLoaded
      );
    } else {
      console.info("No webNavigation permission");
    }
  }

  twpConfig.onChanged((name, newvalue) => {
    if (name === "autoTranslateWhenClickingALink") {
      if (newvalue == "yes") {
        enableTranslationOnClickingALink();
      } else {
        disableTranslationOnClickingALink();
      }
    }
  });

  if (chrome.permissions.onRemoved) {
    chrome.permissions.onRemoved.addListener((permissions) => {
      if (permissions.permissions.indexOf("webNavigation") !== -1) {
        twpConfig.set("autoTranslateWhenClickingALink", "no");
      }
    });
  }

  chrome.permissions.contains(
    {
      permissions: ["webNavigation"],
    },
    (hasPermissions) => {
      if (
        hasPermissions &&
        twpConfig.get("autoTranslateWhenClickingALink") === "yes"
      ) {
        enableTranslationOnClickingALink();
      } else {
        twpConfig.set("autoTranslateWhenClickingALink", "no");
      }
    }
  );
});

// garante que a extensão só seja atualizada quando reiniciar o navegador.
// caso seja uma atualização manual, realiza uma limpeza e recarrega a extensão para instalar a atualização.
chrome.runtime.onUpdateAvailable.addListener((details) => {
  var reloaded = false;

  setTimeout(function () {
    if (!reloaded) {
      reloaded = true;
      chrome.runtime.reload();
    }
  }, 2200);

  chrome.tabs.query({}, (tabs) => {
    const cleanUpsPromises = [];
    tabs.forEach((tab) => {
      cleanUpsPromises.push(
        new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: "cleanUp" }, resolve);
        })
      );
    });
    Promise.all(cleanUpsPromises).finally(() => {
      if (!reloaded) {
        reloaded = true;
        chrome.runtime.reload();
      }
    });
  });

  // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //   const url = new URL(tabs[0].url);
  //   if (
  //     (url.hostname === "github.com" &&
  //       url.pathname.includes("FilipePS/Traduzir-paginas-web/releases")) ||
  //     (url.hostname === "addons.mozilla.org" &&
  //       url.pathname.includes("addon/traduzir-paginas-web/versions"))
  //   ) {
  //     chrome.tabs.query({}, (tabs) => {
  //       const cleanUpsPromises = [];
  //       tabs.forEach((tab) => {
  //         cleanUpsPromises.push(
  //           new Promise((resolve) => {
  //             chrome.tabs.sendMessage(tab.id, { action: "cleanUp" }, resolve);
  //           })
  //         );
  //       });
  //       Promise.all(cleanUpsPromises).finally(() => {
  //         chrome.runtime.reload();
  //       });
  //     });
  //   }
  // });
});
