import { mkdir, access, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "public", "models");
const base = "https://dl.polyhaven.org/file/ph-assets/Textures";
const files = [
  ["jpg", "forrest_ground_01_diff_1k.jpg", "forest-ground-color.jpg"],
  ["png", "forrest_ground_01_nor_gl_1k.png", "forest-ground-normal.png"],
  ["jpg", "forrest_ground_01_rough_1k.jpg", "forest-ground-roughness.jpg"],
  ["png", "forrest_ground_01_disp_1k.png", "forest-ground-height.png"],
];
await mkdir(root, { recursive: true });
for (const [format, filename, output] of files) {
  const target = join(root, output);
  try { await access(target); continue; } catch { /* download once */ }
  const url = `${base}/${format}/1k/forrest_ground_01/${filename}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength < 1000) throw new Error("Invalid texture response");
    await writeFile(target, data);
    console.info("[Rewild] Forest Ground:", output);
  } catch (error) {
    await rm(target, { force: true });
    console.warn("[Rewild] Forest Ground download unavailable:", filename, String(error));
  }
}
