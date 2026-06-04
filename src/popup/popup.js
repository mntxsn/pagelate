"use strict";

var $ = document.querySelector.bind(document);

twpConfig
  .onReady()
  .then(() => twpI18n.updateUiMessages())
  .then(() => {
    twpI18n.translateDocument();
    const popupSectionCount = 6;

    $("#btnImproveTranslation").onclick = () => {
      window.location = "improve-translation.html";
    };

    let popupPanelSection = twpConfig.get("popupPanelSection");

    function updatePopupSection() {
      document.querySelectorAll("[data-popupPanelSection]").forEach((node) => {
        const nodePopupPanelSection = parseInt(
          node.getAttribute("data-popupPanelSection")
        );
        if (isNaN(nodePopupPanelSection)) return;

        if (nodePopupPanelSection > popupPanelSection) {
          node.style.display = "none";
        } else {
          node.style.display = "block";
        }
      });

      document.querySelectorAll("[data-popupPanelSection2]").forEach((node) => {
        const nodePopupPanelSection2 = parseInt(
          node.getAttribute("data-popupPanelSection2")
        );
        if (isNaN(nodePopupPanelSection2)) return;

        if (nodePopupPanelSection2 <= popupPanelSection) {
          node.style.display = "none";
        } else {
          node.style.display = "block";
        }
      });

      $("#more").style.display = "block";
      $("#less").style.display = "block";

      if (popupPanelSection >= popupSectionCount) {
        $("#more").style.display = "none";
      } else if (popupPanelSection <= 0) {
        $("#less").style.display = "none";
      }
    }
    updatePopupSection();

    $("#more").onclick = (e) => {
      if (popupPanelSection < popupSectionCount) {
        popupPanelSection++;
        updatePopupSection();
      }
      twpConfig.set("popupPanelSection", popupPanelSection);
    };
    $("#less").onclick = (e) => {
      if (popupPanelSection > 0) {
        popupPanelSection--;
        updatePopupSection();
      }
      twpConfig.set("popupPanelSection", popupPanelSection);
    };

    let originalTabLanguage = "und";
    let currentPageLanguage = "und";
    let currentPageLanguageState = "original";
    let currentPageTranslatorService = twpConfig.get("pageTranslatorService");

    function translateOrRestorePagePage(newTargetLanguage) {
      const _translateOrRestorePagePage = (newTargetLanguage) => {
        currentPageLanguage = newTargetLanguage;
        if (currentPageLanguage === "original") {
          currentPageLanguageState = "original";
        } else {
          currentPageLanguageState = "translated";
          twpConfig.setTargetLanguage(newTargetLanguage);
        }

        chrome.tabs.query(
          {
            active: true,
            currentWindow: true,
          },
          (tabs) => {
            if (twpConfig.get("enableIframePageTranslation") === "yes") {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: "translatePage",
                  targetLanguage: newTargetLanguage || "original",
                },
                checkedLastError
              );
            } else {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: "translatePage",
                  targetLanguage: newTargetLanguage || "original",
                },
                { frameId: 0 },
                checkedLastError
              );
            }
          }
        );

        updateInterface();
      };

      if (newTargetLanguage) {
        _translateOrRestorePagePage(newTargetLanguage);
      } else {
        chrome.tabs.query(
          {
            active: true,
            currentWindow: true,
          },
          (tabs) => {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                action: "currentTargetLanguage",
              },
              {
                frameId: 0,
              },
              (pageLanguage) => {
                checkedLastError();
                if (pageLanguage) {
                  _translateOrRestorePagePage(pageLanguage);
                }
              }
            );
          }
        );
      }
    }

    const twpButtons = document.querySelectorAll("button");

    twpButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        const newTargetLanguage = event.target.value;
        translateOrRestorePagePage(newTargetLanguage);
      });
    });

    let targetLanguages = twpConfig.get("targetLanguages");
    for (let i = 1; i < 4; i++) {
      const button = twpButtons[i];
      button.value = targetLanguages[i - 1];
      button.textContent = twpLang.codeToLanguage(targetLanguages[i - 1]);
    }

    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "getOriginalTabLanguage",
          },
          {
            frameId: 0,
          },
          (tabLanguage) => {
            checkedLastError();
            if (
              !tabLanguage ||
              (tabLanguage = twpLang.fixTLanguageCode(tabLanguage))
            ) {
              originalTabLanguage = tabLanguage || "und";
              twpButtons[0].childNodes[1].textContent =
                twpLang.codeToLanguage(originalTabLanguage);
            }
          }
        );

        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "getCurrentPageLanguage",
          },
          {
            frameId: 0,
          },
          (pageLanguage) => {
            checkedLastError();
            if (pageLanguage) {
              currentPageLanguage = pageLanguage;
              updateInterface();
            }
          }
        );

        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "getCurrentPageLanguageState",
          },
          {
            frameId: 0,
          },
          (pageLanguageState) => {
            checkedLastError();
            if (pageLanguageState) {
              currentPageLanguageState = pageLanguageState;
              updateInterface();
            }
          }
        );

        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "getCurrentPageTranslatorService",
          },
          {
            frameId: 0,
          },
          (pageTranslatorService) => {
            checkedLastError();
            if (pageTranslatorService) {
              currentPageTranslatorService = pageTranslatorService;
              updateInterface();
            }
          }
        );
      }
    );

    function updateInterface() {
      if (currentPageTranslatorService == "bing") {
        $("#iconTranslate").setAttribute("src", "/icons/bing-translate-32.png");
      } else {
        // google
        $("#iconTranslate").setAttribute(
          "src",
          "/icons/google-translate-32.png"
        );
      }

      twpButtons.forEach((button) => {
        button.classList.remove("w3-buttonSelected");
        if (
          (currentPageLanguageState !== "translated" &&
            button.value === "original") ||
          (currentPageLanguageState === "translated" &&
            button.value === currentPageLanguage)
        ) {
          button.classList.add("w3-buttonSelected");
        }
      });

      if (originalTabLanguage !== "und") {
        $("#cbAlwaysTranslateThisLang").checked =
          twpConfig.get("alwaysTranslateLangs").indexOf(originalTabLanguage) !==
          -1;
        $("#lblAlwaysTranslateThisLang").textContent = twpI18n.getMessage(
          "lblAlwaysTranslate",
          twpLang.codeToLanguage(originalTabLanguage)
        );
        $("#cbAlwaysTranslateThisLang").removeAttribute("disabled");

        const translatedWhenHoveringThisLangText = twpI18n.getMessage(
          "lblShowTranslatedWhenHoveringThisLang",
          twpLang.codeToLanguage(originalTabLanguage)
        );
        $("#cbShowTranslatedWhenHoveringThisLang").checked =
          twpConfig
            .get("langsToTranslateWhenHovering")
            .indexOf(originalTabLanguage) !== -1;
        $("#lblShowTranslatedWhenHoveringThisLang").textContent =
          translatedWhenHoveringThisLangText;
        $("#cbShowTranslatedWhenHoveringThisLang").removeAttribute("disabled");
      }
    }
    updateInterface();

    // Theme (light/dark) is driven by twp-theme.css via the data-theme attribute;
    // see twp-theme.js. "auto" follows the OS (prefers-color-scheme).
    {
      const mode = twpConfig.get("darkMode"); // "auto" | "yes" | "no"
      twpApplyTheme(mode === "yes" ? "dark" : mode === "no" ? "light" : "auto");
    }

    $("#btnPatreon").onclick = (e) => {
      window.open("https://github.com/sponsors/mntxsn", "_blank");
    };

    $("#divIconTranslate").addEventListener("click", () => {
      currentPageTranslatorService = twpConfig.swapPageTranslationService();

      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "swapTranslationService",
              newServiceName: currentPageTranslatorService,
            },
            checkedLastError
          );
        }
      );

      updateInterface();
    });

    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        $("#cbAlwaysTranslateThisLang").addEventListener("change", (e) => {
          const hostname = new URL(tabs[0].url).hostname;
          if (e.target.checked) {
            twpConfig.addLangToAlwaysTranslate(originalTabLanguage, hostname);
            translateOrRestorePagePage();
          } else {
            twpConfig.removeLangFromAlwaysTranslate(originalTabLanguage);
          }
        });

        $("#cbAlwaysTranslateThisSite").addEventListener("change", (e) => {
          const hostname = new URL(tabs[0].url).hostname;
          if (e.target.checked) {
            twpConfig.addSiteToAlwaysTranslate(hostname);
            translateOrRestorePagePage();
          } else {
            twpConfig.removeSiteFromAlwaysTranslate(hostname);
          }
        });

        $("#cbShowTranslateSelectedButton").addEventListener("change", (e) => {
          if (e.target.checked) {
            twpConfig.set("showTranslateSelectedButton", "yes");
          } else {
            twpConfig.set("showTranslateSelectedButton", "no");
          }
        });

        $("#cbShowOriginalWhenHovering").addEventListener("change", (e) => {
          if (e.target.checked) {
            twpConfig.set("showOriginalTextWhenHovering", "yes");
          } else {
            twpConfig.set("showOriginalTextWhenHovering", "no");
          }
        });

        $("#cbShowTranslatedWhenHoveringThisSite").addEventListener(
          "change",
          (e) => {
            const hostname = new URL(tabs[0].url).hostname;
            if (e.target.checked) {
              twpConfig.addSiteToTranslateWhenHovering(hostname);
            } else {
              twpConfig.removeSiteFromTranslateWhenHovering(hostname);
            }
          }
        );

        $("#cbShowTranslatedWhenHoveringThisLang").addEventListener(
          "change",
          (e) => {
            if (e.target.checked) {
              twpConfig.addLangToTranslateWhenHovering(originalTabLanguage);
            } else {
              twpConfig.removeLangFromTranslateWhenHovering(
                originalTabLanguage
              );
            }
          }
        );

        $("#cbShowTranslateSelectedButton").checked =
          twpConfig.get("showTranslateSelectedButton") == "yes" ? true : false;
        $("#cbShowOriginalWhenHovering").checked =
          twpConfig.get("showOriginalTextWhenHovering") == "yes" ? true : false;

        const hostname = new URL(tabs[0].url).hostname;
        $("#cbAlwaysTranslateThisSite").checked =
          twpConfig.get("alwaysTranslateSites").indexOf(hostname) !== -1;
        $("#cbShowTranslatedWhenHoveringThisSite").checked =
          twpConfig.get("sitesToTranslateWhenHovering").indexOf(hostname) !==
          -1;
      }
    );

    // The three-dots button opens the full options page and closes the popup.
    // Firefox's toolbar (browserAction) popup ignores window.close() and does
    // not dismiss on a same-window tab switch; it only closes on focus loss.
    // So we open the options tab via the background and explicitly drop the
    // popup's focus with window.blur(), then call window.close() as a fallback
    // for the page-action popup.
    $("#btnMenu").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openOptionsPage" });
      window.blur();
      window.close();
    });
  });
