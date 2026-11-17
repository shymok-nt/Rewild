import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Lightweight nearby 3D grass: one shared mesh and bounded thin instances.
 * Distant coverage is handled by the meadow texture.
 */
export function createGrassPrototype(scene: Scene): void {
  const mesh = new Mesh("grass-prototype-source", scene);
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  let seed = 81271;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Curved, tapered leaf strips with two vertical segments; no square cards.
  // A tuft is deliberately low-poly and small enough to blend with the ground.
  for (let blade = 0; blade < 15; blade++) {
    const angle = random() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const px = (random() - 0.5) * 0.27;
    const pz = (random() - 0.5) * 0.27;
    const height = 0.23 + random() * 0.29;
    const width = 0.018 + random() * 0.017;
    const lean = 0.11 + random() * 0.18;
    const tangentX = -dz;
    const tangentZ = dx;
    const base = positions.length / 3;
    for (const [t, w] of [[0, 1], [0.55, 0.7], [1, 0]] as const) {
      const bend = lean * t * t;
      const x = px + dx * bend;
      const z = pz + dz * bend;
      const y = 0.012 + height * t;
      positions.push(x - tangentX * width * w, y, z - tangentZ * width * w);
      positions.push(x + tangentX * width * w, y, z + tangentZ * width * w);
      const shade = 0.82 + random() * 0.18;
      const tip = t * 0.10;
      for (let side = 0; side < 2; side++) {
        colors.push((0.32 + tip) * shade, (0.48 + tip) * shade, (0.25 + tip * 0.5) * shade, 1);
      }
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    indices.push(base + 2, base + 3, base + 4, base + 3, base + 5, base + 4);
  }
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.colors = colors;
  data.applyToMesh(mesh);

  const material = new StandardMaterial("grass-prototype-material", scene);
  material.diffuseColor = new Color3(1.15, 1.25, 1.08);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  mesh.alwaysSelectAsActiveMesh = true;

  // A capped, deterministic moving window. Never allocate geometry per tuft.
  // Update only when the player crosses a grid cell, not on camera rotation.
  const SPACING = 0.72;
  const RADIUS = 9;
  const MAX_TUFTS = 220;
  let previousX = Infinity;
  let previousZ = Infinity;
  const update = () => {
    const player = scene.getTransformNodeByName("player-root");
    const px = player?.position.x ?? 0;
    const pz = player?.position.z ?? 9;
    const cellX = Math.floor(px / 1.5);
    const cellZ = Math.floor(pz / 1.5);
    if (cellX === previousX && cellZ === previousZ) return;
    previousX = cellX;
    previousZ = cellZ;
    const buffer = new Float32Array(MAX_TUFTS * 16);
    let count = 0;
    const centerX = Math.floor(px / SPACING);
    const centerZ = Math.floor(pz / SPACING);
    for (let gx = centerX - 13; gx <= centerX + 13; gx++) {
      for (let gz = centerZ - 13; gz <= centerZ + 13; gz++) {
        if (count >= MAX_TUFTS) break;
        let hash = (Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663) ^ 0x51f15e) >>> 0;
        const rand = () => {
          hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
          return hash / 4294967296;
        };
        const x = gx * SPACING + (rand() - 0.5) * 0.3;
        const z = gz * SPACING + (rand() - 0.5) * 0.3;
        const distance = Math.hypot(x - px, z - pz);
        if (distance > RADIUS) continue;
        // Deterministic sparse distribution avoids a solid dark circular carpet.
        if (rand() > 0.56) continue;
        if (Math.abs(x) > 68 || Math.abs(z) > 68) continue;
        // Preserve the path, cottage, and spawn clearing.
        if (Math.abs(x) < 4.3 && Math.abs(z) < 7.5) continue;
        if (Math.abs(x + 12) < 8 && Math.abs(z - 46) < 7) continue;
        if (z >= 8 && z <= 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 2.0) continue;
        const fade = Math.min(1, Math.max(0.08, (RADIUS - distance) / 3.5));
        const size = (0.48 + rand() * 0.37) * fade;
        Matrix.Compose(
          new Vector3(size, size, size),
          Quaternion.RotationAxis(Vector3.Up(), rand() * Math.PI * 2),
          new Vector3(x, 0.02, z),
        ).copyToArray(buffer, count * 16);
        count++;
      }
    }
    mesh.thinInstanceSetBuffer("matrix", buffer.subarray(0, count * 16), 16, true);
    mesh.thinInstanceRefreshBoundingInfo();
  };
  update();
  let elapsed = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    if (elapsed < 0.25) return;
    elapsed = 0;
    update();
  });
  scene.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(observer));
  console.info("[Rewild] Stylized nearby grass enabled, max", MAX_TUFTS, "tufts");
}
