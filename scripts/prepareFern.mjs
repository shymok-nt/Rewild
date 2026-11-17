import { mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { join, dirname } from "node:path";

const root = join(process.cwd(), "public", "models", "fern_02");
const required = ["fern_02_1k.gltf", "fern_02.bin", "textures/fern_02_arm_1k.jpg",
  "textures/fern_02_diff_1k.jpg", "textures/fern_02_nor_gl_1k.jpg"];
const fallbackBase = "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/fern_02/";
await mkdir(join(root, "textures"), { recursive: true });

async function valid(path) {
  try { return (await stat(path)).size > 100; } catch { return false; }
}
function findAssetUrls(value, found = []) {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    if (key === "url" && typeof child === "string" && child.startsWith("https://")) found.push(child);
    else findAssetUrls(child, found);
  }
  return found;
}
let manifestUrls = [];
try {
  const response = await fetch("https://api.polyhaven.com/files/fern_02", { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("API HTTP " + response.status);
  const manifest = await response.json();
  manifestUrls = findAssetUrls(manifest);
} catch (error) {
  console.warn("[Rewild] Fern manifest unavailable:", String(error));
}
for (const file of required) {
  const target = join(root, file);
  if (await valid(target)) continue;
  const name = file.split("/").at(-1);
  const exact = manifestUrls.filter(url => {
    try { return decodeURIComponent(new URL(url).pathname).split("/").at(-1) === name; }
    catch { return false; }
  });
  const urls = [...exact, fallbackBase + file];
  let success = false;
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) throw new Error("Empty asset");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      success = true;
      console.info("[Rewild] Fern 02 prepared:", file);
      break;
    } catch (error) {
      console.warn("[Rewild] Fern download attempt failed:", name, String(error));
    }
  }
  if (!success) await rm(target, { force: true });
}
const missing = [];
for (const file of required) if (!(await valid(join(root, file)))) missing.push(file);
if (missing.length) {
  console.warn("[Rewild] Fern 02 missing:", missing.join(", "),
    "Place the contents of fern_02_1k.gltf.zip in public/models/fern_02/ (including textures/).");
} else {
  const gltf = JSON.parse(await readFile(join(root, "fern_02_1k.gltf"), "utf8"));
  const external = [...(gltf.buffers ?? []).map(x => x.uri), ...(gltf.images ?? []).map(x => x.uri)]
    .filter(uri => uri && !uri.startsWith("data:"));
  for (const uri of external) {
    if (!(await valid(join(root, uri)))) console.warn("[Rewild] glTF references missing asset:", uri);
  }
}
