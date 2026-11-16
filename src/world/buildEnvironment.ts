import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Meshes/instancedMesh";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Footprint } from "./collision";
import type { ForestTree } from "./installOakForest";

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

export function buildEnvironment(scene: Scene, forestTrees: ForestTree[] = []): Footprint[] {
  const obstacles: Footprint[] = [];
  const random = seeded(40217);
  const meadow = material(scene, "meadow-green", "#526D4B");
  const grassLight = material(scene, "grass-light", "#627D56");
  const grassDark = material(scene, "grass-dark", "#3F6149");
  const soil = material(scene, "footpath", "#88785D");
  const bark = material(scene, "pine-bark", "#584738");
  const pineDark = material(scene, "pine-dark", "#355D49");
  const pineMid = material(scene, "pine-mid", "#497B54");
  const pineLight = material(scene, "pine-light", "#52765B");
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

  // A continuous curved ribbon replaces intersecting rectangular path segments.
  const waypoints = [
    new Vector3(0, 0.04, 10), new Vector3(1, 0.04, 17),
    new Vector3(4, 0.04, 24), new Vector3(1, 0.04, 32),
    new Vector3(-4, 0.04, 41), new Vector3(-2, 0.04, 55),
  ];
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let segment = 0; segment < waypoints.length - 1; segment++) {
    for (let step = 0; step < 12; step++) {
      const t = step / 12;
      const a = waypoints[Math.max(0, segment - 1)];
      const b = waypoints[segment];
      const c = waypoints[segment + 1];
      const d = waypoints[Math.min(waypoints.length - 1, segment + 2)];
      const p = Vector3.CatmullRom(a, b, c, d, t);
      const next = Vector3.CatmullRom(a, b, c, d, Math.min(1, t + 0.015));
      const tangent = next.subtract(p).normalize();
      const normal = new Vector3(tangent.z, 0, -tangent.x);
      left.push(p.add(normal.scale(1.65)));
      right.push(p.subtract(normal.scale(1.65)));
    }
  }
  const last = waypoints[waypoints.length - 1];
  const previous = waypoints[waypoints.length - 2];
  const tangent = last.subtract(previous).normalize();
  const normal = new Vector3(tangent.z, 0, -tangent.x);
  left.push(last.add(normal.scale(1.65)));
  right.push(last.subtract(normal.scale(1.65)));
  const path = MeshBuilder.CreateRibbon("continuous-footpath", { pathArray: [left, right], sideOrientation: Mesh.DOUBLESIDE }, scene);
  path.material = soil;

  // Optimized interpretation of the custom stylized pine: a tapered trunk and
  // five overlapping, slightly irregular needle canopies. The original GLB
  // contains ~27k triangles; this forest LOD uses only six shared source meshes.
  // Thin instances keep GPU draw calls approximately constant across the forest.
  const trunk = MeshBuilder.CreateCylinder("pine-trunk-source", {
    height: 8.2, diameterTop: 0.11, diameterBottom: 0.68, tessellation: 7,
  }, scene);
  trunk.material = bark;
  const crownMaterials = [pineDark, pineMid, pineLight, pineDark, pineMid];
  const crownWidths = [5.2, 4.6, 3.8, 2.9, 1.75];
  const crownHeights = [3.1, 2.85, 2.5, 2.05, 1.6];
  const crownY = [3.15, 4.3, 5.45, 6.55, 7.65];
  const crowns = crownWidths.map((width, tier) => {
    const mesh = MeshBuilder.CreateCylinder("pine-crown-source-" + tier, {
      height: crownHeights[tier],
      diameterTop: 0.05,
      diameterBottom: width,
      tessellation: 9,
      subdivisions: 2,
    }, scene);
    mesh.material = crownMaterials[tier];
    return mesh;
  });
  const sources = [trunk, ...crowns];
  const transforms: number[][] = sources.map(() => []);
  const matrix = (x: number, y: number, z: number, scale: number, angle: number) => {
    const c = Math.cos(angle) * scale;
    const sn = Math.sin(angle) * scale;
    return [c, 0, -sn, 0, 0, scale, 0, 0, sn, 0, c, 0, x, y, z, 1];
  };
  const placedTrees: { x: number; z: number }[] = [];
  for (let i = 0; i < 450 && placedTrees.length < 72; i++) {
    const x = (random() - 0.5) * 128;
    const z = (random() - 0.5) * 128;
    if (Math.abs(x) < 11 && Math.abs(z) < 15) continue;
    if (z > 9 && z < 58 && Math.abs(x - Math.sin(z * 0.12) * 3) < 9) continue;
    if (placedTrees.some(tree => (tree.x - x) ** 2 + (tree.z - z) ** 2 < 10.5 ** 2)) continue;
    // Leave dedicated harvesting locations accessible and clearly visible.
    if ([[-6, 12], [-10, 18], [-8, 29], [7, -10]].some(([hx, hz]) => (hx - x) ** 2 + (hz - z) ** 2 < 6.5 ** 2)) continue;
    placedTrees.push({ x, z });
    const scale = 0.75 + random() * 0.7;
    const rotation = random() * Math.PI * 2;
    forestTrees.push({ x, z, scale, rotation });
    obstacles.push({ x, z, halfWidth: 1.35 * scale, halfDepth: 1.35 * scale });
    transforms[0].push(...matrix(x, 4.1 * scale, z, scale, rotation));
    for (let tier = 0; tier < crowns.length; tier++) {
      const offset = 0.13 * Math.sin(rotation + tier * 2.3);
      const offsetZ = 0.12 * Math.cos(rotation + tier * 1.7);
      const tierScale = scale * (0.96 + 0.04 * Math.sin(rotation * 3 + tier));
      transforms[tier + 1].push(...matrix(
        x + offset * scale,
        crownY[tier] * scale,
        z + offsetZ * scale,
        tierScale,
        rotation + tier * 0.48,
      ));
    }
  }
  sources.forEach((source, index) => {
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
    if (size > 0.95) obstacles.push({ x, z, halfWidth: size * 0.56, halfDepth: size * 0.4 });
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
  obstacles.push({ x: 0, z: 0, halfWidth: 3.5, halfDepth: 2.9 });
  box(scene, "cottage-main", 7, 3.6, 5.8, 0, 1.8, 0, timber);
  box(scene, "doorway", 1.55, 2.65, 0.08, 0, 1.325, 2.94, dark);
  box(scene, "door-frame-left", 0.22, 2.8, 0.24, -0.89, 1.4, 2.98, timberLight);
  box(scene, "door-frame-right", 0.22, 2.8, 0.24, 0.89, 1.4, 2.98, timberLight);
  box(scene, "door-frame-top", 2, 0.23, 0.24, 0, 2.77, 2.98, timberLight);
  for (const x of [-2.1, 2.1]) {
    box(scene, "window", 1.15, 1.1, 0.08, x, 2.05, 2.95, dark);
    box(scene, "window-sill", 1.4, 0.18, 0.34, x, 1.48, 3.02, timberLight);
  }
  // Each roof half meets at the ridge and extends just beyond the walls.
  // The roof spans 7m horizontally with a 2.15m rise.
  const halfRun = 3.8;
  const rise = 2.15;
  const roofLength = Math.hypot(halfRun, rise);
  const roofAngle = Math.atan2(rise, halfRun);
  for (const side of [-1, 1]) {
    const slope = box(scene, "pitched-roof", roofLength, 0.26, 6.5, side * halfRun / 2, 3.6 + rise / 2, 0, roof);
    slope.rotation.z = -side * roofAngle;
  }
  // Close the front and back triangular gables beneath the roof.
  const gableMat = material(scene, "gable-wood", "#746149");
  gableMat.backFaceCulling = false;
  for (const z of [-2.9, 2.9]) {
    const gable = new Mesh("gable", scene);
    const geometry = new VertexData();
    geometry.positions = [-3.5, 3.6, z, 3.5, 3.6, z, 0, 5.58, z];
    geometry.indices = [0, 1, 2];
    geometry.normals = [0, 0, z < 0 ? -1 : 1, 0, 0, z < 0 ? -1 : 1, 0, 0, z < 0 ? -1 : 1];
    geometry.applyToMesh(gable);
    gable.material = gableMat;
  }
  box(scene, "chimney", 0.9, 2.1, 0.9, -2.1, 5.45, -1.3, stone);
  for (let i = 0; i < 7; i++) {
    const x = -3.8 + i * 1.25;
    box(scene, "fence-post", 0.22, 1.25, 0.22, x, 0.625, 7.3, timberLight);
  }
  box(scene, "fence-rail", 8, 0.17, 0.17, 0, 0.87, 7.3, timber);

  // Distant ruins mark an exploration destination beyond the path.
  box(scene, "ruin-wall-a", 7, 2.8, 0.7, -12, 1.4, 47, stoneLight);
  box(scene, "ruin-wall-b", 0.7, 2.8, 6, -15.2, 1.4, 44, stone);
  box(scene, "ruin-pillar", 1.1, 4.2, 1.1, -8.9, 2.1, 47, stone);
  obstacles.push({ x: -12, z: 47, halfWidth: 3.5, halfDepth: 0.35 });
  obstacles.push({ x: -15.2, z: 44, halfWidth: 0.35, halfDepth: 3 });
  obstacles.push({ x: -8.9, z: 47, halfWidth: 0.55, halfDepth: 0.55 });
  return obstacles;
}
