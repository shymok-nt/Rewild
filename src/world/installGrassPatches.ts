import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

/** Tiny tapered 3D blades: one source mesh, one material, bounded GPU instances. */
export function installGrassPatches(scene: Scene, forest: readonly ForestTree[]): void {
  const grass = new Mesh("stylized-grass-source", scene);
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  // Three thin tapered blades per tuft, not upright rectangular billboards.
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI * 2 / 3;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const base = positions.length / 3;
    const height = 0.24 + blade * 0.055;
    const spread = 0.075;
    positions.push(-dx * spread, 0.012, -dz * spread,
      dx * spread, 0.012, dz * spread,
      dx * 0.035, height, dz * 0.035);
    indices.push(base, base + 1, base + 2);
    const shade = [0.78, 0.9, 1][blade];
    for (let i = 0; i < 3; i++) colors.push(0.36 * shade, 0.53 * shade, 0.29 * shade, 1);
  }
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(grass);
  const material = new StandardMaterial("stylized-grass-material", scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  grass.material = material;
  grass.isPickable = false;
  grass.alwaysSelectAsActiveMesh = true;

  // The existing ground texture provides inexpensive coverage at long range.
  // Only 420 tiny tufts are rendered around the player, in a single draw batch.
  const MAX_TUFTS = 420;
  let lastX = Infinity;
  let lastZ = Infinity;
  const update = () => {
    const root = scene.getTransformNodeByName("player-root");
    const px = root?.position.x ?? 0;
    const pz = root?.position.z ?? 9;
    if (Math.hypot(px - lastX, pz - lastZ) < 2.5) return;
    lastX = px;
    lastZ = pz;
    const matrices = new Float32Array(MAX_TUFTS * 16);
    let count = 0;
    // Deterministic global grid: tufts do not jump when the camera moves.
    const spacing = 1.05;
    const cx = Math.floor(px / spacing);
    const cz = Math.floor(pz / spacing);
    for (let gx = cx - 12; gx <= cx + 12; gx++) {
      for (let gz = cz - 12; gz <= cz + 12; gz++) {
        if (count >= MAX_TUFTS) break;
        let seed = (Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663) ^ 0x51f15e) >>> 0;
        const random = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        const x = gx * spacing + (random() - 0.5) * 0.6;
        const z = gz * spacing + (random() - 0.5) * 0.6;
        if ((x - px) ** 2 + (z - pz) ** 2 > 12 * 12) continue;
        if (Math.abs(x) > 68 || Math.abs(z) > 68) continue;
        if (Math.abs(x) < 4.3 && Math.abs(z) < 7.5) continue;
        if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 7) continue;
        if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 2.5) continue;
        if (forest.some(tree => Math.hypot(x - tree.x, z - tree.z) < 1.5 * tree.scale)) continue;
        const scale = 0.75 + random() * 0.55;
        const matrix = Matrix.Compose(
          new Vector3(scale, scale, scale),
          Quaternion.RotationAxis(Vector3.Up(), random() * Math.PI * 2),
          new Vector3(x, 0.015, z),
        );
        matrix.copyToArray(matrices, count * 16);
        count++;
      }
    }
    grass.thinInstanceSetBuffer("matrix", matrices.subarray(0, count * 16), 16, true);
  };
  update();
  let elapsed = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    if (elapsed < 0.5) return;
    elapsed = 0;
    update();
  });
  scene.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(observer));
  console.info("[Rewild] Procedural low-cost stylized grass enabled");
}
