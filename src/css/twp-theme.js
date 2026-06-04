"use strict";

/*
 * Shared theme bootstrap for the options page and popups.
 *
 * Replaces the old darkmode.js hack (which injected an !important stylesheet).
 * Light/dark is driven by CSS custom properties in twp-theme.css:
 *   - no data-theme attribute  -> follow the OS (prefers-color-scheme)
 *   - data-theme="light|dark"  -> force that theme
 *
 * Keeps the function names enableDarkMode()/disableDarkMode() that options.js
 * already calls, so the existing dark-mode setting logic keeps working.
 */

function twpApplyTheme(mode) {
  // mode: "dark" | "light" | "auto"
  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
}

function enableDarkMode() {
  try {
    sessionStorage.setItem("twpTheme", "dark");
  } catch (e) {}
  twpApplyTheme("dark");
}

function disableDarkMode() {
  try {
    sessionStorage.setItem("twpTheme", "light");
  } catch (e) {}
  twpApplyTheme("light");
}

// Apply the remembered choice as early as possible to avoid a flash of the
// wrong theme. "auto" (or nothing remembered) leaves it to prefers-color-scheme.
try {
  const saved = sessionStorage.getItem("twpTheme");
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  }
} catch (e) {}
