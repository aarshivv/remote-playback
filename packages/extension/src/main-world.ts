/**
 * Main-world content script — only injected on youtube.com/tv* pages.
 *
 * Overrides:
 * 1. navigator.userAgent → Samsung Smart TV
 * 2. Screen resolution spoofing (configurable via extension popup)
 * 3. Page Visibility API → always "visible" (comprehensive)
 *
 * Ordering note: the visibility layer is applied BEFORE the resolution layer.
 * Resolution work touches the DOM (documentElement may not exist yet at
 * document_start), so it is the only part that can realistically throw. Running
 * visibility first means a resolution failure can never take background
 * playback down with it.
 */

import {
  RESOLUTION_PRESETS,
  DEFAULT_RESOLUTION,
  MSG_TYPE_RESOLUTION_UPDATE,
  type ResolutionPreset,
} from "./resolution-presets";

// Re-entry guard — every override below uses configurable: false, so running
// twice on the same page would throw on the first redefine.
declare global {
  interface Window {
    __rpInjected?: boolean;
  }
}

if (window.__rpInjected) {
  console.log("[RP] Overrides already applied, skipping");
} else {
  window.__rpInjected = true;
  applyAllOverrides();
}

/**
 * Object.defineProperty that can't take the rest of the injection down with it.
 *
 * Every override here is configurable: false, and so are the ones other
 * MAIN-world extensions install. If one of them got to a property first, the
 * redefine throws — and an uncaught throw here would skip every override below
 * it, including background playback.
 */
function define(target: object, prop: string, descriptor: PropertyDescriptor) {
  try {
    Object.defineProperty(target, prop, descriptor);
  } catch (err) {
    console.warn(`[RP] Could not override ${prop} (already locked?)`, err);
  }
}

