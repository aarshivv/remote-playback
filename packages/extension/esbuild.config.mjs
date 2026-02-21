import * as esbuild from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cpSync, copyFileSync, mkdirSync, rmSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "dist");

// Clean dist
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const sharedConfig = {
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome116",
  sourcemap: true,
};

// Build main-world script (runs in page's JS context)
await esbuild.build({
  ...sharedConfig,
  entryPoints: [resolve(__dirname, "src/main-world.ts")],
  outfile: resolve(dist, "main-world.js"),
});

// Build content bridge (isolated-world, bridges chrome.storage to main-world)
await esbuild.build({
  ...sharedConfig,
  entryPoints: [resolve(__dirname, "src/content-bridge.ts")],
  outfile: resolve(dist, "content-bridge.js"),
});

// Build service worker
await esbuild.build({
  ...sharedConfig,
  entryPoints: [resolve(__dirname, "src/service-worker.ts")],
  outfile: resolve(dist, "service-worker.js"),
});

// Build popup script
await esbuild.build({
  ...sharedConfig,
  entryPoints: [resolve(__dirname, "src/popup.ts")],
  outfile: resolve(dist, "popup.js"),
});

// Copy manifest and popup HTML
copyFileSync(
  resolve(__dirname, "public/manifest.json"),
  resolve(dist, "manifest.json")
);
copyFileSync(
  resolve(__dirname, "public/popup.html"),
  resolve(dist, "popup.html")
);

// Copy icons if they exist
const iconsDir = resolve(__dirname, "public/icons");
if (existsSync(iconsDir)) {
  cpSync(iconsDir, resolve(dist, "icons"), { recursive: true });
}

console.log("Extension build complete -> dist/");
