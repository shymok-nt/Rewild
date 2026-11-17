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
  try { await access(target); console.info("[Rewild] Forest Ground cached:", output); continue; } catch { /* download once */ }
  const url = `${base}/${format}/1k/forrest_ground_01/${filename}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength < 1000) throw new Error("Invalid texture response");
    const valid = format === "png"
      ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : data[0] === 0xff && data[1] === 0xd8;
    if (!valid) throw new Error("Unexpected texture format");
    await writeFile(target, data);
    console.info("[Rewild] Forest Ground:", output);
  } catch (error) {
    await rm(target, { force: true });
    console.warn("[Rewild] Forest Ground download unavailable:", filename, String(error));
  }
}

console.info("[Rewild] Forest Ground preparation complete. Missing files use in-game fallback textures.");
