import { validImportedMeshes } from "./validateImportedMeshes";
import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

function rand(a: number, b: number, salt = 0): number {
  let x = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822519) >>> 0;
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}
function clear(x: number, z: number): boolean {
  return Math.abs(x) > 66 || Math.abs(z) > 66 ||
    (Math.abs(x) < 7 && Math.abs(z) < 10) ||
    (Math.abs(x + 12) < 10 && Math.abs(z - 46) < 10) ||
    (z > 6 && z < 60 && Math.abs(x - Math.sin(z * 0.12) * 3) < 4);
}
export async function installSearsiaShrubs(scene: Scene, trees: readonly ForestTree[]): Promise<void> {
  try {
    // Prefer the locally prepared model; if the asset preparation failed,
    // fetch the public Poly Haven glTF directly instead of leaving the scene empty.
    const localRoot = "/models/searsia_lucida/";
    const remoteRoot = "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/searsia_lucida/";
    let root = localRoot;
    try {
      const response = await fetch(localRoot + "searsia_lucida_1k.gltf", { method: "HEAD" });
      if (!response.ok) root = remoteRoot;
    } catch { root = remoteRoot; }
    let result;
    try {
      result = await SceneLoader.ImportMeshAsync("", root, "searsia_lucida_1k.gltf", scene);
    } catch (error) {
      if (root === remoteRoot) throw error;
      console.warn("[Rewild] Local Searsia assets incomplete; retrying Poly Haven source");
      result = await SceneLoader.ImportMeshAsync("", remoteRoot, "searsia_lucida_1k.gltf", scene);
    }
    if (scene.isDisposed) return;
    const meshes = validImportedMeshes(result.meshes, "Searsia");
    if (!meshes.length) throw new Error("Searsia glTF has no geometry");
    const parts = meshes.map(mesh => {
      mesh.computeWorldMatrix(true);
      const scale = new Vector3(), rotation = new Quaternion(), position = new Vector3();
      mesh.getWorldMatrix().decompose(scale, rotation, position);
      return { mesh, scale, rotation, position };
    });
    const colonies: { anchor: TransformNode; x: number; z: number; baseScale: number; fade: number }[] = [];
    let count = 0;
    const MAX_SHRUBS = 24;
    const plant = (x: number, z: number, scale: number, angle: number) => {
      if (clear(x, z) || count >= MAX_SHRUBS) return;
      const anchor = new TransformNode("searsia-shrub-" + count, scene);
      anchor.position.set(x, 0.015, z);
      anchor.scaling.setAll(scale);
      anchor.rotation.y = angle;
      for (const part of parts) {
        const instance = part.mesh.createInstance("searsia-part-" + count + "-" + part.mesh.name);
        instance.parent = anchor;
        instance.position.copyFrom(part.position);
        instance.rotationQuaternion = part.rotation.clone();
        instance.scaling.copyFrom(part.scale);
        instance.isPickable = false;
        instance.receiveShadows = false;
      }
      colonies.push({ anchor, x, z, baseScale: scale, fade: 1 });
      count++;
    };
    for (let i = 0; i < trees.length && count < MAX_SHRUBS; i++) {
      if (rand(i, 3) > 0.58) continue;
      const tree = trees[i];
      const groups = 1 + (rand(i, 4) > 0.78 ? 1 : 0);
      for (let g = 0; g < groups; g++) {
        const a = rand(i, g, 5) * Math.PI * 2;
        const d = 3.8 + rand(i, g, 6) * 3.8;
        const cx = tree.x + Math.cos(a) * d;
        const cz = tree.z + Math.sin(a) * d;
        const n = 2 + Math.floor(rand(i, g, 7) * 3);
        for (let j = 0; j < n; j++) {
          const angle = rand(i * 7 + g, j, 8) * Math.PI * 2;
          const radius = Math.sqrt(rand(i * 11 + g, j, 9)) * 2.2;
          plant(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius,
            0.45 + rand(i * 13 + g, j, 10) * 0.38, angle);
        }
      }
    }
    for (const part of parts) part.mesh.isVisible = false;
    // Soft distance transition: keep the original shrub geometry and materials.
    // No sphere impostors or transparent leaf layers (which increase overdraw).
    // Ease the whole colony out over a wide distance band, then disable it.
    const FADE_START = 32;
    const FADE_END = 49;
    const MIN_SCALE = 0.001;
    const smoothstep = (value: number) => {
      const t = Math.max(0, Math.min(1, value));
      return t * t * (3 - 2 * t);
    };
    let elapsed = 0;
    const observer = scene.onBeforeRenderObservable.add(() => {
      const camera = scene.activeCamera;
      if (!camera) return;
      const delta = Math.min(scene.getEngine().getDeltaTime(), 100) / 1000;
      elapsed += delta;
      // At most 20 updates/sec. Interpolation avoids noticeable popping
      // when sprinting or turning the camera near the fade boundary.
      if (elapsed < 0.05) return;
      const step = Math.min(elapsed, 0.15);
      elapsed = 0;
      const px = camera.globalPosition.x, pz = camera.globalPosition.z;
      for (const colony of colonies) {
        const distance = Math.hypot(colony.x - px, colony.z - pz);
        const target = 1 - smoothstep((distance - FADE_START) / (FADE_END - FADE_START));
        const blend = 1 - Math.exp(-step * 9);
        colony.fade += (target - colony.fade) * blend;
        if (Math.abs(colony.fade - target) < 0.002) colony.fade = target;
        const visible = colony.fade > 0.005;
        if (colony.anchor.isEnabled() !== visible) colony.anchor.setEnabled(visible);
        if (visible) colony.anchor.scaling.setAll(colony.baseScale * Math.max(MIN_SCALE, colony.fade));
      }
    });
    scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observer));
    console.info("[Rewild] Searsia shrubs ready:", count, "plants,", meshes.length, "mesh parts");
  } catch (error) {
    console.warn("[Rewild] Searsia shrubs unavailable; keeping existing forest:", error);
  }
}
