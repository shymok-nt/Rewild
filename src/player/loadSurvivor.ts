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
  const anchor = new TransformNode("survivor-model-anchor", scene);
  anchor.parent = parent;
  for (const node of result.meshes) {
    if (!node.parent) node.parent = anchor;
  }
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
    update(_dt: number, moving: boolean, sprinting: boolean, _airborne: boolean, harvesting = false) {
      play(harvesting ? "walk" : moving ? (sprinting ? "run" : "walk") : "idle");
    },
    dispose() {
      for (const group of result.animationGroups) group.dispose();
      anchor.dispose(false, true);
    },
  };
}
