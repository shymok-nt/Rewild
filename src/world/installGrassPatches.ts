import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

/** Decorative grass only: no colliders or physics cost. */
export async function installGrassPatches(scene: Scene, forest: readonly ForestTree[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "grass.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Grass GLB has no renderable meshes");
  const vertexCount = meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0);
  if (vertexCount > 180000 || meshes.length > 20) {
    for (const mesh of result.meshes) mesh.dispose(false, true);
    console.warn("[Rewild] Grass model too complex for safe preview:", vertexCount, "vertices,", meshes.length, "parts");
    return;
  }

  const parts = meshes.map(mesh => {
    mesh.computeWorldMatrix(true);
    const scaling = new Vector3();
    const rotation = new Quaternion();
    const position = new Vector3();
    mesh.getWorldMatrix().decompose(scaling, rotation, position);
    return { mesh, scaling, rotation, position };
  });

  // Derive a sensible patch scale from the actual GLB dimensions.
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld);
    max = Vector3.Maximize(max, box.maximumWorld);
  }
  const size = max.subtract(min);
  const horizontal = Math.max(size.x, size.z, 0.001);
  const modelScale = Math.min(4, Math.max(0.015, 1.35 / horizontal));
  // The base of the model should sit at y=0, not below the terrain.
  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;

  let state = 745123;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const created: TransformNode[] = [];
  try {
    for (let i = 0, attempts = 0; i < 12 && attempts < 120; attempts++) {
      const x = (random() - 0.5) * 123;
      const z = (random() - 0.5) * 123;
      // Keep the spawn area, cabin, ruins, gathering sites and winding trail clear.
      if (Math.abs(x) < 7 && Math.abs(z) < 12) continue;
      if (Math.abs(x + 12) < 9 && Math.abs(z - 46) < 8) continue;
      if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 4.2) continue;
      if (forest.some(tree => Math.hypot(x - tree.x, z - tree.z) < 2.1 * tree.scale)) continue;
      const anchor = new TransformNode("grass-patch-" + i, scene);
      anchor.position.set(x, 0.015, z);
      anchor.rotation.y = random() * Math.PI * 2;
      anchor.scaling.setAll(modelScale * (0.72 + random() * 0.55));
      const center = new TransformNode("grass-offset-" + i, scene);
      center.parent = anchor;
      center.position.set(-centerX, -min.y, -centerZ);
      for (const part of parts) {
        const instance = part.mesh.createInstance("grass-" + i + "-" + part.mesh.name);
        instance.parent = center;
        instance.position.copyFrom(part.position);
        instance.rotationQuaternion = part.rotation.clone();
        instance.scaling.copyFrom(part.scaling);
        instance.isPickable = false;
      }
      created.push(anchor);
      i++;
    }
    // Hide GLB originals only once all instances are created successfully.
    for (const part of parts) part.mesh.isVisible = false;
    console.info("[Rewild] Grass GLB ready:", created.length, "patches");
  } catch (error) {
    for (const node of created) node.dispose(false, true);
    for (const mesh of result.meshes) mesh.dispose(false, true);
    throw error;
  }
}
