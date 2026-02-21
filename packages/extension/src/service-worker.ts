// -------------------------------------------------------
// Configuration
// -------------------------------------------------------

const SW_TV_UA =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.2 Chrome/63.0.3239.84 TV Safari/537.36";

const MAIN_WORLD_SCRIPT_ID = "rp-main-world";
const CONTENT_BRIDGE_SCRIPT_ID = "rp-content-bridge";

const UA_RULE_ID = 1;
const STALE_REDIRECT_RULE_ID = 2; // leftover from previous version, must be cleaned up

// -------------------------------------------------------
// Theme-aware toolbar icon
// -------------------------------------------------------

function getIconPaths(theme: "light" | "dark") {
  return {
    16: `icons/icon-${theme}-16.png`,
    48: `icons/icon-${theme}-48.png`,
    128: `icons/icon-${theme}-128.png`,
  };
}

async function applyThemeIcon() {
  const { theme } = await chrome.storage.local.get({ theme: "light" });
  const validated = theme === "dark" ? "dark" : "light";
  chrome.action.setIcon({ path: getIconPaths(validated) });
}

// -------------------------------------------------------
// Dynamic declarativeNetRequest rules
// -------------------------------------------------------

const uaRule: chrome.declarativeNetRequest.Rule = {
  id: UA_RULE_ID,
  priority: 1,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    requestHeaders: [
      {
        header: "user-agent",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: SW_TV_UA,
      },
    ],
  },
  condition: {
    urlFilter: "||www.youtube.com/tv",
    resourceTypes: [
      chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
      chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
      chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
      chrome.declarativeNetRequest.ResourceType.SCRIPT,
      chrome.declarativeNetRequest.ResourceType.STYLESHEET,
      chrome.declarativeNetRequest.ResourceType.IMAGE,
      chrome.declarativeNetRequest.ResourceType.MEDIA,
      chrome.declarativeNetRequest.ResourceType.FONT,
      chrome.declarativeNetRequest.ResourceType.OTHER,
    ],
  },
};

// -------------------------------------------------------
// Enable / Disable TV mode
// -------------------------------------------------------

async function enableTvMode() {
  // Add dynamic rule for UA spoofing
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [uaRule],
    removeRuleIds: [UA_RULE_ID, STALE_REDIRECT_RULE_ID],
  });

  // Register content scripts (bridge must run before main-world)
  await chrome.scripting
    .unregisterContentScripts({ ids: [CONTENT_BRIDGE_SCRIPT_ID, MAIN_WORLD_SCRIPT_ID] })
    .catch(() => {});
  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_BRIDGE_SCRIPT_ID,
      matches: ["https://www.youtube.com/tv*"],
      js: ["content-bridge.js"],
      runAt: "document_start",
      world: "ISOLATED",
    },
    {
      id: MAIN_WORLD_SCRIPT_ID,
      matches: ["https://www.youtube.com/tv*"],
      js: ["main-world.js"],
      runAt: "document_start",
      world: "MAIN",
    },
  ]);

  // Update badge
  chrome.action.setBadgeText({ text: "TV" });
  chrome.action.setBadgeBackgroundColor({ color: "#CC0000" });
  chrome.action.setTitle({ title: "RemotePlayback: TV Mode ON" });
}

async function disableTvMode() {
  // Remove dynamic rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [UA_RULE_ID, STALE_REDIRECT_RULE_ID],
  });

  // Unregister content scripts
  await chrome.scripting
    .unregisterContentScripts({ ids: [CONTENT_BRIDGE_SCRIPT_ID, MAIN_WORLD_SCRIPT_ID] })
    .catch(() => {});

  // Update badge
  chrome.action.setBadgeText({ text: "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#666666" });
  chrome.action.setTitle({ title: "RemotePlayback: TV Mode OFF" });
}

// -------------------------------------------------------
// React to setting changes from popup
// -------------------------------------------------------

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;

  if (changes.enabled) {
    if (changes.enabled.newValue) {
      await enableTvMode();
    } else {
      await disableTvMode();
    }
    console.log(`[RP SW] TV mode ${changes.enabled.newValue ? "ON" : "OFF"}`);
  }
  // Resolution changes are handled by content-bridge.ts — no SW action needed.

  if (changes.theme) {
    await applyThemeIcon();
  }
});

// -------------------------------------------------------
// Initialize on startup
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-floating-promises -- service worker top-level init
(async () => {
  const { enabled } = await chrome.storage.local.get({ enabled: true });

  if (enabled) {
    await enableTvMode();
  } else {
    await disableTvMode();
  }

  applyThemeIcon();
  console.log(`[RP SW] Service worker loaded, TV mode ${enabled ? "ON" : "OFF"}`);
})();
