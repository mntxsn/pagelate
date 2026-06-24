"use strict";

var $ = document.querySelector.bind(document);

/**
 * Visually turns the boolean Yes/No <select>s inside ".setting-control" into
 * toggle switches, without changing options.js's read/write logic: the native
 * <select> stays in the DOM (hidden) and remains the source of truth. The switch
 * mirrors it and dispatches a "change" event on the select so existing handlers
 * fire. Only affects selects with exactly the two options "yes"/"no" and without
 * a data-no-switch attribute (so multi-value selects like darkMode are skipped).
 */
function enhanceYesNoSelects() {
  document.querySelectorAll(".setting-control > select").forEach((select) => {
    if (select.dataset.noSwitch !== undefined || select.dataset.switchified)
      return;
    const values = Array.from(select.options).map((o) => o.value);
    if (values.length !== 2 || !values.includes("yes") || !values.includes("no"))
      return;
    select.dataset.switchified = "1";
    select.style.display = "none";

    const sw = document.createElement("input");
    sw.type = "checkbox";
    sw.className = "switch";
    sw.checked = select.value === "yes";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(sw.checked));
    const titleEl = select
      .closest(".setting-row")
      ?.querySelector(".setting-title");
    if (titleEl) sw.setAttribute("aria-label", titleEl.textContent.trim());

    sw.addEventListener("change", () => {
      select.value = sw.checked ? "yes" : "no";
      sw.setAttribute("aria-checked", String(sw.checked));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // keep the switch in sync if the select is changed programmatically
    select.addEventListener("change", () => {
      const on = select.value === "yes";
      if (sw.checked !== on) {
        sw.checked = on;
        sw.setAttribute("aria-checked", String(on));
      }
    });

    select.insertAdjacentElement("afterend", sw);
  });
}

twpConfig
  .onReady()
  .then(() => {
    // https://github.com/FilipePS/Traduzir-paginas-web/issues/774
    if (sessionStorage !== null) {
      return twpI18n.updateUiMessages(
        sessionStorage.getItem("temporaryUiLanguage")
      );
    } else {
      return twpI18n.updateUiMessages();
    }
  })
  .then(() => {
    twpI18n.translateDocument();
    document.querySelector("[data-i18n='msgDefaultLanguage']").textContent =
      twpI18n.getMessage("msgDefaultLanguage") + " - Default language";

    let temporaryUiLanguage = null;
    if (sessionStorage !== null) {
      temporaryUiLanguage = sessionStorage.getItem("temporaryUiLanguage");
      sessionStorage.removeItem("temporaryUiLanguage");
    }

    if (platformInfo.isMobile.any) {
      let style = document.createElement("style");
      style.textContent = ".desktopOnly {display: none !important}";
      document.head.appendChild(style);
    }

    if (!chrome.pageAction) {
      let style = document.createElement("style");
      style.textContent = ".firefox-only {display: none !important}";
      document.head.appendChild(style);
    }

    let sideBarIsVisible = false;
    // The legacy sidebar/hamburger was replaced by the top tab bar; keep this
    // guarded in case the elements are absent.
    if ($("#btnOpenMenu")) {
      $("#btnOpenMenu").onclick = (e) => {
        $("#menuContainer").classList.toggle("change");

        if (sideBarIsVisible) {
          $("#sideBar").style.display = "none";
          sideBarIsVisible = false;
        } else {
          $("#sideBar").style.display = "block";
          sideBarIsVisible = true;
        }
      };
    }

    function hashchange() {
      const hash = location.hash || "#languages";
      const divs = [
        $("#languages"),
        $("#sites"),
        $("#translations"),
        $("#style"),
        $("#hotkeys"),
        $("#privacy"),
        $("#storage"),
        $("#experimental"),
        $("#donation"),
      ];
      divs.forEach((element) => {
        element.style.display = "none";
      });

      document.querySelectorAll("nav a").forEach((a) => {
        a.classList.remove("active");
        a.removeAttribute("aria-current");
      });

      $(hash).style.display = "block";
      const activeTab = $('a[href="' + hash + '"]');
      if (activeTab) {
        activeTab.classList.add("active");
        activeTab.setAttribute("aria-current", "page");
      }

      let text;
      if (hash === "#donation") {
        text = twpI18n.getMessage("lblMakeDonation");
      } else {
        text = twpI18n.getMessage("lblSettings");
      }
      $("#itemSelectedName").textContent = text;

      if (sideBarIsVisible && $("#sideBar")) {
        $("#menuContainer").classList.toggle("change");
        $("#sideBar").style.display = "none";
        sideBarIsVisible = false;
      }

      $("#btnPatreon").style.display = "block";

      if (hash === "#translations") {
        $("#translations").insertBefore(
          $("#selectServiceContainer"),
          $("#translations").firstChild
        );
      } else if (hash === "#privacy") {
        $("#privacy").insertBefore(
          $("#selectServiceContainer"),
          $("#privacy").firstChild
        );
      }
    }
    hashchange();
    window.addEventListener("hashchange", hashchange);

    // Tab clicks: avoid the browser's anchor-jump (which scrolls down,
    // especially when clicking the already-active tab). Route manually and
    // always keep the view scrolled to the top.
    document.querySelectorAll('#tabbar a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const targetHash = a.getAttribute("href");
        if (!targetHash) return;
        if (location.hash !== targetHash) {
          location.hash = targetHash; // triggers hashchange()
        } else {
          hashchange();
        }
        window.scrollTo({ top: 0 });
      });
    });

    function fillLanguageList(select) {
      let langs = twpLang.getLanguageList();

      const langsSorted = [];

      for (const i in langs) {
        langsSorted.push([i, langs[i]]);
      }

      langsSorted.sort(function (a, b) {
        return a[1].localeCompare(b[1]);
      });

      langsSorted.forEach((value) => {
        const option = document.createElement("option");
        option.value = value[0];
        option.textContent = value[1];
        select.appendChild(option);
      });
    }

    fillLanguageList($("#selectTargetLanguage"));
    fillLanguageList($("#selectTargetLanguageForText"));

    fillLanguageList($("#favoriteLanguage1"));
    fillLanguageList($("#favoriteLanguage2"));
    fillLanguageList($("#favoriteLanguage3"));

    fillLanguageList($("#addToNeverTranslateLangs"));
    fillLanguageList($("#addToAlwaysTranslateLangs"));
    fillLanguageList($("#addLangToTranslateWhenHovering"));

    function updateDarkMode() {
      const mode = twpConfig.get("darkMode"); // "auto" | "yes" | "no"
      // "auto" follows the OS via CSS (prefers-color-scheme); "yes"/"no" force it.
      twpApplyTheme(mode === "yes" ? "dark" : mode === "no" ? "light" : "auto");
      // Persist so twp-theme.js can restore a forced theme early (no flash).
      try {
        if (mode === "yes") sessionStorage.setItem("twpTheme", "dark");
        else if (mode === "no") sessionStorage.setItem("twpTheme", "light");
        else sessionStorage.removeItem("twpTheme");
      } catch (e) {}

      const toggle = $("#themeToggle");
      if (toggle) {
        toggle.textContent = mode === "yes" ? "🌙" : mode === "no" ? "☀" : "◐";
        toggle.title = twpI18n.getMessage("lblDarkMode") + " — " + mode;
      }
    }
    updateDarkMode();

    // Top-bar quick toggle cycles auto -> dark -> light -> auto and keeps the
    // Style-tab <select id="darkMode"> in sync.
    if ($("#themeToggle")) {
      $("#themeToggle").onclick = () => {
        const order = ["auto", "yes", "no"];
        const current = twpConfig.get("darkMode") || "auto";
        const next = order[(order.indexOf(current) + 1) % order.length];
        twpConfig.set("darkMode", next);
        if ($("#darkMode")) $("#darkMode").value = next;
        updateDarkMode();
      };
    }

    // target languages
    $("#selectUiLanguage").value =
      temporaryUiLanguage || twpConfig.get("uiLanguage");
    $("#selectUiLanguage").onchange = (e) => {
      if (e.target.value === "default") {
        twpConfig.set("uiLanguage", "default");
      } else {
        if (sessionStorage !== null) {
          sessionStorage.setItem("temporaryUiLanguage", e.target.value);
        } else {
          return;
        }
      }
      location.reload();
    };
    $("#btnApplyUiLanguage").onclick = () => {
      if (temporaryUiLanguage) {
        twpConfig.set(
          "uiLanguage",
          temporaryUiLanguage === "default"
            ? "default"
            : twpLang.fixUILanguageCode(temporaryUiLanguage)
        );
        // timeout prevents: TypeError: NetworkError when attempting to fetch resource.
        setTimeout(() => location.reload(), 100);
      } else if (sessionStorage === null) {
        const lang = $("#selectUiLanguage").value;
        twpConfig.set(
          "uiLanguage",
          lang === "default" ? "default" : twpLang.fixUILanguageCode(lang)
        );
        // timeout prevents: TypeError: NetworkError when attempting to fetch resource.
        setTimeout(() => location.reload(), 100);
      }
    };

    const targetLanguage = twpConfig.get("targetLanguage");
    $("#selectTargetLanguage").value = targetLanguage;
    $("#selectTargetLanguage").onchange = (e) => {
      twpConfig.setTargetLanguage(e.target.value);
      location.reload();
    };

    const targetLanguageTextTranslation = twpConfig.get(
      "targetLanguageTextTranslation"
    );
    $("#selectTargetLanguageForText").value = targetLanguageTextTranslation;
    $("#selectTargetLanguageForText").onchange = (e) => {
      twpConfig.setTargetLanguage(e.target.value, true);
      twpConfig.setTargetLanguage(targetLanguage, false);
      location.reload();
    };

    const targetLanguages = twpConfig.get("targetLanguages");

    $("#favoriteLanguage1").value = targetLanguages[0];
    $("#favoriteLanguage2").value = targetLanguages[1];
    $("#favoriteLanguage3").value = targetLanguages[2];

    $("#favoriteLanguage1").onchange = (e) => {
      targetLanguages[0] = e.target.value;
      twpConfig.set("targetLanguages", targetLanguages);
      if (targetLanguages.indexOf(twpConfig.get("targetLanguage")) == -1) {
        twpConfig.set("targetLanguage", targetLanguages[0]);
      }
      if (
        targetLanguages.indexOf(
          twpConfig.get("targetLanguageTextTranslation")
        ) == -1
      ) {
        twpConfig.set("targetLanguageTextTranslation", targetLanguages[0]);
      }
      location.reload();
    };

    $("#favoriteLanguage2").onchange = (e) => {
      targetLanguages[1] = e.target.value;
      twpConfig.set("targetLanguages", targetLanguages);
      if (targetLanguages.indexOf(twpConfig.get("targetLanguage")) == -1) {
        twpConfig.set("targetLanguage", targetLanguages[0]);
      }
      if (
        targetLanguages.indexOf(
          twpConfig.get("targetLanguageTextTranslation")
        ) == -1
      ) {
        twpConfig.set("targetLanguageTextTranslation", targetLanguages[0]);
      }
      location.reload();
    };

    $("#favoriteLanguage3").onchange = (e) => {
      targetLanguages[2] = e.target.value;
      twpConfig.set("targetLanguages", targetLanguages);
      if (targetLanguages.indexOf(twpConfig.get("targetLanguage")) == -1) {
        twpConfig.set("targetLanguage", targetLanguages[0]);
      }
      if (
        targetLanguages.indexOf(
          twpConfig.get("targetLanguageTextTranslation")
        ) == -1
      ) {
        twpConfig.set("targetLanguageTextTranslation", targetLanguages[0]);
      }
      location.reload();
    };

    // Never translate these languages

    function createNodeToNeverTranslateLangsList(langCode, langName) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = langCode;
      li.textContent = langName;

      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();

        twpConfig.removeLangFromNeverTranslate(langCode);
        li.remove();
      };

      li.appendChild(close);

      return li;
    }

    const neverTranslateLangs = twpConfig.get("neverTranslateLangs");
    neverTranslateLangs.sort((a, b) => a.localeCompare(b));
    neverTranslateLangs.forEach((langCode) => {
      const langName = twpLang.codeToLanguage(langCode);
      const li = createNodeToNeverTranslateLangsList(langCode, langName);
      $("#neverTranslateLangs").appendChild(li);
    });

    $("#addToNeverTranslateLangs").onchange = (e) => {
      const langCode = e.target.value;
      const langName = twpLang.codeToLanguage(langCode);
      const li = createNodeToNeverTranslateLangsList(langCode, langName);
      $("#neverTranslateLangs").appendChild(li);

      twpConfig.addLangToNeverTranslate(langCode);
    };

    // Always translate these languages

    function createNodeToAlwaysTranslateLangsList(langCode, langName) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = langCode;
      li.textContent = langName;

      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();

        twpConfig.removeLangFromAlwaysTranslate(langCode);
        li.remove();
      };

      li.appendChild(close);

      return li;
    }

    const alwaysTranslateLangs = twpConfig.get("alwaysTranslateLangs");
    alwaysTranslateLangs.sort((a, b) => a.localeCompare(b));
    alwaysTranslateLangs.forEach((langCode) => {
      const langName = twpLang.codeToLanguage(langCode);
      const li = createNodeToAlwaysTranslateLangsList(langCode, langName);
      $("#alwaysTranslateLangs").appendChild(li);
    });

    $("#addToAlwaysTranslateLangs").onchange = (e) => {
      const langCode = e.target.value;
      const langName = twpLang.codeToLanguage(langCode);
      const li = createNodeToAlwaysTranslateLangsList(langCode, langName);
      $("#alwaysTranslateLangs").appendChild(li);

      twpConfig.addLangToAlwaysTranslate(langCode);
    };

    // langsToTranslateWhenHovering

    function createNodeToLangsToTranslateWhenHoveringList(langCode, langName) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = langCode;
      li.textContent = langName;

      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();

        twpConfig.removeLangFromTranslateWhenHovering(langCode);
        li.remove();
      };

      li.appendChild(close);

      return li;
    }

    const langsToTranslateWhenHovering = twpConfig.get(
      "langsToTranslateWhenHovering"
    );
    langsToTranslateWhenHovering.sort((a, b) => a.localeCompare(b));
    langsToTranslateWhenHovering.forEach((langCode) => {
      const langName = twpLang.codeToLanguage(langCode);
      const li = createNodeToLangsToTranslateWhenHoveringList(
        langCode,
        langName
      );
      $("#langsToTranslateWhenHovering").appendChild(li);
    });

    $("#addLangToTranslateWhenHovering").onchange = (e) => {
      const langCode = e.target.value;
      const langName = twpLang.codeToLanguage(langCode);
      const li = createNodeToLangsToTranslateWhenHoveringList(
        langCode,
        langName
      );
      $("#langsToTranslateWhenHovering").appendChild(li);

      twpConfig.addLangToTranslateWhenHovering(langCode);
    };

    // Always translate these Sites

    function createNodeToAlwaysTranslateSitesList(hostname) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = hostname;
      li.textContent = hostname;

      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();

        twpConfig.removeSiteFromAlwaysTranslate(hostname);
        li.remove();
      };

      li.appendChild(close);

      return li;
    }

    const alwaysTranslateSites = twpConfig.get("alwaysTranslateSites");
    alwaysTranslateSites.sort((a, b) => a.localeCompare(b));
    alwaysTranslateSites.forEach((hostname) => {
      const li = createNodeToAlwaysTranslateSitesList(hostname);
      $("#alwaysTranslateSites").appendChild(li);
    });

    $("#addToAlwaysTranslateSites").onclick = (e) => {
      const hostname = prompt("Enter the site hostname", "www.site.com");
      if (!hostname) return;

      const li = createNodeToAlwaysTranslateSitesList(hostname);
      $("#alwaysTranslateSites").appendChild(li);

      twpConfig.addSiteToAlwaysTranslate(hostname);
    };

    // Never translate these Sites

    function createNodeToNeverTranslateSitesList(hostname) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = hostname;
      li.textContent = hostname;

      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();

        twpConfig.removeSiteFromNeverTranslate(hostname);
        li.remove();
      };

      li.appendChild(close);

      return li;
    }

    const neverTranslateSites = twpConfig.get("neverTranslateSites");
    neverTranslateSites.sort((a, b) => a.localeCompare(b));
    neverTranslateSites.forEach((hostname) => {
      const li = createNodeToNeverTranslateSitesList(hostname);
      $("#neverTranslateSites").appendChild(li);
    });

    $("#addToNeverTranslateSites").onclick = (e) => {
      const hostname = prompt("Enter the site hostname", "www.site.com");
      if (!hostname) return;

      const li = createNodeToNeverTranslateSitesList(hostname);
      $("#neverTranslateSites").appendChild(li);

      twpConfig.addSiteToNeverTranslate(hostname);
    };

    function createcustomDictionary(keyWord, customValue) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = keyWord;
      if (customValue !== "") {
        li.textContent = keyWord + " ------------------- " + customValue;
      } else {
        li.textContent = keyWord;
      }
      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();
        twpConfig.removeKeyWordFromcustomDictionary(keyWord);
        li.remove();
      };
      li.appendChild(close);
      return li;
    }

    let customDictionary = twpConfig.get("customDictionary");
    customDictionary = new Map(
      [...customDictionary.entries()].sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]))
      )
    );
    customDictionary.forEach(function (customValue, keyWord) {
      const li = createcustomDictionary(keyWord, customValue);
      $("#customDictionary").appendChild(li);
    });

    $("#addToCustomDictionary").onclick = (e) => {
      let keyWord = prompt("Enter the keyWord, Minimum two letters ", "");
      if (!keyWord || keyWord.length < 2) return;
      keyWord = keyWord.trim().toLowerCase();
      let customValue = prompt(
        "(Optional)\nYou can enter a value to replace it , or fill in nothing.",
        ""
      );
      if (!customValue) customValue = "";
      customValue = customValue.trim();
      const li = createcustomDictionary(keyWord, customValue);
      $("#customDictionary").appendChild(li);
      twpConfig.addKeyWordTocustomDictionary(keyWord, customValue);
    };

    // sitesToTranslateWhenHovering

    function createNodeToSitesToTranslateWhenHoveringList(hostname) {
      const li = document.createElement("li");
      li.setAttribute("class", "w3-display-container");
      li.value = hostname;
      li.textContent = hostname;

      const close = document.createElement("span");
      close.setAttribute("class", "list-remove w3-display-right");
      close.innerHTML = "&times;";

      close.onclick = (e) => {
        e.preventDefault();

        twpConfig.removeSiteFromTranslateWhenHovering(hostname);
        li.remove();
      };

      li.appendChild(close);

      return li;
    }

    const sitesToTranslateWhenHovering = twpConfig.get(
      "sitesToTranslateWhenHovering"
    );
    sitesToTranslateWhenHovering.sort((a, b) => a.localeCompare(b));
    sitesToTranslateWhenHovering.forEach((hostname) => {
      const li = createNodeToSitesToTranslateWhenHoveringList(hostname);
      $("#sitesToTranslateWhenHovering").appendChild(li);
    });

    $("#addSiteToTranslateWhenHovering").onclick = (e) => {
      const hostname = prompt("Enter the site hostname", "www.site.com");
      if (!hostname) return;

      const li = createNodeToSitesToTranslateWhenHoveringList(hostname);
      $("#sitesToTranslateWhenHovering").appendChild(li);

      twpConfig.addSiteToTranslateWhenHovering(hostname);
    };

    // translations options
    $("#pageTranslatorService").onchange = (e) => {
      twpConfig.set("pageTranslatorService", e.target.value);
    };
    $("#pageTranslatorService").value = twpConfig.get("pageTranslatorService");

    $("#textTranslatorService").onchange = (e) => {
      twpConfig.set("textTranslatorService", e.target.value);
    };
    $("#textTranslatorService").value = twpConfig.get("textTranslatorService");

    $("#textToSpeechService").onchange = (e) => {
      twpConfig.set("textToSpeechService", e.target.value);
    };
    $("#textToSpeechService").value = twpConfig.get("textToSpeechService");

    $("#ttsSpeed").oninput = (e) => {
      twpConfig.set("ttsSpeed", e.target.value);
      $("#displayTtsSpeed").textContent = e.target.value;
    };
    $("#ttsSpeed").value = twpConfig.get("ttsSpeed");
    $("#displayTtsSpeed").textContent = twpConfig.get("ttsSpeed");

    $("#ttsVolume").oninput = (e) => {
      twpConfig.set("ttsVolume", e.target.value);
      $("#displayTtsVolume").textContent = e.target.value;
    };
    $("#ttsVolume").value = twpConfig.get("ttsVolume");
    $("#displayTtsVolume").textContent = twpConfig.get("ttsVolume");

    $("#showOriginalTextWhenHovering").onchange = (e) => {
      twpConfig.set("showOriginalTextWhenHovering", e.target.value);
    };
    $("#showOriginalTextWhenHovering").value = twpConfig.get(
      "showOriginalTextWhenHovering"
    );

    $("#translateTag_pre").onchange = (e) => {
      twpConfig.set("translateTag_pre", e.target.value);
    };
    $("#translateTag_pre").value = twpConfig.get("translateTag_pre");

    $("#enableIframePageTranslation").onchange = (e) => {
      twpConfig.set("enableIframePageTranslation", e.target.value);
    };
    $("#enableIframePageTranslation").value = twpConfig.get(
      "enableIframePageTranslation"
    );

    $("#dontSortResults").onchange = (e) => {
      twpConfig.set("dontSortResults", e.target.value);
    };
    $("#dontSortResults").value = twpConfig.get("dontSortResults");

    $("#translateDynamicallyCreatedContent").onchange = (e) => {
      twpConfig.set("translateDynamicallyCreatedContent", e.target.value);
    };
    $("#translateDynamicallyCreatedContent").value = twpConfig.get(
      "translateDynamicallyCreatedContent"
    );

    $("#autoTranslateWhenClickingALink").onchange = (e) => {
      if (e.target.value == "yes") {
        chrome.permissions.request(
          {
            permissions: ["webNavigation"],
          },
          (granted) => {
            if (granted) {
              twpConfig.set("autoTranslateWhenClickingALink", "yes");
            } else {
              twpConfig.set("autoTranslateWhenClickingALink", "no");
              e.target.value = "no";
            }
          }
        );
      } else {
        twpConfig.set("autoTranslateWhenClickingALink", "no");
        chrome.permissions.remove({
          permissions: ["webNavigation"],
        });
      }
    };
    $("#autoTranslateWhenClickingALink").value = twpConfig.get(
      "autoTranslateWhenClickingALink"
    );

    function enableOrDisableTranslateSelectedAdvancedOptions(value) {
      if (value === "no") {
        document
          .querySelectorAll("#translateSelectedAdvancedOptions input")
          .forEach((input) => {
            input.setAttribute("disabled", "");
          });
      } else {
        document
          .querySelectorAll("#translateSelectedAdvancedOptions input")
          .forEach((input) => {
            input.removeAttribute("disabled");
          });
      }
    }

    $("#showTranslateSelectedButton").onchange = (e) => {
      twpConfig.set("showTranslateSelectedButton", e.target.value);
      enableOrDisableTranslateSelectedAdvancedOptions(e.target.value);
    };
    $("#showTranslateSelectedButton").value = twpConfig.get(
      "showTranslateSelectedButton"
    );
    enableOrDisableTranslateSelectedAdvancedOptions(
      twpConfig.get("showTranslateSelectedButton")
    );

    $("#translateSelectedAutomatically").onchange = (e) => {
      twpConfig.set("translateSelectedAutomatically", e.target.value);
    };
    $("#translateSelectedAutomatically").value = twpConfig.get(
      "translateSelectedAutomatically"
    );

    $("#dontShowIfIsNotValidText").onchange = (e) => {
      twpConfig.set(
        "dontShowIfIsNotValidText",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#dontShowIfIsNotValidText").checked =
      twpConfig.get("dontShowIfIsNotValidText") === "yes" ? true : false;

    $("#dontShowIfPageLangIsTargetLang").onchange = (e) => {
      twpConfig.set(
        "dontShowIfPageLangIsTargetLang",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#dontShowIfPageLangIsTargetLang").checked =
      twpConfig.get("dontShowIfPageLangIsTargetLang") === "yes" ? true : false;

    $("#dontShowIfPageLangIsUnknown").onchange = (e) => {
      twpConfig.set(
        "dontShowIfPageLangIsUnknown",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#dontShowIfPageLangIsUnknown").checked =
      twpConfig.get("dontShowIfPageLangIsUnknown") === "yes" ? true : false;

    $("#dontShowIfSelectedTextIsTargetLang").onchange = (e) => {
      twpConfig.set(
        "dontShowIfSelectedTextIsTargetLang",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#dontShowIfSelectedTextIsTargetLang").checked =
      twpConfig.get("dontShowIfSelectedTextIsTargetLang") === "yes"
        ? true
        : false;

    $("#dontShowIfSelectedTextIsUnknown").onchange = (e) => {
      twpConfig.set(
        "dontShowIfSelectedTextIsUnknown",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#dontShowIfSelectedTextIsUnknown").checked =
      twpConfig.get("dontShowIfSelectedTextIsUnknown") === "yes" ? true : false;

    // style options
    $("#darkMode").onchange = (e) => {
      twpConfig.set("darkMode", e.target.value);
      updateDarkMode();
    };
    $("#darkMode").value = twpConfig.get("darkMode");

    $("#popupBlueWhenSiteIsTranslated").onchange = (e) => {
      twpConfig.set("popupBlueWhenSiteIsTranslated", e.target.value);
    };
    $("#popupBlueWhenSiteIsTranslated").value = twpConfig.get(
      "popupBlueWhenSiteIsTranslated"
    );

    // hotkeys options
    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
    $('[data-i18n="lblTranslateSelectedWhenPressTwice"]').innerHTML = $(
      '[data-i18n="lblTranslateSelectedWhenPressTwice"]'
    ).innerHTML.replace("[Ctrl]", "<kbd>Ctrl</kbd>");
    $('[data-i18n="lblTranslateTextOverMouseWhenPressTwice"]').innerHTML = $(
      '[data-i18n="lblTranslateTextOverMouseWhenPressTwice"]'
    ).innerHTML.replace("[Ctrl]", "<kbd>Ctrl</kbd>");

    $("#openNativeShortcutManager").onclick = (e) => {
      tabsCreate("chrome://extensions/shortcuts");
    };

    $("#translateSelectedWhenPressTwice").onclick = (e) => {
      twpConfig.set(
        "translateSelectedWhenPressTwice",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#translateSelectedWhenPressTwice").checked =
      twpConfig.get("translateSelectedWhenPressTwice") === "yes";

    $("#translateTextOverMouseWhenPressTwice").onclick = (e) => {
      twpConfig.set(
        "translateTextOverMouseWhenPressTwice",
        e.target.checked ? "yes" : "no"
      );
    };
    $("#translateTextOverMouseWhenPressTwice").checked =
      twpConfig.get("translateTextOverMouseWhenPressTwice") === "yes";

    // Whether shortcuts can be edited in-page. commands.update() is Firefox-only;
    // modern Chrome exposes a `browser` alias (without update()), so a bare
    // `typeof browser === "undefined"` no longer detects Chrome. Check the method.
    const canEditShortcutsInPage =
      typeof browser !== "undefined" &&
      browser.commands &&
      typeof browser.commands.update === "function";

    const defaultShortcuts = {};
    for (const name of Object.keys(
      chrome.runtime.getManifest().commands || {}
    )) {
      const info = chrome.runtime.getManifest().commands[name];
      if (info.suggested_key && info.suggested_key.default) {
        defaultShortcuts[name] = info.suggested_key.default;
      } else {
        defaultShortcuts[name] = "";
      }
    }

    function translateHotkeysDescription(hotkeyname) {
      const descriptions = [
        {
          key: "hotkey-toggle-translation",
          i18n: "lblSwitchTranslatedAndOriginal",
        },
        {
          key: "hotkey-translate-selected-text",
          i18n: "msgTranslateSelectedText",
        },
        {
          key: "hotkey-swap-page-translation-service",
          i18n: "swapTranslationService",
        },
        {
          key: "hotkey-show-original",
          i18n: "lblRestorePageToOriginal",
        },
        {
          key: "hotkey-translate-page-1",
          i18n: "lblTranslatePageToTargetLanguage",
        },
        {
          key: "hotkey-translate-page-2",
          i18n: "lblTranslatePageToTargetLanguage",
        },
        {
          key: "hotkey-translate-page-3",
          i18n: "lblTranslatePageToTargetLanguage",
        },
        {
          key: "hotkey-hot-translate-selected-text",
          i18n: "lblHotTranslatedSelectedText",
        },
      ];

      const info = descriptions.find((d) => d.key === hotkeyname);
      if (!info) return "";
      let desc = twpI18n.getMessage(info.i18n);
      if (hotkeyname.startsWith("hotkey-translate-page-")) {
        desc += " " + hotkeyname.slice(-1);
      }
      return desc;
    }

    function addHotkey(hotkeyname, description) {
      if (hotkeyname === "_execute_browser_action" && !description) {
        description = "Enable the extension";
      }
      description = translateHotkeysDescription(hotkeyname) || description;

      const enterShortcut =
        twpI18n.getMessage("enterShortcut") || "Enter shortcut";

      function escapeHtml(unsafe) {
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
      description = escapeHtml(description);

      const li = document.createElement("li");
      li.classList.add("shortcut-row");
      li.setAttribute("id", hotkeyname);
      li.innerHTML = `
        <div>${description}</div>
        <div class="shortcut-input-options">
            <div style="position: relative;">
                <input name="input" class="w3-input w3-border shortcut-input" type="text" readonly placeholder="${enterShortcut}" data-i18n-placeholder="enterShortcut">
                <p name="error" class="shortcut-error" style="position: absolute;"></p>
            </div>
            <div class="w3-hover-light-grey shortcut-button" name="removeKey"><i class="gg-trash"></i></div>
            <div class="w3-hover-light-grey shortcut-button" name="resetKey"><i class="gg-sync"></i></div>
        </div>  
        `;
      $("#KeyboardShortcuts").appendChild(li);

      const input = li.querySelector(`[name="input"]`);
      const error = li.querySelector(`[name="error"]`);
      const removeKey = li.querySelector(`[name="removeKey"]`);
      const resetKey = li.querySelector(`[name="resetKey"]`);

      input.value = twpConfig.get("hotkeys")[hotkeyname];
      if (input.value) {
        resetKey.style.display = "none";
      } else {
        removeKey.style.display = "none";
      }

      function setError(errorname) {
        const text = twpI18n.getMessage("hotkeyError_" + errorname);
        switch (errorname) {
          case "ctrlOrAlt":
            error.textContent = text ? text : "Include Ctrl or Alt";
            break;
          case "letter":
            error.textContent = text ? text : "Type a letter";
            break;
          case "invalid":
            error.textContent = text ? text : "Invalid combination";
            break;
          default:
            error.textContent = "";
            break;
        }
      }

      function getKeyString(e) {
        let result = "";
        if (e.ctrlKey) {
          result += "Ctrl+";
        }
        if (e.altKey) {
          result += "Alt+";
        }
        if (e.shiftKey) {
          result += "Shift+";
        }
        if (e.code.match(/Key([A-Z])/)) {
          result += e.code.match(/Key([A-Z])/)[1];
        } else if (e.code.match(/Digit([0-9])/)) {
          result += e.code.match(/Digit([0-9])/)[1];
        }

        return result;
      }

      function setShortcut(name, keystring) {
        const hotkeys = twpConfig.get("hotkeys");
        hotkeys[hotkeyname] = keystring;
        twpConfig.set("hotkeys", hotkeys);
        if (canEditShortcutsInPage) {
          browser.commands.update({
            name: name,
            shortcut: keystring,
          });
        }
      }

      function onkeychange(e) {
        input.value = getKeyString(e);

        if (e.Key == "Tab") {
          return;
        }
        if (e.key == "Escape") {
          input.blur();
          return;
        }
        if (e.key == "Backspace" || e.key == "Delete") {
          setShortcut(hotkeyname, getKeyString(e));
          input.blur();
          return;
        }
        if (!e.ctrlKey && !e.altKey) {
          setError("ctrlOrAlt");
          return;
        }
        if (e.ctrlKey && e.altKey && e.shiftKey) {
          setError("invalid");
          return;
        }
        e.preventDefault();
        if (!e.code.match(/Key([A-Z])/) && !e.code.match(/Digit([0-9])/)) {
          setError("letter");
          return;
        }

        setShortcut(hotkeyname, getKeyString(e));
        input.blur();

        setError("none");
      }

      input.onkeydown = (e) => onkeychange(e);
      input.onkeyup = (e) => onkeychange(e);

      input.onfocus = (e) => {
        input.value = "";
        setError("");
      };

      input.onblur = (e) => {
        input.value = twpConfig.get("hotkeys")[hotkeyname];
        setError("");
      };

      removeKey.onclick = (e) => {
        input.value = "";
        setShortcut(hotkeyname, "");

        removeKey.style.display = "none";
        resetKey.style.display = "block";
      };

      resetKey.onclick = (e) => {
        input.value = defaultShortcuts[hotkeyname];
        setShortcut(hotkeyname, defaultShortcuts[hotkeyname]);

        removeKey.style.display = "block";
        resetKey.style.display = "none";
      };

      // In-page editing is available (Firefox); hide the native manager button.
      $("#openNativeShortcutManager").style.display = "none";
    }

    // Only build the in-page shortcut editor where commands.update() works
    // (Firefox). On Chrome we keep just the "Open native shortcut manager"
    // button (chrome://extensions/shortcuts) instead of a disabled list.
    if (canEditShortcutsInPage && typeof chrome.commands !== "undefined") {
      chrome.commands.getAll((results) => {
        for (const result of results) {
          addHotkey(result.name, result.description);
        }
      });
    }

    // privacy options
    $("#useAlternativeService").oninput = (e) => {
      twpConfig.set("useAlternativeService", e.target.value);
    };
    $("#useAlternativeService").value = twpConfig.get("useAlternativeService");

    {
      const updateServiceSelector = (enabledServices) => {
        document
          .querySelectorAll("#pageTranslatorService option")
          .forEach((option) => option.setAttribute("hidden", ""));
        document
          .querySelectorAll("#textTranslatorService option")
          .forEach((option) => option.setAttribute("hidden", ""));
        enabledServices.forEach((svName) => {
          let option;
          option = $(`#pageTranslatorService option[value="${svName}"]`);
          if (option) {
            option.removeAttribute("hidden");
          }
          option = $(`#textTranslatorService option[value="${svName}"]`);
          if (option) {
            option.removeAttribute("hidden");
          }
        });
      };

      const servicesInfo = [
        { selector: "#btnEnableGoogle", svName: "google" },
        { selector: "#btnEnableBing", svName: "bing" },
      ];

      servicesInfo.forEach((svInfo) => {
        $(svInfo.selector).oninput = (e) => {
          const enabledServices = [];
          let enabledCount = 0;
          servicesInfo.forEach((_svInfo) => {
            if ($(_svInfo.selector).checked) {
              enabledCount++;
            }
          });
          if (enabledCount === 0) {
            if (e.target === $("#btnEnableGoogle")) {
              $("#btnEnableBing").checked = true;
            } else {
              $("#btnEnableGoogle").checked = true;
            }
          }
          servicesInfo.forEach((_svInfo) => {
            if ($(_svInfo.selector).checked) {
              enabledServices.push(_svInfo.svName);
            }
          });

          if (
            !enabledServices.includes(twpConfig.get("textTranslatorService"))
          ) {
            twpConfig.set("textTranslatorService", enabledServices[0]);
          }
          if (
            !enabledServices.includes(twpConfig.get("pageTranslatorService"))
          ) {
            twpConfig.set("pageTranslatorService", enabledServices[0]);
          }

          const pageTranslationServices = ["google", "bing"];
          chrome.runtime.sendMessage(
            {
              action: "restorePagesWithServiceNames",
              serviceNames: pageTranslationServices.filter(
                (svName) => !enabledServices.includes(svName)
              ),
              newServiceName: twpConfig.get("pageTranslatorService"),
            },
            checkedLastError
          );

          twpConfig.set("enabledServices", enabledServices);

          $("#pageTranslatorService").value = twpConfig.get(
            "pageTranslatorService"
          );
          $("#textTranslatorService").value = twpConfig.get(
            "textTranslatorService"
          );
          updateServiceSelector(enabledServices);
        };
        $(svInfo.selector).checked =
          twpConfig.get("enabledServices").indexOf(svInfo.svName) === -1
            ? false
            : true;

        updateServiceSelector(twpConfig.get("enabledServices"));
      });
    }

    // storage options
    $("#deleteTranslationCache").onclick = (e) => {
      if (confirm(twpI18n.getMessage("doYouWantToDeleteTranslationCache"))) {
        chrome.runtime.sendMessage(
          {
            action: "deleteTranslationCache",
            reload: true,
          },
          checkedLastError
        );
      }
    };

    $("#enableDiskCache").onchange = (e) => {
      twpConfig.set("enableDiskCache", $("#enableDiskCache").value);
    };
    $("#enableDiskCache").value = twpConfig.get("enableDiskCache");

    $("#backupToFile").onclick = (e) => {
      const configJSON = twpConfig.export();

      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," + encodeURIComponent(configJSON)
      );
      element.setAttribute(
        "download",
        "twp-backup_" +
          new Date()
            .toISOString()
            .replace(/T/, "_")
            .replace(/\..+/, "")
            .replace(/\:/g, ".") +
          ".txt"
      );

      element.style.display = "none";
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element);
    };
    $("#restoreFromFile").onclick = (e) => {
      const element = document.createElement("input");
      element.setAttribute("type", "file");
      element.setAttribute("accept", "text/plain");

      element.style.display = "none";
      document.body.appendChild(element);

      element.oninput = (e) => {
        const input = e.target;

        const reader = new FileReader();
        reader.onload = function () {
          try {
            if (confirm(twpI18n.getMessage("doYouWantOverwriteAllSettings"))) {
              twpConfig.import(reader.result);
            }
          } catch (e) {
            alert(twpI18n.getMessage("fileIsCorrupted"));
            console.error(e);
          }
        };

        reader.readAsText(input.files[0]);
      };

      element.click();

      document.body.removeChild(element);
    };
    $("#resetToDefault").onclick = (e) => {
      if (confirm(twpI18n.getMessage("doYouWantRestoreSettings"))) {
        twpConfig.restoreToDefault();
      }
    };

    // others options
    $("#whenShowMobilePopup").onchange = (e) => {
      twpConfig.set("whenShowMobilePopup", e.target.value);
    };
    $("#whenShowMobilePopup").value = twpConfig.get("whenShowMobilePopup");

    $("#showTranslatePageContextMenu").onchange = (e) => {
      twpConfig.set("showTranslatePageContextMenu", e.target.value);
    };
    $("#showTranslatePageContextMenu").value = twpConfig.get(
      "showTranslatePageContextMenu"
    );

    $("#showTranslateSelectedContextMenu").onchange = (e) => {
      twpConfig.set("showTranslateSelectedContextMenu", e.target.value);
    };
    $("#showTranslateSelectedContextMenu").value = twpConfig.get(
      "showTranslateSelectedContextMenu"
    );

    $("#showButtonInTheAddressBar").onchange = (e) => {
      twpConfig.set("showButtonInTheAddressBar", e.target.value);
    };
    $("#showButtonInTheAddressBar").value = twpConfig.get(
      "showButtonInTheAddressBar"
    );

    $("#translateClickingOnce").onchange = (e) => {
      twpConfig.set("translateClickingOnce", e.target.value);
    };
    $("#translateClickingOnce").value = twpConfig.get("translateClickingOnce");

    // Show the cache size automatically (no manual "Calculate" step).
    $("#storageUsed").textContent = "…";
    chrome.runtime.sendMessage(
      {
        action: "getCacheSize",
      },
      (result) => {
        checkedLastError();
        $("#storageUsed").textContent = result || "0 KB";
      }
    );

    // experimental options
    $("#addLibre").onclick = () => {
      const libre = {
        name: "libre",
        url: $("#libreURL").value,
        apiKey: $("#libreKEY").value,
      };
      try {
        new URL(libre.url);
        if (libre.apiKey.length < 10) {
          throw new Error("Provides an API Key");
        }

        const customServices = twpConfig.get("customServices");

        const index = customServices.findIndex((cs) => cs.name === "libre");
        if (index !== -1) {
          customServices.splice(index, 1);
        }

        customServices.push(libre);
        twpConfig.set("customServices", customServices);
        chrome.runtime.sendMessage({ action: "createLibreService", libre });
      } catch (e) {
        alert(e);
      }
    };

    $("#removeLibre").onclick = () => {
      const customServices = twpConfig.get("customServices");
      const index = customServices.findIndex((cs) => cs.name === "libre");

      if (index !== -1) {
        customServices.splice(index, 1);
        twpConfig.set("customServices", customServices);
        chrome.runtime.sendMessage(
          { action: "removeLibreService" },
          checkedLastError
        );
      }

      if (twpConfig.get("textTranslatorService") === "libre") {
        twpConfig.set(
          "textTranslatorService",
          twpConfig.get("pageTranslatorService")
        );
      }

      $("#libreURL").value = "";
      $("#libreKEY").value = "";
    };

    const libre = twpConfig
      .get("customServices")
      .find((cs) => cs.name === "libre");
    if (libre) {
      $("#libreURL").value = libre.url;
      $("#libreKEY").value = libre.apiKey;
    }

    async function testDeepLFreeApiKey(apiKey) {
      return await new Promise((resolve) => {
        const xhttp = new XMLHttpRequest();
        xhttp.open("GET", "https://api-free.deepl.com/v2/usage");
        xhttp.responseType = "json";
        xhttp.setRequestHeader("Authorization", "DeepL-Auth-Key " + apiKey);
        xhttp.onload = () => {
          resolve(xhttp.response);
        };
        xhttp.send();
      });
    }

    $("#addDeepL").onclick = async () => {
      const deepl_freeapi = {
        name: "deepl_freeapi",
        apiKey: $("#deeplKEY").value,
      };
      try {
        const response = await testDeepLFreeApiKey(deepl_freeapi.apiKey);
        $("#deeplApiResponse").textContent = JSON.stringify(response);
        if (response) {
          const customServices = twpConfig.get("customServices");

          const index = customServices.findIndex(
            (cs) => cs.name === "deepl_freeapi"
          );
          if (index !== -1) {
            customServices.splice(index, 1);
          }

          customServices.push(deepl_freeapi);
          twpConfig.set("customServices", customServices);
          chrome.runtime.sendMessage({
            action: "createDeeplFreeApiService",
            deepl_freeapi,
          });
        } else {
          alert("Invalid API key");
        }
      } catch (e) {
        alert(e);
      }
    };

    $("#removeDeepL").onclick = () => {
      const customServices = twpConfig.get("customServices");
      const index = customServices.findIndex(
        (cs) => cs.name === "deepl_freeapi"
      );
      if (index !== -1) {
        customServices.splice(index, 1);
        twpConfig.set("customServices", customServices);
        chrome.runtime.sendMessage(
          { action: "removeDeeplFreeApiService" },
          checkedLastError
        );
      }
      $("#deeplKEY").value = "";
      $("#deeplApiResponse").textContent = "";
    };

    const deepl_freeapi = twpConfig
      .get("customServices")
      .find((cs) => cs.name === "deepl_freeapi");
    if (deepl_freeapi) {
      $("#deeplKEY").value = deepl_freeapi.apiKey;
      testDeepLFreeApiKey(deepl_freeapi.apiKey).then((response) => {
        $("#deeplApiResponse").textContent = JSON.stringify(response);
      });
    }

    $("#btnShowProxyConfiguration").onclick = (e) => {
      $("#googleProxyContainer").style.display = "block";
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    };

    $("#addGoogleProxy").onclick = (e) => {
      try {
        const inputTranslationServer = $(
          "#googleTranslateProxyServer"
        ).value.trim();
        const inputTtsServer = $("#googleTtsProxyServer").value.trim();
        const translateServer = inputTranslationServer
          ? new URL("https://" + inputTranslationServer).host
          : null;
        const ttsServer = inputTtsServer
          ? new URL("https://" + inputTtsServer).host
          : null;

        const proxyServers = twpConfig.get("proxyServers");
        proxyServers.google = {
          translateServer,
          ttsServer,
        };
        console.info("proxyServers: ", proxyServers);
        twpConfig.set("proxyServers", proxyServers);

        $("#googleTranslateProxyServer").value = translateServer;
        $("#googleTtsProxyServer").value = ttsServer;
      } catch (e) {
        alert(e);
      }
    };

    $("#removeGoogleProxy").onclick = (e) => {
      const proxyServers = twpConfig.get("proxyServers");
      delete proxyServers.google;
      twpConfig.set("proxyServers", proxyServers);

      $("#googleTranslateProxyServer").value = "";
      $("#googleTtsProxyServer").value = "";
    }

    const googleProxy = twpConfig.get("proxyServers").google;
    if (googleProxy) {
      $("#googleTranslateProxyServer").value = googleProxy.translateServer;
      $("#googleTtsProxyServer").value = googleProxy.ttsServer;
    }

    // Render boolean Yes/No selects as toggle switches (after their values are set).
    enhanceYesNoSelects();

    // Empty-state text for the list widgets (Never/Always translate, etc.).
    document.querySelectorAll("ul.list").forEach((ul) => {
      ul.dataset.emptyText =
        twpI18n.getMessage("msgEmptyList") || "Nothing here yet";
    });

    // Settings search: filter setting rows across all sections.
    const searchInput = $("#settingsSearch");
    if (searchInput) {
      const sections = document.querySelectorAll("#content > div[id]");
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
          document
            .querySelectorAll(".setting-row[hidden], .settings-card[hidden]")
            .forEach((el) => el.removeAttribute("hidden"));
          hashchange(); // restore normal single-tab view
          return;
        }
        sections.forEach((s) => (s.style.display = "block"));
        document.querySelectorAll(".setting-row").forEach((row) => {
          row.hidden = !row.textContent.toLowerCase().includes(q);
        });
        document.querySelectorAll(".settings-card").forEach((card) => {
          card.hidden = !card.querySelector(".setting-row:not([hidden])");
        });
        sections.forEach((s) => {
          if (!s.querySelector(".setting-row:not([hidden])"))
            s.style.display = "none";
        });
      });
    }
  });

window.scrollTo({
  top: 0,
});
