# RemotePlayback

A browser extension that turns your browser into a YouTube TV (Leanback) receiver. Navigate YouTube's 10-foot TV interface with your keyboard, keep playback alive in background tabs, and control video quality through resolution spoofing.

## Features

- **TV Mode** — Spoofs the browser as a Samsung Smart TV so YouTube serves the Leanback UI at `youtube.com/tv`
- **Resolution Control** — Select 720p, 1080p, 1440p, or 4K quality targets from the extension popup
- **Background Playback** — Comprehensive visibility API overrides prevent YouTube from detecting tab switches
- **Fullscreen** — One-click fullscreen toggle from the popup for a true TV experience

## How It Works

The extension operates on three layers:

1. **Network layer** — `declarativeNetRequest` rewrites the `User-Agent` header on all requests to `youtube.com/tv`, so YouTube's servers respond with TV-optimized assets.

2. **Page context** — A main-world content script overrides `navigator.userAgent`, `window.screen`, video element dimensions, `document.visibilityState`, `document.hidden`, `hasFocus()`, and blocks visibility-related event listeners. This makes the page believe it's running on a real TV that's always in the foreground.

3. **Storage bridge** — An isolated-world content script reads the resolution setting from `chrome.storage` and relays it to the main-world script via DOM data attributes and `postMessage`.

## Install

### Build from source

```bash
git clone https://github.com/harshkumar314e/remote-playback.git
cd remote-playback
npm install
npm run build
```

The built extension will be in `packages/extension/dist`.

### Load in your browser

<details>
<summary><b>Google Chrome</b></summary>

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `packages/extension/dist` folder
</details>

<details>
<summary><b>Microsoft Edge</b></summary>

1. Go to `edge://extensions`
2. Enable **Developer mode** (left sidebar toggle)
3. Click **Load unpacked**
4. Select the `packages/extension/dist` folder
</details>

<details>
<summary><b>Brave</b></summary>

1. Go to `brave://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `packages/extension/dist` folder
</details>

<details>
<summary><b>Opera</b></summary>

1. Go to `opera://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `packages/extension/dist` folder
</details>

<details>
<summary><b>Vivaldi</b></summary>

1. Go to `vivaldi://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `packages/extension/dist` folder
</details>

### Download from Releases

Grab the latest zip from [GitHub Releases](https://github.com/harshkumar314e/remote-playback/releases), extract it, and load the extracted folder as described above.

## Browser Compatibility

| Browser | Supported | Notes |
|---------|-----------|-------|
| Chrome 116+ | Yes | Primary target |
| Edge 116+ | Yes | Full support |
| Brave | Yes | Full support |
| Opera 102+ | Yes | Full support |
| Vivaldi 6.2+ | Yes | Full support |
| Arc | Yes | Full support |
| Firefox | No | Uses different extension APIs (`browser.*` vs `chrome.*`) |
| Safari | No | Requires native Xcode wrapper |

All Chromium-based browsers with Manifest V3 support are compatible.

## Usage

1. Click the extension icon to open the popup
2. Toggle **TV Mode** on
3. Navigate to `youtube.com/tv` (or reload if already there)
4. Select your desired resolution from the dropdown
5. Click **Go Fullscreen** for the full TV experience

Use Escape to exit fullscreen. The extension badge shows **TV** (red) when active or **OFF** (gray) when disabled.

## Project Structure

```
packages/extension/
  src/
    main-world.ts        # Page-context overrides (UA, resolution, visibility)
    content-bridge.ts    # Isolated-world storage bridge
    service-worker.ts    # Background: rules, script registration, badge
    popup.ts             # Popup UI logic
    resolution-presets.ts # Shared constants
  public/
    manifest.json
    popup.html
    icons/
```

## Requirements

- Any Chromium-based browser (Chrome 116+, Edge 116+, Brave, Opera 102+, Vivaldi 6.2+)
- Node.js 18+ (for building from source)

## License

[MIT](LICENSE)
