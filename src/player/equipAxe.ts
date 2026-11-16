import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Visual-only equipped axe. Attached to the character root so the existing
 * GLB rig, walk/run animations and harvesting mechanics remain unchanged.
 */
export async function equipAxe(scene: Scene, player: TransformNode): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "rewild_axe.glb", scene);
  if (scene.isDisposed) return;
  const anchor = new TransformNode("equipped-axe", scene);
  anchor.parent = player;
  anchor.position = new Vector3(0.47, 1.25, 0.18);
  // Asset is authored Z-up and ~13.7 units long; convert to game scale.
  anchor.rotation.x = -Math.PI / 2;
  anchor.rotation.z = 0.12;
  anchor.scaling.setAll(0.105);
  for (const mesh of result.meshes) {
    if (!mesh.parent) mesh.parent = anchor;
    mesh.isPickable = false;
  }
  console.info("[Rewild] Equipped axe GLB");
}
