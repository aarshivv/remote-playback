/**
 * Main-world content script — only injected on youtube.com/tv* pages.
 *
 * Overrides:
 * 1. navigator.userAgent → Samsung Smart TV
 * 2. Screen resolution spoofing (configurable via extension popup)
 * 3. Page Visibility API → always "visible" (comprehensive)
 */

import {
  RESOLUTION_PRESETS,
  DEFAULT_RESOLUTION,
  MSG_TYPE_RESOLUTION_UPDATE,
  type ResolutionPreset,
} from "./resolution-presets";

console.log("[RP] Main-world script injecting overrides");

// -------------------------------------------------------
// User-Agent Override
// -------------------------------------------------------

const TV_UA =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.2 Chrome/63.0.3239.84 TV Safari/537.36";

Object.defineProperty(navigator, "userAgent", {
  get: () => TV_UA,
  configurable: false,
});

Object.defineProperty(navigator, "appVersion", {
  get: () => TV_UA.replace("Mozilla/", ""),
  configurable: false,
});

Object.defineProperty(navigator, "platform", {
  get: () => "Linux",
  configurable: false,
});

if ("userAgentData" in navigator) {
  Object.defineProperty(navigator, "userAgentData", {
    get: () => undefined,
    configurable: false,
  });
}

// -------------------------------------------------------
// Save original addEventListener references
// (needed by both resolution override and visibility override sections)
// -------------------------------------------------------

const origDocAddEventListener = Document.prototype.addEventListener;
const origWinAddEventListener = EventTarget.prototype.addEventListener;
const origWindowAEL = window.addEventListener.bind(window);

// -------------------------------------------------------
// Screen Resolution Override
//
// Spoofs screen dimensions so YouTube TV serves the desired
// video quality. Reads initial preset from a DOM data attribute
// set by content-bridge.ts, and listens for live updates via
// postMessage when the user changes the setting in the popup.
// -------------------------------------------------------

const initialResKey =
  document.documentElement.dataset.rpResolution || DEFAULT_RESOLUTION;
let currentPreset: ResolutionPreset =
  RESOLUTION_PRESETS[initialResKey] || RESOLUTION_PRESETS[DEFAULT_RESOLUTION];

// Save originals before overriding
const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;

// Save real viewport dimensions before any spoofing (needed for zoom calculation)
const realInnerWidth = window.innerWidth;
const realInnerHeight = window.innerHeight;

/**
 * Apply resolution overrides.
 *
 * Spoofs all dimensions (screen, viewport, video element) to the preset so
 * YouTube TV renders a full TV-style layout for that resolution. Then applies
 * CSS zoom to scale the page down to fit the actual browser viewport.
 */
function applyResolutionOverrides(preset: ResolutionPreset) {
  // Screen object — affects quality cap and layout density
  Object.defineProperty(window.screen, "width",       { get: () => preset.width,  configurable: true });
  Object.defineProperty(window.screen, "height",      { get: () => preset.height, configurable: true });
  Object.defineProperty(window.screen, "availWidth",   { get: () => preset.width,  configurable: true });
  Object.defineProperty(window.screen, "availHeight",  { get: () => preset.height, configurable: true });

  // Viewport dimensions — YouTube TV uses these for page layout.
  // We spoof them to match screen so the TV UI renders at full preset size,
  // then CSS zoom scales it down to fit the real viewport.
  Object.defineProperty(window, "innerWidth",  { get: () => preset.width,  configurable: true });
  Object.defineProperty(window, "innerHeight", { get: () => preset.height, configurable: true });
  Object.defineProperty(window, "outerWidth",  { get: () => preset.width,  configurable: true });
  Object.defineProperty(window, "outerHeight", { get: () => preset.height, configurable: true });

  // Device pixel ratio
  Object.defineProperty(window, "devicePixelRatio", {
    get: () => preset.devicePixelRatio,
    configurable: true,
  });

  // Video element dimensions — this is what YouTube's adaptive bitrate player
  // reads to decide quality. On a real TV the video fills the entire screen,
  // so clientWidth === screen.width. We replicate that for video elements only.
  Object.defineProperty(HTMLVideoElement.prototype, "clientWidth", {
    get() { return preset.width; },
    configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "clientHeight", {
    get() { return preset.height; },
    configurable: true,
  });

  // getBoundingClientRect for video elements — ABR also uses this
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const rect = origGetBoundingClientRect.call(this);
    if (this instanceof HTMLVideoElement) {
      return new DOMRect(rect.x, rect.y, preset.width, preset.height);
    }
    return rect;
  };

  // CSS zoom — scale the TV UI down to fit the real viewport.
  // YouTube TV renders layout for the spoofed innerWidth (e.g. 3840px),
  // zoom compensates so everything fits in the real viewport.
  const zoomLevel = realInnerWidth / preset.width;
  document.documentElement.style.zoom = String(zoomLevel);

  console.log(
    `[RP] Resolution: ${preset.width}x${preset.height}, zoom: ${zoomLevel.toFixed(3)}`,
  );
}

applyResolutionOverrides(currentPreset);

