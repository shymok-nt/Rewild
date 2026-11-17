import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

function randomAt(x: number, z: number): number {
  let n = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ 0x5eeda) >>> 0;
  n = (Math.imul(n ^ (n >>> 16), 2246822519) >>> 0);
  return n / 4294967296;
}

/** Fern 02 has four variations. Instanced foliage stays inexpensive on iGPUs. */
export async function installFernForest(scene: Scene): Promise<void> {
  try {
    const result = await SceneLoader.ImportMeshAsync("", "/models/fern_02/", "fern_02_1k.gltf", scene);
    if (scene.isDisposed) return;
    const sources = result.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
    if (!sources.length) throw new Error("Fern asset contains no meshes");
    // Each glTF mesh has a different local position (four sample variations).
    // Copy its original world transform under a normalized root.
    const parts = sources.map(source => {
      source.computeWorldMatrix(true);
      return { source, position: source.absolutePosition.clone(),
        rotation: source.absoluteRotationQuaternion.clone(), scale: source.absoluteScaling.clone() };
    });
    const root = new TransformNode("fern-forest", scene);
    let count = 0;
    for (let gx = -65; gx <= 65; gx += 3) {
      for (let gz = -65; gz <= 65; gz += 3) {
        const seed = randomAt(gx, gz);
        if (seed < 0.57 || count >= 520) continue;
        const x = gx + (randomAt(gz, gx + 7) - 0.5) * 2.3;
        const z = gz + (randomAt(gx + 11, gz) - 0.5) * 2.3;
        if (Math.abs(x) < 6 && Math.abs(z) < 10) continue;
        if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 8) continue;
        if (z > 8 && z < 59 && Math.abs(x - Math.sin(z * 0.12) * 3) < 3.5) continue;
        const part = parts[Math.floor(randomAt(gx + 9, gz + 13) * parts.length)];
        const instance = part.source.createInstance("fern-" + count);
        instance.parent = root;
        instance.position.set(x, 0.02, z);
        const size = 0.8 + randomAt(gx + 19, gz - 5) * 0.65;
        instance.scaling.setAll(size);
        instance.rotation.y = randomAt(gz + 17, gx - 4) * Math.PI * 2;
        instance.isPickable = false;
        count++;
      }
    }
    for (const part of parts) part.source.isVisible = false;
    console.info("[Rewild] Fern 02 installed:", count, "instances");
  } catch (error) {
    console.warn("[Rewild] Fern 02 skipped; existing vegetation remains:", error);
  }
}
