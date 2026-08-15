import * as esbuild from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cpSync, copyFileSync, mkdirSync, rmSync, existsSync, watch as watchDir } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "dist");
const watch = process.argv.includes("--watch");

// Clean dist
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const sharedConfig = {
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome116",
  // Source maps are a dev aid; shipping them would bloat the release zip.
  sourcemap: watch,
};

const entries = [
  // Runs in the page's JS context
  ["src/main-world.ts", "main-world.js"],
  // Isolated world, bridges chrome.storage to main-world
  ["src/content-bridge.ts", "content-bridge.js"],
  ["src/service-worker.ts", "service-worker.js"],
  ["src/popup.ts", "popup.js"],
];

function copyStaticAssets() {
  copyFileSync(
    resolve(__dirname, "public/manifest.json"),
    resolve(dist, "manifest.json")
  );
  copyFileSync(
    resolve(__dirname, "public/popup.html"),
    resolve(dist, "popup.html")
  );

  const iconsDir = resolve(__dirname, "public/icons");
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, resolve(dist, "icons"), { recursive: true });
  }
}

const buildOptions = entries.map(([entry, out]) => ({
  ...sharedConfig,
  entryPoints: [resolve(__dirname, entry)],
  outfile: resolve(dist, out),
}));

if (watch) {
  const contexts = await Promise.all(buildOptions.map((o) => esbuild.context(o)));
  await Promise.all(contexts.map((c) => c.watch()));
  copyStaticAssets();

  // esbuild only watches the TS entry points. Without this, edits to
  // manifest.json / popup.html / icons never reach dist/ and you debug a stale
  // build with no clue why.
  watchDir(resolve(__dirname, "public"), { recursive: true }, () => {
    try {
      copyStaticAssets();
      console.log("Static assets updated -> dist/");
    } catch (err) {
      console.error("Failed to copy static assets:", err.message);
    }
  });

  console.log("Watching for changes -> dist/ (Ctrl+C to stop)");
} else {
  await Promise.all(buildOptions.map((o) => esbuild.build(o)));
  copyStaticAssets();
  console.log("Extension build complete -> dist/");
}
