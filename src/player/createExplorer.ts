import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

/** A self-contained, stylized explorer. No external model downloads are needed. */
export function createExplorer(scene: Scene, parent: TransformNode) {
  const rig = new TransformNode("explorer-rig", scene);
  rig.parent = parent;
  const mat = (name: string, hex: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.035, 0.035, 0.035);
    return m;
  };
  const coat = mat("explorer-coat", "#B97745");
  const coatTrim = mat("explorer-coat-trim", "#E0B47E");
  const trousers = mat("explorer-trousers", "#3C504A");
  const boots = mat("explorer-boots", "#302F2B");
  const skin = mat("explorer-skin", "#C9926E");
  const hair = mat("explorer-hair", "#382C29");
  const pack = mat("explorer-backpack", "#526B54");
  const straps = mat("explorer-straps", "#3D483C");
  const scarf = mat("explorer-scarf", "#D6BE89");

  const cube = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: StandardMaterial, pivot: TransformNode) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.parent = pivot;
    mesh.position.set(x, y, z);
    mesh.material = material;
    return mesh;
  };
  const ball = (name: string, diameter: number, x: number, y: number, z: number, material: StandardMaterial, pivot: TransformNode) => {
    const mesh = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
    mesh.parent = pivot;
    mesh.position.set(x, y, z);
    mesh.material = material;
    return mesh;
  };

  cube("coat-torso", 0.78, 0.91, 0.44, 0, 1.37, 0, coat, rig);
  cube("coat-hem", 0.84, 0.22, 0.5, 0, 0.94, 0, coat, rig);
  cube("coat-collar", 0.6, 0.13, 0.49, 0, 1.86, 0, coatTrim, rig);
  cube("scarf", 0.57, 0.13, 0.5, 0, 1.83, 0.03, scarf, rig);
  ball("head", 0.52, 0, 2.13, 0, skin, rig);
  const hairCap = ball("hair-cap", 0.54, 0, 2.29, -0.045, hair, rig);
  hairCap.scaling.y = 0.48;
  cube("hair-back", 0.44, 0.18, 0.13, 0, 2.18, -0.22, hair, rig);
  cube("backpack", 0.66, 0.77, 0.3, 0, 1.4, -0.38, pack, rig);
  cube("backpack-pocket", 0.45, 0.3, 0.12, 0, 1.22, -0.59, pack, rig);
  for (const side of [-1, 1]) {
    cube("pack-strap", 0.12, 0.77, 0.12, side * 0.27, 1.42, 0.27, straps, rig);
  }

  const leftArm = new TransformNode("left-arm-pivot", scene);
  const rightArm = new TransformNode("right-arm-pivot", scene);
  const leftLeg = new TransformNode("left-leg-pivot", scene);
  const rightLeg = new TransformNode("right-leg-pivot", scene);
  const limbs = [
    { pivot: leftArm, x: -0.53, y: 1.73, arm: true },
    { pivot: rightArm, x: 0.53, y: 1.73, arm: true },
    { pivot: leftLeg, x: -0.23, y: 0.91, arm: false },
    { pivot: rightLeg, x: 0.23, y: 0.91, arm: false },
  ];
  for (const { pivot, x, y, arm } of limbs) {
    pivot.parent = rig;
    pivot.position.set(x, y, 0);
    if (arm) {
      cube("sleeve", 0.25, 0.59, 0.28, 0, -0.29, 0, coat, pivot);
      ball("hand", 0.22, 0, -0.66, 0, skin, pivot);
    } else {
      cube("trouser-leg", 0.29, 0.68, 0.32, 0, -0.34, 0, trousers, pivot);
      cube("boot", 0.33, 0.25, 0.46, 0, -0.77, 0.09, boots, pivot);
    }
  }

  let phase = 0;
  let blend = 0;
  let harvestPhase = 0;
  return {
    setVisible(visible: boolean) { rig.setEnabled(visible); },
    update(dt: number, moving: boolean, sprinting: boolean, airborne: boolean, harvesting = false) {
      const target = moving ? 1 : 0;
      blend += (target - blend) * Math.min(1, dt * 9);
      phase += dt * (sprinting ? 12 : 8) * Math.max(blend, 0.05);
      const swing = Math.sin(phase) * blend * (sprinting ? 0.76 : 0.5);
      if (harvesting) harvestPhase += dt * 15;
      leftLeg.rotation.x = airborne ? -0.25 : swing;
      rightLeg.rotation.x = airborne ? 0.35 : -swing;
      leftArm.rotation.x = harvesting ? -0.75 + Math.sin(harvestPhase) * 0.45 : airborne ? -0.4 : -swing * 0.8;
      rightArm.rotation.x = harvesting ? -1.1 + Math.sin(harvestPhase) * 0.85 : airborne ? -0.4 : swing * 0.8;
      rig.position.y = airborne ? 0 : Math.abs(Math.sin(phase)) * 0.045 * blend;
      rig.rotation.z = Math.sin(phase) * 0.025 * blend;
    },
  };
}
