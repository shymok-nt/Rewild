import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import type { ForestTree } from "./installOakForest";

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function excluded(x: number, z: number): boolean {
  return Math.abs(x) > 66 || Math.abs(z) > 66 ||
    (Math.abs(x) < 6.5 && Math.abs(z) < 10) ||
    (Math.abs(x + 12) < 9 && Math.abs(z - 46) < 9) ||
    (z > 7 && z < 59 && Math.abs(x - Math.sin(z * 0.12) * 3) < 3.1);
}
/** Three batched, non-interactive forest-floor meshes. No GLBs, shadows or per-frame work. */
export function installForestFloorDetails(scene: Scene, trees: readonly ForestTree[]): void {
  const rng = random(802331);
  const leafPositions: number[] = [], leafIndices: number[] = [], leafColors: number[] = [];
  const twigPositions: number[] = [], twigIndices: number[] = [], twigColors: number[] = [];
  const leafPalette = [[0.34, 0.27, 0.16], [0.42, 0.33, 0.20], [0.29, 0.32, 0.18], [0.46, 0.38, 0.22]];
  const addLeaf = (x: number, z: number, size: number, angle: number) => {
    const base = leafPositions.length / 3;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const nx = -dz, nz = dx;
    const w = size * (0.35 + rng() * 0.12);
    const y = 0.017 + rng() * 0.004;
    leafPositions.push(x - dx * size, y, z - dz * size,
      x - nx * w, y + 0.006, z - nz * w,
      x + dx * size, y, z + dz * size,
      x + nx * w, y + 0.006, z + nz * w);
    leafIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    const color = leafPalette[Math.floor(rng() * leafPalette.length)];
    for (let i = 0; i < 4; i++) leafColors.push(...color, 1);
  };
  const addTwig = (x: number, z: number, size: number, angle: number) => {
    const base = twigPositions.length / 3;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const nx = -dz * 0.018, nz = dx * 0.018;
    const y = 0.022;
    twigPositions.push(x - dx * size + nx, y, z - dz * size + nz,
      x - dx * size - nx, y, z - dz * size - nz,
      x + dx * size - nx, y, z + dz * size - nz,
      x + dx * size + nx, y, z + dz * size + nz);
    twigIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    for (let i = 0; i < 4; i++) twigColors.push(0.55, 0.37, 0.22, 1);
  };
  let leaves = 0, twigs = 0;
  // Naturally clustered around trees, not a repeated uniform carpet.
  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    for (let patch = 0; patch < 3; patch++) {
      const angle = rng() * Math.PI * 2;
      const distance = 2.1 + rng() * 5;
      const cx = tree.x + Math.cos(angle) * distance;
      const cz = tree.z + Math.sin(angle) * distance;
      for (let j = 0; j < 12; j++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 2.3;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (excluded(x, z)) continue;
        if (rng() < 0.82) { addLeaf(x, z, 0.055 + rng() * 0.065, a); leaves++; }
        else { addTwig(x, z, 0.09 + rng() * 0.13, a); twigs++; }
      }
    }
  }
  const build = (name: string, positions: number[], indices: number[], colors: number[]) => {
    if (!indices.length) return;
    const mesh = new Mesh(name, scene);
    const geometry = new VertexData();
    geometry.positions = positions;
    geometry.indices = indices;
    geometry.colors = colors;
    geometry.applyToMesh(mesh);
    const material = new StandardMaterial(name + "-material", scene);
    material.diffuseColor = Color3.White();
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.useVertexColors = true;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.freezeWorldMatrix();
  };
  build("forest-leaf-litter-batch", leafPositions, leafIndices, leafColors);
  build("forest-twigs-batch", twigPositions, twigIndices, twigColors);
  console.info("[Rewild] Forest floor detail batches:", leaves, "leaves,", twigs, "twigs");
}
