import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

/** One GLB import, shared geometry and GPU thin instances, with no collisions. */
export async function installGrassPatches(scene: Scene, forest: readonly ForestTree[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "grass.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Grass GLB has no renderable meshes");
  const vertices = meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0);
  if (vertices > 180000 || meshes.length > 20) {
    for (const node of result.meshes) node.dispose(false, true);
    console.warn("[Rewild] Grass model too expensive:", vertices, "vertices");
    return;
  }

  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  const parts = meshes.map(mesh => {
    mesh.computeWorldMatrix(true);
    const originalWorld = mesh.getWorldMatrix().clone();
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld);
    max = Vector3.Maximize(max, box.maximumWorld);
    return { mesh, originalWorld };
  });
  const width = Math.max(max.x - min.x, max.z - min.z, 0.001);
  const baseScale = Math.min(4, Math.max(0.015, 1.3 / width));
  const center = new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2);
  // Thin instances draw all copies of a part in a single batch.
  // Cap total transformed vertices to avoid the previous browser crash.
  const count = Math.max(90, Math.min(700, Math.floor(2600000 / Math.max(vertices, 1))));
  let state = 745123;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const transforms: Matrix[] = [];
  for (let attempts = 0; transforms.length < count && attempts < count * 30; attempts++) {
    const i = transforms.length;
    const near = i < Math.floor(count * 0.65);
    const angle = random() * Math.PI * 2;
    const radius = 4 + Math.sqrt(random()) * 27;
    const x = near ? Math.cos(angle) * radius : (random() - 0.5) * 125;
    const z = near ? 9 + Math.sin(angle) * radius : (random() - 0.5) * 125;
    if (Math.abs(x) < 4.3 && Math.abs(z) < 7.5) continue;
    if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 7) continue;
    if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 2.5) continue;
    if (forest.some(tree => Math.hypot(x - tree.x, z - tree.z) < 1.5 * tree.scale)) continue;
    const scale = baseScale * (0.7 + random() * 0.65);
    const offset = Matrix.Translation(-center.x, -center.y, -center.z);
    const placement = Matrix.Compose(
      new Vector3(scale, scale, scale),
      Quaternion.RotationAxis(Vector3.Up(), random() * Math.PI * 2),
      new Vector3(x, 0.025, z),
    );
    transforms.push(offset.multiply(placement));
  }

  for (const part of parts) {
    // Remove imported hierarchy transforms from the source, preserving them
    // in each thin-instance matrix instead.
    const matrices = new Float32Array(transforms.length * 16);
    transforms.forEach((placement, i) => {
      part.originalWorld.multiply(placement).copyToArray(matrices, i * 16);
    });
    part.mesh.parent = null;
    part.mesh.position.set(0, 0, 0);
    part.mesh.rotation.set(0, 0, 0);
    part.mesh.rotationQuaternion = null;
    part.mesh.scaling.setAll(1);
    part.mesh.isPickable = false;
    part.mesh.alwaysSelectAsActiveMesh = true;
    part.mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
  }
  console.info("[Rewild] Grass thin instances:", transforms.length, "patches,", vertices, "vertices per source");
}
