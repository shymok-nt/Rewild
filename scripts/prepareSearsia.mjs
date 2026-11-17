import { mkdir, stat, writeFile, readdir, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
const root = join(process.cwd(), "public", "models", "searsia_lucida");
const files = ["searsia_lucida_1k.gltf", "searsia_lucida.bin",
  "textures/searsia_lucida_nor_gl_1k.jpg",
  "textures/searsia_lucida_diff_1k.jpg",
  "textures/searsia_lucida_arm_1k.jpg"];
const base = "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/searsia_lucida/";
await mkdir(root, { recursive: true });
// Install the original ZIP automatically when it is in the Windows Downloads folder.
if (process.platform === "win32") {
  for (const directory of [process.cwd(), join(homedir(), "Downloads"), join(homedir(), "Desktop")]) {
    let names = [];
    try { names = await readdir(directory); } catch { continue; }
    const zip = names.find(name => /^searsia_lucida.*\.zip$/i.test(name));
    if (!zip) continue;
    const staging = join(tmpdir(), "rewild-searsia-" + process.pid);
    try {
      const archive = join(directory, zip).replaceAll("'", "''");
      const destination = staging.replaceAll("'", "''");
      execFileSync("powershell.exe", ["-NoProfile", "-Command",
        "Expand-Archive -LiteralPath '" + archive + "' -DestinationPath '" + destination + "' -Force"], { stdio: "ignore", timeout: 90000 });
      const locate = async folder => {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
          const full = join(folder, entry.name);
          if (entry.isDirectory()) { const nested = await locate(full); if (nested) return nested; }
          else if (entry.name === "searsia_lucida_1k.gltf") return folder;
        }
        return null;
      };
      const source = await locate(staging);
      if (source) {
        for (const file of files) {
          const target = join(root, file);
          await mkdir(dirname(target), { recursive: true });
          await copyFile(join(source, file), target);
        }
        console.info("[Rewild] Searsia archive installed:", zip);
      }
    } catch (error) { console.warn("[Rewild] Searsia ZIP extraction failed:", String(error)); }
    finally { await rm(staging, { recursive: true, force: true }); }
    break;
  }
}
const cached = await Promise.all(files.map(async file => {
  try { return (await stat(join(root, file))).size > 100; } catch { return false; }
}));
if (cached.every(Boolean)) {
  console.info("[Rewild] Searsia cache ready");
  process.exit(0);
}
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
