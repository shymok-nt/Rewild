import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";
import { CHUNK_SIZE, createChunkStream } from "./chunkStream";

/** Stream one grass mesh per chunk; shared geometry, deterministic positions. */
export async function installGrassPatches(scene: Scene, forest: readonly ForestTree[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "grass.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("grass.glb contains no renderable mesh");
  const vertices = meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0);
  if (vertices > 180000) {
    for (const node of result.meshes) node.dispose(false, true);
    console.warn("[Rewild] Grass exceeds safe geometry budget", vertices);
    return;
  }
  // A single source mesh per chunk is intentional. Multi-part GLBs need an
  // offline merged/atlased grass asset to preserve all parts in one draw call.
  const source = meshes.reduce((a, b) => a.getTotalVertices() >= b.getTotalVertices() ? a : b);
  source.computeWorldMatrix(true);
  const originalWorld = source.getWorldMatrix().clone();
  const box = source.getBoundingInfo().boundingBox;
  const min = box.minimumWorld;
  const max = box.maximumWorld;
  const width = Math.max(max.x - min.x, max.z - min.z, 0.001);
  const scale = Math.min(4, Math.max(0.015, 1.4 / width));
  const offset = Matrix.Translation(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
  source.parent = null;
  source.position.setAll(0);
  source.rotationQuaternion = null;
  source.rotation.setAll(0);
  source.scaling.setAll(1);
  for (const mesh of meshes) if (mesh !== source) mesh.isVisible = false;
  source.isPickable = false;
  const getHeight = (_x: number, _z: number) => 0; // Current terrain is a flat ground plane.
  const stream = createChunkStream(scene, source, () => {
    const root = scene.getTransformNodeByName("player-root");
    return { x: root?.position.x ?? 0, z: root?.position.z ?? 9 };
  }, (cx, cz, lod, random) => {
    const matrices: Matrix[] = [];
    const count = Math.min(85, Math.floor(65 * lod));
    for (let i = 0; i < count; i++) {
      const x = cx * CHUNK_SIZE + random() * CHUNK_SIZE;
      const z = cz * CHUNK_SIZE + random() * CHUNK_SIZE;
      if (Math.abs(x) > 68 || Math.abs(z) > 68) continue;
      if (Math.abs(x) < 4.3 && Math.abs(z) < 7.5) continue;
      if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 7) continue;
      if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 2.5) continue;
      if (forest.some(tree => Math.hypot(x - tree.x, z - tree.z) < 1.5 * tree.scale)) continue;
      const rotation = Quaternion.RotationAxis(Vector3.Up(), random() * Math.PI * 2);
      const factor = scale * (0.8 + random() * 0.4);
      const transform = Matrix.Compose(new Vector3(factor, factor, factor), rotation,
        new Vector3(x, getHeight(x, z) + 0.025, z));
      matrices.push(originalWorld.multiply(offset.multiply(transform)));
    }
    return matrices;
  }, { bounds: 68 });
  console.info("[Rewild] Grass chunk streaming enabled", vertices, "source vertices");
  scene.onDisposeObservable.add(() => stream.dispose());
}
