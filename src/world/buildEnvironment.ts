import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Meshes/instancedMesh";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
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
  // Grass004 1K PBR maps (ambientCG). All texture assets live in
  // public/models; the 3D ground mesh/collisions remain unchanged.
  const groundMaterial = new PBRMaterial("grass004-ground-pbr", scene);
  groundMaterial.metallic = 0;
  groundMaterial.roughness = 1;
  const colorMap = new Texture("/models/grass-color.jpg", scene);
  const normalMap = new Texture("/models/grass-normal.jpg", scene);
  const ormMap = new Texture("/models/grass-orm.jpg", scene);
  for (const map of [colorMap, normalMap, ormMap]) {
    map.uScale = 12;
    map.vScale = 12;
    map.wrapU = Texture.WRAP_ADDRESSMODE;
    map.wrapV = Texture.WRAP_ADDRESSMODE;
  }
  groundMaterial.albedoTexture = colorMap;
  groundMaterial.bumpTexture = normalMap;
  groundMaterial.metallicTexture = ormMap;
  groundMaterial.useRoughnessFromMetallicTextureGreen = true;
  groundMaterial.useMetallnessFromMetallicTextureBlue = true;
  groundMaterial.useAmbientOcclusionFromMetallicTextureRed = true;
  groundMaterial.invertNormalMapY = false;
  ground.material = groundMaterial;

  // Keep a single coplanar-safe ground surface. The old overlapping meadow\n  // discs caused depth-buffer flickering when the camera moved.\n\n  // A continuous curved ribbon replaces intersecting rectangular path segments.
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
  const placedTrees: { x: number; z: number; radius: number }[] = [];
  const resourceSites = [[-6,12],[-10,18],[-8,29],[7,-10],[7,12],[11,19],[9,33],[-9,-12]];
  const protectedArea = (x: number, z: number, radius: number) =>
    (Math.abs(x) < 5.2 + radius && Math.abs(z) < 8.7 + radius) ||
    (Math.abs(x + 12) < 6.5 + radius && Math.abs(z - 46) < 6 + radius) ||
    (Math.hypot(x, z - 9) < 5 + radius) ||
    resourceSites.some(([rx,rz]) => Math.hypot(x-rx,z-rz) < 2.5 + radius);
  for (let i = 0; i < 900 && placedTrees.length < 62; i++) {
    const x = (random() - 0.5) * 128;
    const z = (random() - 0.5) * 128;
    const scale = 0.78 + random() * 0.42;
    const rotation = random() * Math.PI * 2;
    const crownRadius = 3.9 * scale;
    if (protectedArea(x,z,crownRadius)) continue;
    if (z > 8 && z < 59 && Math.abs(x - Math.sin(z * 0.12) * 3) < 5.5 + crownRadius) continue;
    if (placedTrees.some(tree => Math.hypot(tree.x-x,tree.z-z) < tree.radius + crownRadius + 2.3)) continue;
    placedTrees.push({ x,z,radius:crownRadius });
    forestTrees.push({ x, z, scale, rotation });
    obstacles.push({ x, z, halfWidth: 1.8 * scale, halfDepth: 1.8 * scale });
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
    source.alwaysSelectAsActiveMesh = false;
  });

  // Pebbles and boulders.
  const rockBase = MeshBuilder.CreateSphere("rock-source", { diameter: 1, segments: 5 }, scene);
  rockBase.material = stone;
  const placedRocks: { x: number; z: number; radius: number }[] = [];
  for (let i = 0; i < 450 && placedRocks.length < 45; i++) {
    const x = (random() - 0.5) * 124;
    const z = (random() - 0.5) * 124;
    const size = 0.65 + random() * 1.1;
    const radius = size * 0.8;
    if (protectedArea(x,z,radius + 1.4)) continue;
    if (z > 8 && z < 59 && Math.abs(x - Math.sin(z * 0.12) * 3) < 5.5 + radius) continue;
    if (placedTrees.some(tree => Math.hypot(tree.x-x,tree.z-z) < tree.radius * 0.5 + radius + 1.2)) continue;
    if (placedRocks.some(rock => Math.hypot(rock.x-x,rock.z-z) < rock.radius + radius + 1.2)) continue;
    placedRocks.push({x,z,radius});
    const rock = rockBase.createInstance("rock-" + placedRocks.length);
    // Placement/collision marker only. The visible rock is supplied by rock.glb.
    // Never display the old smooth procedural stone while GLB loads (or if it fails).
    rock.isVisible = false;
    rock.position.set(x, size * 0.28, z);
    rock.scaling.set(size * 1.4, size * 0.55, size);
    rock.rotation.y = random() * Math.PI;
    obstacles.push({x,z,halfWidth:size * 0.72,halfDepth:size * 0.52});
  }
  rockBase.isVisible = false;

  // Old 150 individual cone tufts removed. The dedicated vegetation mesh
  // supplies nearby grass; the meadow texture supplies distant coverage.
  // Keep a handful of flowers without a forest of extra draw calls.
  const flowerSource = MeshBuilder.CreateCylinder("wildflower-source", {
    height: 0.28, diameterTop: 0.04, diameterBottom: 0.10, tessellation: 4,
  }, scene);
  flowerSource.material = flowers[0];
  for (let i = 0; i < 12; i++) {
    const x = (random() - 0.5) * 105;
    const z = (random() - 0.5) * 105;
    if (Math.abs(x) < 6 && Math.abs(z) < 8) continue;
    const flower = flowerSource.createInstance("wildflower-" + i);
    flower.position.set(x, 0.15, z);
    flower.isPickable = false;
  }
  flowerSource.isVisible = false;

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
  obstacles.push({ x: 0, z: 7.3, halfWidth: 4.1, halfDepth: 0.16 });

  // Distant ruins mark an exploration destination beyond the path.
  box(scene, "ruin-wall-a", 7, 2.8, 0.7, -12, 1.4, 47, stoneLight);
  box(scene, "ruin-wall-b", 0.7, 2.8, 6, -15.2, 1.4, 44, stone);
  box(scene, "ruin-pillar", 1.1, 4.2, 1.1, -8.9, 2.1, 47, stone);
  obstacles.push({ x: -12, z: 47, halfWidth: 3.5, halfDepth: 0.35 });
  obstacles.push({ x: -15.2, z: 44, halfWidth: 0.35, halfDepth: 3 });
  obstacles.push({ x: -8.9, z: 47, halfWidth: 0.55, halfDepth: 0.55 });
  return obstacles;
}
