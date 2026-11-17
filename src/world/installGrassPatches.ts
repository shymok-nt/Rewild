import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

type Patch = { x: number; z: number; matrix: Matrix; cheap: Matrix };
function makeLowPolyGrass(scene: Scene): Mesh {
  const mesh = new Mesh("grass-medium-lod-source", scene);
  // Three crossed, tapered blades, only 3 triangles per clump.
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI / 3;
    const dx = Math.cos(angle) * 0.38;
    const dz = Math.sin(angle) * 0.38;
    const start = positions.length / 3;
    positions.push(-dx, 0.03, -dz, dx, 0.03, dz, 0, 0.88 + i * 0.12, 0);
    indices.push(start, start + 1, start + 2);
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const material = new StandardMaterial("grass-medium-lod-mat", scene);
  material.diffuseColor = new Color3(0.32, 0.47, 0.25);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

/** Dense world coverage: GLB near player, cheap 9-triangle LOD farther away,
 * and existing meadow material at the horizon. Geometry is never duplicated. */
export async function installGrassPatches(scene: Scene, forest: readonly ForestTree[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "grass.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Grass GLB has no visible meshes");
  const vertices = meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0);
  if (vertices > 180000 || meshes.length > 20) {
    for (const mesh of result.meshes) mesh.dispose(false, true);
    console.warn("[Rewild] Grass GLB exceeds safe geometry budget:", vertices);
    return;
  }
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  const parts = meshes.map(mesh => {
    mesh.computeWorldMatrix(true);
    const world = mesh.getWorldMatrix().clone();
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld);
    max = Vector3.Maximize(max, box.maximumWorld);
    return { mesh, world };
  });
  const width = Math.max(max.x - min.x, max.z - min.z, 0.001);
  const baseScale = Math.min(4, Math.max(0.015, 2.1 / width));
  const offset = Matrix.Translation(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
  const mediumMesh = makeLowPolyGrass(scene);

  let seed = 745123;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const patches: Patch[] = [];
  const spacing = 1.7;
  for (let gx = -40; gx <= 40; gx++) {
    for (let gz = -40; gz <= 40; gz++) {
      const x = gx * spacing + (random() - 0.5) * 0.6;
      const z = gz * spacing + (random() - 0.5) * 0.6;
      if (Math.abs(x) > 68 || Math.abs(z) > 68) continue;
      if (Math.abs(x) < 4.3 && Math.abs(z) < 7.5) continue;
      if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 7) continue;
      if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 2.5) continue;
      if (forest.some(tree => Math.hypot(x - tree.x, z - tree.z) < 1.5 * tree.scale)) continue;
      const rotation = Quaternion.RotationAxis(Vector3.Up(), random() * Math.PI * 2);
      const scale = baseScale * (0.85 + random() * 0.3);
      const position = new Vector3(x, 0.035, z);
      patches.push({
        x, z,
        matrix: offset.multiply(Matrix.Compose(new Vector3(scale, scale, scale), rotation, position)),
        cheap: Matrix.Compose(new Vector3(1.1, 1, 1.1), rotation, position),
      });
    }
  }

  for (const part of parts) {
    part.mesh.parent = null;
    part.mesh.position.setAll(0);
    part.mesh.rotation.setAll(0);
    part.mesh.rotationQuaternion = null;
    part.mesh.scaling.setAll(1);
    part.mesh.isPickable = false;
    part.mesh.alwaysSelectAsActiveMesh = true;
  }

  // Hard geometry budget: keep detailed GLB triangles under control.
  const maxNear = Math.min(180, Math.max(24, Math.floor(450000 / Math.max(vertices, 1))));
  const maxMedium = 1500;
  let nearLimit = maxNear;
  let mediumLimit = maxMedium;
  let averageFps = 60;
  let lastX = Infinity;
  let lastZ = Infinity;
  let dirty = true;

  const update = () => {
    if (scene.isDisposed) return;
    const root = scene.getTransformNodeByName("player-root");
    const x = root?.position.x ?? 0;
    const z = root?.position.z ?? 9;
    if (!dirty && Math.hypot(x - lastX, z - lastZ) < 2) return;
    dirty = false;
    lastX = x;
    lastZ = z;
    const nearby = patches
      .map(patch => ({ patch, distance: (patch.x - x) ** 2 + (patch.z - z) ** 2 }))
      .filter(item => item.distance < 32 * 32)
      .sort((a, b) => a.distance - b.distance);
    // Near radius scales with the budget so detailed patches do not become sparse.
    const nearRadius = Math.min(13, Math.max(4.5, Math.sqrt(nearLimit / Math.PI) * spacing * 0.9));
    const near = nearby.filter(item => item.distance < nearRadius ** 2).slice(0, nearLimit);
    const selected = new Set(near.map(item => item.patch));
    const medium = nearby.filter(item => !selected.has(item.patch)).slice(0, mediumLimit);
    for (const part of parts) {
      const matrices = new Float32Array(near.length * 16);
      near.forEach((item, i) => part.world.multiply(item.patch.matrix).copyToArray(matrices, i * 16));
      part.mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    }
    const mediumMatrices = new Float32Array(medium.length * 16);
    medium.forEach((item, i) => item.patch.cheap.copyToArray(mediumMatrices, i * 16));
    mediumMesh.thinInstanceSetBuffer("matrix", mediumMatrices, 16, true);
  };
  update();
  let elapsed = 0;
  let adjustment = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    elapsed += dt;
    adjustment += dt;
    if (dt > 0) averageFps = averageFps * 0.95 + Math.min(100, 1 / dt) * 0.05;
    if (adjustment >= 3) {
      adjustment = 0;
      if (averageFps < 43) {
        nearLimit = Math.max(16, Math.floor(nearLimit * 0.8));
        mediumLimit = Math.max(350, Math.floor(mediumLimit * 0.85));
        dirty = true;
      } else if (averageFps > 57) {
        nearLimit = Math.min(maxNear, Math.ceil(nearLimit * 1.08));
        mediumLimit = Math.min(maxMedium, Math.ceil(mediumLimit * 1.08));
        dirty = true;
      }
    }
    if (elapsed >= 0.5) {
      elapsed = 0;
      update();
    }
  });
  scene.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(observer));
  console.info("[Rewild] Three-tier grass LOD:", patches.length, "world patches; near cap", maxNear, "medium cap", maxMedium);
}
