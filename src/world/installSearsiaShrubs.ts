import { validImportedMeshes } from "./validateImportedMeshes";
import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
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
    // One tiny shared geometry replaces the seven-part high-poly shrub in mid-distance.
    // The low LOD keeps a green silhouette without submitting all source parts.
    const lowMaterial = new StandardMaterial("searsia-low-lod-material", scene);
    lowMaterial.diffuseColor = new Color3(0.25, 0.39, 0.22);
    lowMaterial.specularColor = Color3.Black();
    const lowSource = MeshBuilder.CreateSphere("searsia-low-lod-source", {
      diameter: 1, segments: 5,
    }, scene);
    lowSource.material = lowMaterial;
    lowSource.isVisible = false;
    lowSource.isPickable = false;
    const colonies: { anchor: TransformNode; proxy: import("@babylonjs/core/Meshes/instancedMesh").InstancedMesh; x: number; z: number; state: number }[] = [];
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
      const proxy = lowSource.createInstance("searsia-low-lod-" + count);
      proxy.position.set(x, 0.62 * scale, z);
      proxy.scaling.set(2.1 * scale, 1.8 * scale, 1.9 * scale);
      proxy.isPickable = false;
      proxy.receiveShadows = false;
      proxy.isVisible = false;
      colonies.push({ anchor, proxy, x, z, state: -1 });
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
    // Three states: 0 = near original GLTF, 1 = cheap proxy, 2 = culled.
    // Hysteresis avoids LOD thrashing when the player hovers at a boundary.
    const NEAR_IN_SQ = 9 * 9, NEAR_OUT_SQ = 13 * 13;
    const FAR_IN_SQ = 37 * 37, FAR_OUT_SQ = 42 * 42;
    let elapsed = 1000;
    const observer = scene.onBeforeRenderObservable.add(() => {
      elapsed += Math.min(scene.getEngine().getDeltaTime(), 100);
      if (elapsed < 350) return;
      elapsed = 0;
      const camera = scene.activeCamera;
      if (!camera) return;
      const px = camera.globalPosition.x, pz = camera.globalPosition.z;
      for (const colony of colonies) {
        const dx = colony.x - px, dz = colony.z - pz;
        const distanceSq = dx * dx + dz * dz;
        const next = colony.state === 0
          ? (distanceSq > NEAR_OUT_SQ ? 1 : 0)
          : colony.state === 1
            ? (distanceSq < NEAR_IN_SQ ? 0 : distanceSq > FAR_OUT_SQ ? 2 : 1)
            : (distanceSq < NEAR_IN_SQ ? 0 : distanceSq < FAR_IN_SQ ? 1 : 2);
        if (next === colony.state) continue;
        colony.anchor.setEnabled(next === 0);
        colony.proxy.isVisible = next === 1;
        colony.state = next;
      }
    });
    scene.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observer));
    console.info("[Rewild] Searsia shrubs ready:", count, "plants,", meshes.length, "mesh parts");
  } catch (error) {
    console.warn("[Rewild] Searsia shrubs unavailable; keeping existing forest:", error);
  }
}
