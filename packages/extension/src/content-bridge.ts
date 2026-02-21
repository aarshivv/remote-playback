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

// Read initial config and stamp it on the DOM before main-world script runs.
// Also post the value via postMessage in case main-world already ran and
// fell back to the default (the storage read is async, so there's a race).
(async () => {
  const result = await chrome.storage.local.get({
    [STORAGE_KEY_RESOLUTION]: DEFAULT_RESOLUTION,
  });
  const resolution = result[STORAGE_KEY_RESOLUTION] as string;
  document.documentElement.dataset.rpResolution = resolution;
  window.postMessage(
    { type: MSG_TYPE_RESOLUTION_UPDATE, resolution },
    "https://www.youtube.com",
  );
})();

// Listen for live updates from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes[STORAGE_KEY_RESOLUTION]) {
    const newResolution = changes[STORAGE_KEY_RESOLUTION].newValue as string;
    document.documentElement.dataset.rpResolution = newResolution;
    window.postMessage(
      { type: MSG_TYPE_RESOLUTION_UPDATE, resolution: newResolution },
      "https://www.youtube.com",
    );
  }
});
