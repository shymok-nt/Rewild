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
      visual = MeshBuilder.CreateBox("harvest-log-" + i, { width: 1.4, height: 0.7, depth: 0.65 }, scene);
      visual.material = bark;
      visual.rotation.z = 0.14;
      const leaves = MeshBuilder.CreateSphere("harvest-leaves-" + i, { diameter: 0.8, segments: 6 }, scene);
      leaves.parent = visual;
      leaves.position.set(0.25, 0.55, 0);
      leaves.material = foliage;
    } else {
      visual = MeshBuilder.CreateBox("harvest-rock-" + i, { size: 1.1 }, scene);
      visual.scaling.set(1.3, 0.65, 0.9);
      visual.rotation.y = i * 0.37;
      visual.material = rockMat;
    }
    visual.position.set(item.x, item.kind === "wood" ? 0.38 : 0.36, item.z);
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
