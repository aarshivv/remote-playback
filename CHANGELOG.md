# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-08-15

### Fixed

- **TV interface no longer renders partly off-screen.** YouTube's TV UI assumes a
  16:9 viewport. The extension now hands it exactly that and letterboxes the
  result into the browser window, so dialogs — the sign-in panel, the "Something
  went wrong" panel — stay fully visible. Previously they could be positioned
  hundreds of pixels outside the visible area in any window that wasn't 16:9.
- **Layout no longer goes stale after a window resize.** The scale factor was
  computed once at page load and never recalculated, so resizing the window (or
  toggling fullscreen) left the TV UI sized for the old dimensions. It is now
  recomputed on `resize` and `fullscreenchange`.
- **Page could render blank** when the browser reported a viewport of 0 during
  early startup, which produced a scale factor of 0. Falls back to
  `visualViewport`, then the real screen size.
- **A failure in the resolution overrides could take background playback down
  with it.** The two override groups ran in an order where an early error meant
  the visibility overrides were never applied at all. Background playback is now
  applied first and cannot be affected by later failures.
- **Conflicts with other extensions no longer abort the whole injection.** Each
  property override is applied independently, so another main-world extension
  having already locked a property (for example `navigator.userAgent`) no longer
  prevents the remaining overrides from being installed.
- **Toolbar badge could claim TV Mode was active when it wasn't.** If content
  script registration failed, the badge still showed `TV`. It now shows `ERR`
  with a recovery hint in the tooltip.
- **Unhandled promise rejection** in the YouTube tab when the browser refused the
  popup's fullscreen request.
- **Injecting into an already-patched page** no longer throws.

### Changed

- Windows that are not 16:9 now show symmetric letterbox bars rather than a
  layout stretched to the window's aspect ratio. Resolution presets still spoof
  `screen` and video element dimensions exactly as before, so the adaptive
  bitrate ladder is unaffected.
- Removed a synthetic `visibilitychange` dispatch that could never reach page
  handlers — the extension's own capture-phase listener stopped it first.
- Release archives no longer contain source maps.

### Developer

- `npm run build` now type-checks before bundling. `tsc` had never been wired
  into the build or CI, and three type errors had accumulated unnoticed; the
  bundler strips types without checking them.
- `npm run dev` now actually watches. The script passed `--watch`, but the build
  config never read it, so it silently performed a single one-shot build.
- Watch mode also re-copies `public/` assets (`manifest.json`, `popup.html`,
  icons), which previously required a manual rebuild to reach `dist/`.

## [1.0.1] - 2026-02-21

### Added

- Privacy policy.

### Fixed

- Black padding around the home page.

## [1.0.0]

### Added

- Initial release: TV mode via User-Agent spoofing, resolution presets
  (720p/1080p/1440p/4K), background playback, and a fullscreen toggle.

[1.0.2]: https://github.com/AarshivV/remote-playback/releases/tag/v1.0.2
[1.0.1]: https://github.com/AarshivV/remote-playback/releases/tag/v1.0.1
[1.0.0]: https://github.com/AarshivV/remote-playback/releases/tag/v1.0.0
