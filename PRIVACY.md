# Privacy Policy — Remote Playback

**Last updated:** February 21, 2026

## Data Collection

Remote Playback does **not** collect, store, transmit, or share any personal data or browsing information.

## Local Storage

The extension stores the following settings locally on your device using Chrome's `storage.local` API:

- **Enabled state** — whether TV Mode is on or off
- **Resolution preference** — your selected video quality (720p, 1080p, 1440p, or 4K)
- **Theme preference** — light or dark, based on your system setting

This data never leaves your browser and is automatically deleted when the extension is uninstalled.

## Network Activity

The extension does **not** make any external network requests. It only modifies the User-Agent header on requests to `youtube.com/tv` to enable the TV interface.

## Third-Party Services

The extension does **not** use any analytics, telemetry, tracking, or third-party services.

## Permissions

| Permission | Why it's needed |
|---|---|
| `declarativeNetRequest` | Modify the User-Agent header on YouTube TV requests |
| `scripting` | Inject content scripts for resolution and playback control |
| `storage` | Save your settings locally |
| `activeTab` | Enable the fullscreen toggle from the popup |

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/AarshivV/remote-playback/issues).
