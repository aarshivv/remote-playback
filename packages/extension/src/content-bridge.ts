/**
 * Isolated-world content script — bridges chrome.storage to the main-world script.
 *
 * Runs at document_start BEFORE main-world.ts so it can stamp the resolution
 * preset onto the DOM for synchronous reading.
 */

import {
  DEFAULT_RESOLUTION,
  MSG_TYPE_RESOLUTION_UPDATE,
  STORAGE_KEY_RESOLUTION,
} from "./resolution-presets";

/**
 * Hand a resolution to the main-world script.
 *
 * postMessage is the channel that actually matters: reading chrome.storage is
 * async, so main-world has almost always run (and fallen back to the default)
 * by the time we get a value. The data attribute is a synchronous fast path for
 * the case where it hasn't — and documentElement can still be null this early,
 * hence the guard.
 */
function publishResolution(resolution: string) {
  if (document.documentElement) {
    document.documentElement.dataset.rpResolution = resolution;
  }
  window.postMessage(
    { type: MSG_TYPE_RESOLUTION_UPDATE, resolution },
    "https://www.youtube.com",
  );
}

void (async () => {
  const result = await chrome.storage.local.get({
    [STORAGE_KEY_RESOLUTION]: DEFAULT_RESOLUTION,
  });
  publishResolution(result[STORAGE_KEY_RESOLUTION] as string);
})();

// Listen for live updates from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes[STORAGE_KEY_RESOLUTION]) {
    publishResolution(changes[STORAGE_KEY_RESOLUTION].newValue as string);
  }
});
