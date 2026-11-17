import { mkdir, access, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
const root = join(process.cwd(), "public", "models", "fern_02");
const base = "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/fern_02";
const files = ["fern_02_1k.gltf", "fern_02.bin",
  "textures/fern_02_arm_1k.jpg", "textures/fern_02_diff_1k.jpg",
  "textures/fern_02_nor_gl_1k.jpg"];
await mkdir(join(root, "textures"), { recursive: true });
for (const file of files) {
  const target = join(root, file);
  try { await access(target); continue; } catch { /* missing */ }
  try {
    const response = await fetch(base + "/" + file, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error("Empty asset");
    await writeFile(target, bytes);
    console.info("[Rewild] Fern 02 prepared:", file);
  } catch (error) {
    await rm(target, { force: true });
    console.warn("[Rewild] Fern 02 unavailable:", file, String(error));
  }
}
