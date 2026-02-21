import {
  STORAGE_KEY_ENABLED,
  STORAGE_KEY_RESOLUTION,
  DEFAULT_RESOLUTION,
} from "./resolution-presets";

const enabledToggle = document.getElementById("enabledToggle") as HTMLInputElement;
const resolutionSelect = document.getElementById("resolution") as HTMLSelectElement;

// Load current settings
chrome.storage.local.get(
  { [STORAGE_KEY_ENABLED]: true, [STORAGE_KEY_RESOLUTION]: DEFAULT_RESOLUTION },
  (result) => {
    enabledToggle.checked = result[STORAGE_KEY_ENABLED];
    resolutionSelect.value = result[STORAGE_KEY_RESOLUTION];
    resolutionSelect.disabled = !result[STORAGE_KEY_ENABLED];
  },
);

// Handle toggle
enabledToggle.addEventListener("change", () => {
  const enabled = enabledToggle.checked;
  chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: enabled });
  resolutionSelect.disabled = !enabled;
});

// Handle resolution change
resolutionSelect.addEventListener("change", () => {
  chrome.storage.local.set({ [STORAGE_KEY_RESOLUTION]: resolutionSelect.value });
});

// Detect OS theme and store for service worker (SW has no matchMedia)
function syncTheme() {
  const theme = globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  chrome.storage.local.set({ theme });
}
syncTheme();
globalThis.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);

// Handle fullscreen button
const fullscreenBtn = document.getElementById("fullscreenBtn") as HTMLButtonElement;
fullscreenBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("youtube.com/tv")) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    },
  });
  window.close();
});
