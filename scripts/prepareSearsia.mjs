import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
const root = join(process.cwd(), "public", "models", "searsia_lucida");
const files = ["searsia_lucida_1k.gltf", "searsia_lucida.bin",
  "textures/searsia_lucida_nor_gl_1k.jpg",
  "textures/searsia_lucida_diff_1k.jpg",
  "textures/searsia_lucida_arm_1k.jpg"];
const base = "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/searsia_lucida/";
await mkdir(root, { recursive: true });
let manifest = [];
try {
  const response = await fetch("https://api.polyhaven.com/files/searsia_lucida", { signal: AbortSignal.timeout(12000) });
  if (response.ok) {
    const walk = value => {
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (key === "url" && typeof item === "string" && item.startsWith("https://")) manifest.push(item);
        else walk(item);
      }
    };
    walk(await response.json());
  }
} catch (error) { console.warn("[Rewild] Searsia manifest unavailable:", String(error)); }
for (const file of files) {
  const target = join(root, file);
  try { if ((await stat(target)).size > 100) continue; } catch { /* download */ }
  const name = file.split("/").at(-1);
  const matches = manifest.filter(url => {
    try { return decodeURIComponent(new URL(url).pathname).split("/").at(-1) === name; }
    catch { return false; }
  });
  let done = false;
  for (const url of [...matches, base + file]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) throw new Error("Asset too small");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      console.info("[Rewild] Searsia prepared:", file);
      done = true;
      break;
    } catch (error) { console.warn("[Rewild] Searsia download attempt failed:", name, String(error)); }
  }
  if (!done) console.warn("[Rewild] Searsia missing:", file);
}
