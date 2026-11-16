import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { ResourceKind } from "./inventory";

export interface HarvestNode {
  id: string;
  kind: ResourceKind;
  label: string;
  position: Vector3;
  remaining: number;
  maximum: number;
  cooldownUntil: number;
  visual: ReturnType<typeof MeshBuilder.CreateBox>;
  baseScale: Vector3;
  hitUntil: number;
}
function makeMaterial(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.06, 0.06, 0.06);
  return m;
}
/** Interactive resource clusters are separate from the decorative instanced forest. */
export function createHarvestNodes(scene: Scene): HarvestNode[] {
  const bark = makeMaterial(scene, "harvest-bark", "#6A4A31");
  const foliage = makeMaterial(scene, "harvest-foliage", "#477A4E");
  const rockMat = makeMaterial(scene, "harvest-stone", "#89918A");
  const nodes: HarvestNode[] = [];
  const positions: { kind: ResourceKind; x: number; z: number }[] = [
    { kind: "wood", x: -6, z: 12 }, { kind: "stone", x: 7, z: 12 },
    { kind: "wood", x: -10, z: 18 }, { kind: "stone", x: 11, z: 19 },
    { kind: "wood", x: -8, z: 29 }, { kind: "stone", x: 9, z: 33 },
    { kind: "wood", x: 7, z: -10 }, { kind: "stone", x: -9, z: -12 },
  ];
  for (const [i, item] of positions.entries()) {
    let visual: ReturnType<typeof MeshBuilder.CreateBox>;
    if (item.kind === "wood") {
      visual = MeshBuilder.CreateBox("harvest-tree-" + i, { width: 0.72, height: 3.4, depth: 0.72 }, scene);
      visual.material = bark;
      visual.position.y = 1.7;
      for (let tier = 0; tier < 3; tier++) {
        const crown = MeshBuilder.CreateCylinder("harvest-tree-crown-" + i + "-" + tier, {
          height: 2.3, diameterTop: 0, diameterBottom: 3.1 - tier * 0.4, tessellation: 7,
        }, scene);
        crown.parent = visual;
        crown.position.y = 0.25 + tier * 0.62;
        crown.material = foliage;
      }
    } else {
      visual = MeshBuilder.CreateBox("harvest-rock-" + i, { size: 1.1 }, scene);
      visual.scaling.set(1.3, 0.65, 0.9);
      visual.rotation.y = i * 0.37;
      visual.material = rockMat;
    }
    visual.position.set(item.x, item.kind === "wood" ? 1.7 : 0.36, item.z);
    visual.isPickable = false;
    nodes.push({
      id: "resource-" + i,
      kind: item.kind,
      label: item.kind === "wood" ? "Odun yığını" : "Taş yatağı",
      position: new Vector3(item.x, 0, item.z),
      remaining: 5,
      maximum: 5,
      cooldownUntil: 0,
      visual,
      baseScale: visual.scaling.clone(),
      hitUntil: 0,
    });
  }
  return nodes;
}
export function nearestHarvestNode(nodes: readonly HarvestNode[], position: Vector3, maxDistance = 3.2): HarvestNode | null {
  let nearest: HarvestNode | null = null;
  let distanceSquared = maxDistance * maxDistance;
  for (const node of nodes) {
    if (node.remaining <= 0) continue;
    const dx = position.x - node.position.x;
    const dz = position.z - node.position.z;
    const d = dx * dx + dz * dz;
    if (d < distanceSquared) { distanceSquared = d; nearest = node; }
  }
  return nearest;
}
