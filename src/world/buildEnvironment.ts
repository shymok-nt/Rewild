import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Meshes/instancedMesh";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

type Random = () => number;
function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function material(scene: Scene, name: string, hex: string): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = new Color3(0.035, 0.035, 0.035);
  return result;
}
function box(scene: Scene, name: string, width: number, height: number, depth: number, x: number, y: number, z: number, mat: StandardMaterial): Mesh {
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  mesh.position.set(x, y, z);
  mesh.material = mat;
  return mesh;
}

export function buildEnvironment(scene: Scene): void {
  const random = seeded(40217);
  const meadow = material(scene, "meadow-green", "#65885A");
  const grassLight = material(scene, "grass-light", "#779A61");
  const grassDark = material(scene, "grass-dark", "#4B7551");
  const soil = material(scene, "footpath", "#A08B68");
  const bark = material(scene, "pine-bark", "#584738");
  const pineDark = material(scene, "pine-dark", "#355D49");
  const pineMid = material(scene, "pine-mid", "#497B54");
  const pineLight = material(scene, "pine-light", "#638B5D");
  const stone = material(scene, "slate", "#7D8580");
  const stoneLight = material(scene, "slate-light", "#9BA39A");
  const timber = material(scene, "weathered-timber", "#806B50");
  const timberLight = material(scene, "timber-trim", "#A08A69");
  const roof = material(scene, "old-roof", "#555F5A");
  const dark = material(scene, "open-doorway", "#342E28");
  const flowers = [
    material(scene, "flower-cream", "#F1DEAD"),
    material(scene, "flower-blue", "#9AB7CF"),
    material(scene, "flower-pink", "#D4A6A6"),
  ];

  const ground = MeshBuilder.CreateGround("walkable-meadow", { width: 140, height: 140, subdivisions: 4 }, scene);
  ground.material = meadow;

  // The walkable surface stays level because the current player controller uses y=0.
  // Slightly raised ground patches add visual variation without breaking movement.
  for (let i = 0; i < 48; i++) {
    const x = (random() - 0.5) * 125;
    const z = (random() - 0.5) * 125;
    if (Math.abs(x) < 9 && Math.abs(z) < 11) continue;
    const patch = MeshBuilder.CreateDisc("meadow-patch", { radius: 1, tessellation: 12 }, scene);
    patch.rotation.x = Math.PI / 2;
    patch.scaling.set(3 + random() * 8, 2 + random() * 6, 1);
    patch.position.set(x, 0.012, z);
    patch.material = random() > 0.5 ? grassLight : grassDark;
  }

  // Winding village footpath, kept as a decorative overlay.
  const points = [
    new Vector3(0, 0.025, 11), new Vector3(1, 0.025, 17),
    new Vector3(4, 0.025, 24), new Vector3(1, 0.025, 32),
    new Vector3(-4, 0.025, 41), new Vector3(-2, 0.025, 55),
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const delta = b.subtract(a);
    const strip = box(scene, "path-segment", 3.2, 0.035, delta.length(), (a.x + b.x) / 2, 0.025, (a.z + b.z) / 2, soil);
    strip.rotation.y = Math.atan2(delta.x, delta.z);
  }

  // Low-poly pine with three tiered crowns; thin instances keep draw calls low.
  const trunk = MeshBuilder.CreateCylinder("pine-trunk-source", { height: 3.5, diameterTop: 0.25, diameterBottom: 0.7, tessellation: 7 }, scene);
  trunk.material = bark;
  const crowns = [0, 1, 2].map((tier) => {
    const mesh = MeshBuilder.CreateCylinder("pine-crown-source-" + tier, {
      height: 3.4, diameterTop: 0, diameterBottom: 4.6 - tier * 0.75, tessellation: 7,
    }, scene);
    mesh.material = [pineDark, pineMid, pineLight][tier];
    return mesh;
  });
  const transforms: number[][] = [[], [], [], []];
  const matrix = (x: number, y: number, z: number, scale: number) => [
    scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, x, y, z, 1,
  ];
  for (let i = 0; i < 175; i++) {
    const x = (random() - 0.5) * 128;
    const z = (random() - 0.5) * 128;
    if (Math.abs(x) < 11 && Math.abs(z) < 15) continue;
    if (z > 9 && z < 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 6) continue;
    const s = 0.75 + random() * 0.7;
    transforms[0].push(...matrix(x, 1.75 * s, z, s));
    for (let tier = 0; tier < 3; tier++) {
      transforms[tier + 1].push(...matrix(x, (3.4 + tier * 1.05) * s, z, s));
    }
  }
  [trunk, ...crowns].forEach((source, index) => {
    source.thinInstanceSetBuffer("matrix", new Float32Array(transforms[index]), 16);
    source.isPickable = false;
    source.alwaysSelectAsActiveMesh = true;
  });

  // Pebbles and boulders.
  const rockBase = MeshBuilder.CreateSphere("rock-source", { diameter: 1, segments: 5 }, scene);
  rockBase.material = stone;
  for (let i = 0; i < 85; i++) {
    const x = (random() - 0.5) * 130;
    const z = (random() - 0.5) * 130;
    if (Math.abs(x) < 7 && Math.abs(z) < 10) continue;
    const rock = rockBase.createInstance("rock-" + i);
    const size = 0.35 + random() * 1.5;
    rock.position.set(x, size * 0.28, z);
    rock.scaling.set(size * 1.4, size * 0.55, size);
    rock.rotation.y = random() * Math.PI;
  }
  rockBase.isVisible = false;

  // Flower and grass clusters: compact, deterministic and inexpensive.
  for (let i = 0; i < 150; i++) {
    const x = (random() - 0.5) * 115;
    const z = (random() - 0.5) * 115;
    if (Math.abs(x) < 6 && Math.abs(z) < 8) continue;
    const tuft = MeshBuilder.CreateCylinder("wildflower", {
      height: 0.24 + random() * 0.25, diameterTop: 0.04, diameterBottom: 0.32, tessellation: 4,
    }, scene);
    tuft.position.set(x, 0.16, z);
    tuft.material = random() < 0.28 ? flowers[Math.floor(random() * flowers.length)] : grassLight;
  }

  // Central abandoned cottage with an actual dark doorway and readable silhouette.
  box(scene, "cottage-main", 7, 3.6, 5.8, 0, 1.8, 0, timber);
  box(scene, "doorway", 1.55, 2.65, 0.08, 0, 1.325, 2.94, dark);
  box(scene, "door-frame-left", 0.22, 2.8, 0.24, -0.89, 1.4, 2.98, timberLight);
  box(scene, "door-frame-right", 0.22, 2.8, 0.24, 0.89, 1.4, 2.98, timberLight);
  box(scene, "door-frame-top", 2, 0.23, 0.24, 0, 2.77, 2.98, timberLight);
  for (const x of [-2.1, 2.1]) {
    box(scene, "window", 1.15, 1.1, 0.08, x, 2.05, 2.95, dark);
    box(scene, "window-sill", 1.4, 0.18, 0.34, x, 1.48, 3.02, timberLight);
  }
  for (const side of [-1, 1]) {
    const slope = box(scene, "pitched-roof", 4.8, 0.35, 6.8, side * 1.85, 4.5, 0, roof);
    slope.rotation.z = side * 0.55;
  }
  box(scene, "chimney", 0.9, 2.1, 0.9, -2.1, 5.1, -1.3, stone);
  for (let i = 0; i < 7; i++) {
    const x = -3.8 + i * 1.25;
    box(scene, "fence-post", 0.22, 1.25, 0.22, x, 0.625, 7.3, timberLight);
  }
  box(scene, "fence-rail", 8, 0.17, 0.17, 0, 0.87, 7.3, timber);

  // Distant ruins mark an exploration destination beyond the path.
  box(scene, "ruin-wall-a", 7, 2.8, 0.7, -12, 1.4, 47, stoneLight);
  box(scene, "ruin-wall-b", 0.7, 2.8, 6, -15.2, 1.4, 44, stone);
  box(scene, "ruin-pillar", 1.1, 4.2, 1.1, -8.9, 2.1, 47, stone);
}