// Listen for live resolution updates from content-bridge.ts
origWindowAEL("message", ((event: MessageEvent) => {
  if (event.source !== window) return;
  if (event.data?.type !== MSG_TYPE_RESOLUTION_UPDATE) return;

  const newPreset = RESOLUTION_PRESETS[event.data.resolution as string];
  if (!newPreset) return;

  currentPreset = newPreset;
  applyResolutionOverrides(currentPreset);
}) as EventListener);

// -------------------------------------------------------
// Page Visibility Override — comprehensive
//
// Techniques (layered for maximum coverage):
//   1. Property overrides (visibilityState, hidden, webkit variants)
//   2. addEventListener interception (prevents listeners from registering)
//   3. Capture-phase event blocking (stops any that slip through)
//   4. Handler property blocking (onvisibilitychange, onblur, etc.)
//   5. hasFocus() override
//   6. AudioContext suspend prevention
//   7. mouseleave blocking
// -------------------------------------------------------

// --- 1. Property overrides ---

Object.defineProperty(document, "visibilityState", {
  get: () => "visible",
  configurable: false,
});

Object.defineProperty(document, "hidden", {
  get: () => false,
  configurable: false,
});

// Webkit-prefixed variants (YouTube's bundled player may check these)
Object.defineProperty(document, "webkitHidden", {
  get: () => false,
  configurable: false,
});

Object.defineProperty(document, "webkitVisibilityState", {
  get: () => "visible",
  configurable: false,
});

// --- 2. Intercept addEventListener to silently drop visibility/blur listeners ---
// This is stronger than stopImmediatePropagation — prevents registration entirely.

const blockedDocEvents = new Set([
  "visibilitychange",
  "webkitvisibilitychange",
  "mozvisibilitychange",
  "freeze",
  "resume",
]);

const blockedWinEvents = new Set([
  "blur",
  "visibilitychange",
  "webkitvisibilitychange",
  "unload",
  "beforeunload",
]);

Document.prototype.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) {
  if (blockedDocEvents.has(type)) return;
  return origDocAddEventListener.call(this, type, listener, options);
};

// Override on window specifically (not all EventTargets)
window.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) {
  if (blockedWinEvents.has(type)) return;
  return origWindowAEL(type, listener, options);
} as typeof window.addEventListener;

// Also patch EventTarget.prototype.addEventListener so calls via
// EventTarget.prototype.addEventListener.call(window, "unload", ...)
// are caught too (bypasses window.addEventListener override).
EventTarget.prototype.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) {
  if (this === window && blockedWinEvents.has(type)) return;
  if (this instanceof Document && blockedDocEvents.has(type)) return;
  return origWinAddEventListener.call(this, type, listener, options);
};

// --- 3. Capture-phase blocking (belt-and-suspenders for any listeners already registered) ---

const stopEvent = (e: Event) => {
  e.stopImmediatePropagation();
  e.preventDefault();
};

// Use the ORIGINAL addEventListener for our own capture listeners
origDocAddEventListener.call(document, "visibilitychange", stopEvent, { capture: true });
origDocAddEventListener.call(document, "webkitvisibilitychange", stopEvent, { capture: true });
origDocAddEventListener.call(document, "blur", stopEvent, { capture: true });
origDocAddEventListener.call(document, "focus", stopEvent, { capture: true });
origDocAddEventListener.call(document, "mouseleave", stopEvent, { capture: true });
origDocAddEventListener.call(document, "freeze", stopEvent, { capture: true });
origDocAddEventListener.call(document, "resume", stopEvent, { capture: true });

origWindowAEL("blur", stopEvent, { capture: true });
origWindowAEL("focus", stopEvent, { capture: true });
origWindowAEL("visibilitychange", stopEvent, { capture: true });
origWindowAEL("mouseleave", stopEvent, { capture: true });

// --- 4. Block handler property assignments ---

Object.defineProperty(document, "onvisibilitychange", {
  get: () => null, set: () => {}, configurable: false,
});

Object.defineProperty(document, "onwebkitvisibilitychange" as keyof Document, {
  get: () => null, set: () => {}, configurable: false,
});

Object.defineProperty(window, "onblur", {
  get: () => null, set: () => {}, configurable: false,
});

Object.defineProperty(window, "onfocus", {
  get: () => null, set: () => {}, configurable: false,
});

// --- 5. hasFocus() ---

Document.prototype.hasFocus = () => true;

// --- 6. AudioContext suspend prevention ---
// Chrome can suspend AudioContext in background tabs. YouTube's player
// may detect this state change and pause playback.

const OrigAudioContext = window.AudioContext || (window as any).webkitAudioContext;
if (OrigAudioContext) {
  const origResume = OrigAudioContext.prototype.resume;

  OrigAudioContext.prototype.suspend = function () {
    // Block automatic suspend — return resolved promise (no-op)
    return Promise.resolve();
  };

  // Ensure resume always works
  OrigAudioContext.prototype.resume = function () {
    return origResume.call(this);
  };
}

// --- 7. Dispatch fake visibilitychange to flush any early-registered handlers ---
// They'll read document.visibilityState → "visible" and stay happy.

document.dispatchEvent(new Event("visibilitychange"));

console.log("[RP] All overrides applied successfully");
