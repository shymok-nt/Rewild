import { validImportedMeshes } from "./validateImportedMeshes";
import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

function randomAt(x: number, z: number, salt = 0): number {
  let n = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ salt) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 2246822519) >>> 0;
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}
function protectedArea(x: number, z: number): boolean {
  if (Math.abs(x) > 67 || Math.abs(z) > 67) return true;
  if (Math.abs(x) < 5.5 && Math.abs(z) < 9) return true;
  if (Math.abs(x + 12) < 9 && Math.abs(z - 46) < 9) return true;
  if (z > 6 && z < 60 && Math.abs(x - Math.sin(z * 0.12) * 3) < 3.2) return true;
  return false;
}

/** Natural fern colonies: denser near trees, occasional small patches in clearings. */
export async function installFernForest(scene: Scene, trees: readonly ForestTree[]): Promise<void> {
  try {
    const result = await SceneLoader.ImportMeshAsync("", "/models/fern_02/", "fern_02_1k.gltf", scene);
    if (scene.isDisposed) return;
    const sources = validImportedMeshes(result.meshes, "Fern 02");
    if (!sources.length) throw new Error("Fern asset has no renderable meshes");

    // Preserve the glTF source hierarchy transforms when creating instances.
    const parts = sources.map(mesh => {
      mesh.computeWorldMatrix(true);
      const scale = new Vector3();
      const rotation = new Quaternion();
      const position = new Vector3();
      mesh.getWorldMatrix().decompose(scale, rotation, position);
      return { mesh, scale, rotation, position };
    });
    const anchors: TransformNode[] = [];
    const MAX_PLANTS = 180;
    let count = 0;
    const place = (x: number, z: number, size: number, angle: number, variant: number) => {
      if (count >= MAX_PLANTS || protectedArea(x, z)) return;
      const anchor = new TransformNode("fern-colony-" + count, scene);
      anchor.position.set(x, 0.015, z);
      anchor.scaling.setAll(size);
      anchor.rotation.y = angle;
      // A model may have multiple material submeshes. Keep all parts together.
      // Original glTF transforms are baked into each part's instance transform.
      for (const part of parts) {
        const instance = part.mesh.createInstance("fern-leaf-" + count + "-" + part.mesh.name);
        instance.parent = anchor;
        instance.position.copyFrom(part.position);
        instance.rotationQuaternion = part.rotation.clone();
        instance.scaling.copyFrom(part.scale);
        instance.isPickable = false;
        instance.receiveShadows = false;
      }
      // Use variant to slightly alter silhouette without duplicating geometry.
      anchor.rotation.y += variant * 0.34;
      anchors.push(anchor);
      count++;
    };

    for (let i = 0; i < trees.length && count < MAX_PLANTS; i++) {
      const tree = trees[i];
      if (randomAt(i, 31) < 0.22) continue;
      const patches = 1 + Math.floor(randomAt(i, 47) * 2);
      for (let patch = 0; patch < patches; patch++) {
        const direction = randomAt(i, patch, 18) * Math.PI * 2;
        const distance = 2.4 + randomAt(i, patch, 32) * 3.2;
        const cx = tree.x + Math.cos(direction) * distance;
        const cz = tree.z + Math.sin(direction) * distance;
        const plants = 3 + Math.floor(randomAt(i, patch, 49) * 5);
        for (let j = 0; j < plants; j++) {
          const a = randomAt(i * 17 + patch, j, 51) * Math.PI * 2;
          const d = Math.sqrt(randomAt(i * 23 + patch, j, 71)) * 1.6;
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          const size = 0.62 + randomAt(i * 19 + patch, j, 91) * 0.52;
          place(x, z, size, a, j);
        }
      }
    }
    // A few isolated colonies break up empty meadow without uniform grid spacing.
    for (let i = 0; i < 55 && count < MAX_PLANTS; i++) {
      const cx = -62 + randomAt(i, 110) * 124;
      const cz = -62 + randomAt(i, 111) * 124;
      if (protectedArea(cx, cz)) continue;
      const plants = 2 + Math.floor(randomAt(i, 112) * 4);
      for (let j = 0; j < plants; j++) {
        const a = randomAt(i, j, 113) * Math.PI * 2;
        const d = Math.sqrt(randomAt(i, j, 114)) * 1.4;
        place(cx + Math.cos(a) * d, cz + Math.sin(a) * d,
          0.56 + randomAt(i, j, 115) * 0.47, a, j);
      }
    }
    for (const part of parts) part.mesh.isVisible = false;
    console.info("[Rewild] Fern 02 natural colonies ready:", count, "plants");
  } catch (error) {
    console.warn("[Rewild] Fern 02 unavailable; forest remains playable:", error);
  }
}
