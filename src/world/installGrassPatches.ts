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
  const baseScale = Math.min(4, Math.max(0.015, 2.4 / width));
  const center = new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2);
  // Generate coverage for the entire 140 x 140 meadow, not just the spawn.
  // Only a bounded set near the player is ever uploaded to the GPU.
  const visibleLimit = Math.min(420, Math.max(48, Math.floor(900000 / Math.max(vertices, 1))));
  let activeLimit = visibleLimit;
  let fpsAverage = 60;
  let qualityCooldown = 0;
  const cellSize = 1.65;
  let state = 745123;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const candidates: { x: number; z: number; transform: Matrix }[] = [];
  const offset = Matrix.Translation(-center.x, -center.y, -center.z);
  for (let gx = -41; gx <= 41; gx++) {
    for (let gz = -41; gz <= 41; gz++) {
      const x = gx * cellSize + (random() - 0.5) * 0.7;
      const z = gz * cellSize + (random() - 0.5) * 1.8;
      if (Math.abs(x) > 68 || Math.abs(z) > 68) continue;
      if (Math.abs(x) < 4.3 && Math.abs(z) < 7.5) continue;
      if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 7) continue;
      if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 2.5) continue;
      if (forest.some(tree => Math.hypot(x - tree.x, z - tree.z) < 1.5 * tree.scale)) continue;
      const scale = baseScale * (0.85 + random() * 0.3);
      const placement = Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.RotationAxis(Vector3.Up(), random() * Math.PI * 2),
        new Vector3(x, 0.025, z),
      );
      candidates.push({ x, z, transform: offset.multiply(placement) });
    }
  }

  // Preserve the imported geometry and materials; the original node hierarchy
  // is baked into each thin instance matrix.
  for (const part of parts) {
    part.mesh.parent = null;
    part.mesh.position.set(0, 0, 0);
    part.mesh.rotation.set(0, 0, 0);
    part.mesh.rotationQuaternion = null;
    part.mesh.scaling.setAll(1);
    part.mesh.isPickable = false;
    part.mesh.alwaysSelectAsActiveMesh = true;
  }

  let forceUpdate = true;
  let previousX = Infinity;
  let previousZ = Infinity;
  const update = () => {
    if (scene.isDisposed) return;
    const target = scene.getTransformNodeByName("player-root");
    const x = target?.position.x ?? 0;
    const z = target?.position.z ?? 9;
    if (Math.hypot(x - previousX, z - previousZ) < 1.5 && !forceUpdate) return;
    forceUpdate = false;
    previousX = x;
    previousZ = z;
    // Keep a fully populated local patch rather than sparse dots spread over 34m.
    // Larger source models use a smaller radius to stay inside the GPU budget.
    const radius = Math.min(27, Math.max(8, Math.sqrt(activeLimit / Math.PI) * cellSize * 0.88));
    const radiusSquared = radius * radius;
    const visible = candidates
      .filter(patch => (patch.x - x) ** 2 + (patch.z - z) ** 2 < radiusSquared)
      .sort((a, b) => ((a.x - x) ** 2 + (a.z - z) ** 2) -
        ((b.x - x) ** 2 + (b.z - z) ** 2))
      .slice(0, activeLimit);
    for (const part of parts) {
      const matrices = new Float32Array(visible.length * 16);
      visible.forEach((patch, i) => {
        part.originalWorld.multiply(patch.transform).copyToArray(matrices, i * 16);
      });
      part.mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    }
  };
  update();
  let elapsed = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    elapsed += dt;
    qualityCooldown += dt;
    if (dt > 0) fpsAverage = fpsAverage * 0.95 + Math.min(100, 1 / dt) * 0.05;
    if (qualityCooldown >= 3) {
      qualityCooldown = 0;
      const nextLimit = fpsAverage < 42 ? Math.max(32, Math.floor(activeLimit * 0.78))
        : fpsAverage > 57 ? Math.min(visibleLimit, Math.ceil(activeLimit * 1.08)) : activeLimit;
      if (nextLimit !== activeLimit) {
        activeLimit = nextLimit;
        forceUpdate = true;
      }
    }
    if (elapsed < 0.4) return;
    elapsed = 0;
    update();
  });
  scene.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(observer));
  console.info("[Rewild] Grass coverage:", candidates.length,
    "world patches; GPU limit:", visibleLimit, "source vertices:", vertices);
}
