import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

/**
 * Load the user's GLB character without altering the game controller.
 * Expected file: public/models/survivor_character.glb
 * If missing or invalid, the caller retains the procedural explorer.
 */
export async function loadSurvivor(scene: Scene, parent: TransformNode) {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "survivor_character.glb", scene);
  if (!result.meshes.some(mesh => mesh.getTotalVertices() > 0)) {
    throw new Error("Survivor GLB has no visible mesh geometry");
  }
  const anchor = new TransformNode("survivor-model-anchor", scene);
  anchor.parent = parent;
  for (const node of result.meshes) {
    if (!node.parent) node.parent = anchor;
  }
  // This GLB uses a node hierarchy (not a skinned skeleton).
  // Its Hand_R mesh is the correct attachment point for tools.
  const rightHand = result.meshes.find(mesh => mesh.name === "Hand_R") ?? null;
  const shoulder = result.meshes.find(mesh => mesh.name === "Shoulder_R") ?? null;
  const elbow = result.meshes.find(mesh => mesh.name === "Elbow_R") ?? null;
  const shoulderRest = shoulder?.rotation.clone();
  const elbowRest = elbow?.rotation.clone();
  const handRest = rightHand?.rotation.clone();
  let chopTime = 1;
  let wasHarvesting = false;
  const animations = new Map<string, AnimationGroup>();
  for (const group of result.animationGroups) {
    group.stop();
    animations.set(group.name.toLowerCase(), group);
  }
  let active: AnimationGroup | null = null;
  const play = (name: "idle" | "walk" | "run") => {
    const next = animations.get(name) ?? animations.get("idle") ?? null;
    if (next === active) return;
    active?.stop();
    active = next;
    active?.start(true);
  };
  play("idle");
  return {
    rightHand,
    update(dt: number, moving: boolean, sprinting: boolean, _airborne: boolean, harvesting = false) {
      if (harvesting && !wasHarvesting) {
        chopTime = 0;
        active?.stop();
        active = null;
      }
      wasHarvesting = harvesting;
      if (harvesting) {
        // One raised-arm chop, synchronized with the 550ms harvest window.
        chopTime = Math.min(1, chopTime + dt / 0.55);
        const swing = Math.sin(chopTime * Math.PI);
        if (shoulder && shoulderRest) shoulder.rotation.copyFrom(shoulderRest).addInPlaceFromFloats(-0.48 - 0.75 * swing, 0, -0.10);
        if (elbow && elbowRest) elbow.rotation.copyFrom(elbowRest).addInPlaceFromFloats(-0.72 + 0.35 * swing, 0, 0);
        if (rightHand && handRest) rightHand.rotation.copyFrom(handRest).addInPlaceFromFloats(0.20, 0, 0);
      } else {
        play(moving ? (sprinting ? "run" : "walk") : "idle");
        if (shoulder && shoulderRest) shoulder.rotation.copyFrom(shoulderRest).addInPlaceFromFloats(-0.48, 0, -0.10);
        if (elbow && elbowRest) elbow.rotation.copyFrom(elbowRest).addInPlaceFromFloats(-0.72, 0, 0);
        if (rightHand && handRest) rightHand.rotation.copyFrom(handRest).addInPlaceFromFloats(0.20, 0, 0);
      }
    },
    dispose() {
      for (const group of result.animationGroups) group.dispose();
      anchor.dispose(false, true);
    },
  };
}