function applyAllOverrides() {
  console.log("[RP] Main-world script injecting overrides");

  // -------------------------------------------------------
  // User-Agent Override
  // -------------------------------------------------------

  const TV_UA =
    "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.2 Chrome/63.0.3239.84 TV Safari/537.36";

  define(navigator, "userAgent", { get: () => TV_UA, configurable: false });

  define(navigator, "appVersion", {
    get: () => TV_UA.replace("Mozilla/", ""),
    configurable: false,
  });

  define(navigator, "platform", { get: () => "Linux", configurable: false });

  if ("userAgentData" in navigator) {
    define(navigator, "userAgentData", { get: () => undefined, configurable: false });
  }

  // -------------------------------------------------------
  // Save original references
  // (needed by both resolution override and visibility override sections)
  // -------------------------------------------------------

  const origDocAddEventListener = Document.prototype.addEventListener;
  const origWinAddEventListener = EventTarget.prototype.addEventListener;

  // Cast once: this is deliberately a loose (string, listener) signature so the
  // blocking wrappers below can forward arbitrary event names.
  const origWindowAEL = window.addEventListener.bind(window) as (
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => void;

  // Real viewport getters, captured before any spoofing so the real browser
  // dimensions stay readable afterwards (needed to rescale the letterbox on resize).
  const origInnerWidthDesc = Object.getOwnPropertyDescriptor(window, "innerWidth");
  const origInnerHeightDesc = Object.getOwnPropertyDescriptor(window, "innerHeight");
  const realScreenWidth = window.screen.width;
  const realScreenHeight = window.screen.height;

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

  define(document, "visibilityState", { get: () => "visible", configurable: false });
  define(document, "hidden", { get: () => false, configurable: false });

  // Webkit-prefixed variants (YouTube's bundled player may check these)
  define(document, "webkitHidden", { get: () => false, configurable: false });
  define(document, "webkitVisibilityState", { get: () => "visible", configurable: false });

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
    this: Document,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (blockedDocEvents.has(type)) return;
    origDocAddEventListener.call(this, type, listener as EventListener, options);
  };

  // Override on window specifically (not all EventTargets)
  window.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (blockedWinEvents.has(type)) return;
    origWindowAEL(type, listener as EventListener, options);
  } as typeof window.addEventListener;

  // Also patch EventTarget.prototype.addEventListener so calls via
  // EventTarget.prototype.addEventListener.call(window, "unload", ...)
  // are caught too (bypasses window.addEventListener override).
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (this === window && blockedWinEvents.has(type)) return;
    if (this instanceof Document && blockedDocEvents.has(type)) return;
    origWinAddEventListener.call(this, type, listener as EventListener, options);
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

  const blockHandler = { get: () => null, set: () => {}, configurable: false };
  define(document, "onvisibilitychange", blockHandler);
  define(document, "onwebkitvisibilitychange", blockHandler);
  define(window, "onblur", blockHandler);
  define(window, "onfocus", blockHandler);

  // --- 5. hasFocus() ---

  Document.prototype.hasFocus = () => true;

  // --- 6. AudioContext suspend prevention ---
  // Chrome can suspend AudioContext in background tabs. YouTube's player
  // may detect this state change and pause playback.

  const OrigAudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (OrigAudioContext) {
    OrigAudioContext.prototype.suspend = function () {
      // Block automatic suspend — return resolved promise (no-op)
      return Promise.resolve();
    };
  }

  // (There used to be a synthetic visibilitychange dispatch here, meant to flush
  // handlers registered before injection. It could never do anything: the
  // capture listener installed in step 3 is itself on document, so it runs first
  // at AT_TARGET and stopImmediatePropagation()s the event before any page
  // handler sees it.)

  // -------------------------------------------------------
  // Screen Resolution Override
  //
  // Spoofs screen/video dimensions so YouTube TV's adaptive bitrate ladder
  // picks the desired quality, then letterboxes the TV layout into the real
  // browser viewport.
  // -------------------------------------------------------

  /** Real browser viewport, readable even after innerWidth/Height are spoofed. */
  function readRealViewport(): { width: number; height: number } {
    let width = Number(origInnerWidthDesc?.get?.call(window)) || 0;
    let height = Number(origInnerHeightDesc?.get?.call(window)) || 0;

    // At document_start the window can report 0 before first layout. visualViewport
    // is a second source; the real screen size is the last resort.
    if (!width) width = window.visualViewport?.width || realScreenWidth || 1920;
    if (!height) height = window.visualViewport?.height || realScreenHeight || 1080;

    return { width: Math.round(width), height: Math.round(height) };
  }

  const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  /**
   * Apply resolution overrides for `preset`.
   *
   * YouTube TV's layout hard-assumes a 16:9 viewport — hand it any other aspect
   * and its dialogs position themselves off-screen. CSS zoom cannot help here:
   * it scales both axes equally, so in a non-16:9 window the layout box keeps
   * the window's aspect no matter what zoom you pick. Instead we give <html> the
   * preset's exact dimensions and scale it with a transform, which also makes it
   * the containing block for YouTube's position:fixed elements — so they size to
   * a true 16:9 box. The leftover space becomes symmetric letterbox bars, which
   * is what a real TV app does in a mismatched window.
   */
  function applyResolutionOverrides(preset: ResolutionPreset) {
    // Screen object — affects quality cap and layout density
    Object.defineProperty(window.screen, "width",       { get: () => preset.width,  configurable: true });
    Object.defineProperty(window.screen, "height",      { get: () => preset.height, configurable: true });
    Object.defineProperty(window.screen, "availWidth",  { get: () => preset.width,  configurable: true });
    Object.defineProperty(window.screen, "availHeight", { get: () => preset.height, configurable: true });

    // Viewport dimensions — the letterbox makes these literally true: the
    // layout box really is preset.width x preset.height.
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

    applyLetterbox(preset);
  }

  /**
   * Size <html> to the preset and scale it to fit, centered. At document_start
   * documentElement can still be null, so fall back to a MutationObserver that
   * fires the moment it is parsed in.
   */
  function applyLetterbox(preset: ResolutionPreset) {
    const el = document.documentElement;
    if (!el) {
      const observer = new MutationObserver(() => {
        if (!document.documentElement) return;
        observer.disconnect();
        // Re-read the live preset — the user may have changed it while we waited.
        applyLetterbox(currentPreset);
      });
      observer.observe(document, { childList: true, subtree: true });
      return;
    }

    const real = readRealViewport();
    const scale = Math.min(real.width / preset.width, real.height / preset.height);
    const offsetX = (real.width - preset.width * scale) / 2;
    const offsetY = (real.height - preset.height * scale) / 2;

    el.style.width = `${preset.width}px`;
    el.style.height = `${preset.height}px`;
    el.style.margin = "0";
    el.style.overflow = "hidden";
    // Painted behind the scaled box, so the letterbox bars are black.
    el.style.background = "#000";
    el.style.transformOrigin = "top left";
    el.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

    console.log(
      `[RP] Resolution: ${preset.width}x${preset.height}, scale: ${scale.toFixed(3)}, bars: ${Math.round(offsetX)}x${Math.round(offsetY)}`,
    );
  }

  // documentElement is not guaranteed to exist yet, so this read is guarded.
  // It is only a fast path anyway: content-bridge.ts reads chrome.storage
  // asynchronously, so the authoritative value usually arrives via postMessage.
  const initialResKey =
    document.documentElement?.dataset.rpResolution || DEFAULT_RESOLUTION;
  let currentPreset: ResolutionPreset =
    RESOLUTION_PRESETS[initialResKey] || RESOLUTION_PRESETS[DEFAULT_RESOLUTION];

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

  // The letterbox scale is derived from the real viewport, so it goes stale whenever
  // the window is resized or fullscreen is toggled. Recompute on both.
  const reapply = () => applyResolutionOverrides(currentPreset);
  origWindowAEL("resize", reapply);
  origDocAddEventListener.call(document, "fullscreenchange", reapply);

  console.log("[RP] All overrides applied successfully");
}
