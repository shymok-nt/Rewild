import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

/** Preview equipment. Keeps the tool at hand height and scales by real bounds. */
export async function equipAxe(scene: Scene, player: TransformNode): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "Axe.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Axe GLB has no visible geometry");
  const anchor = new TransformNode("equipped-axe", scene);
  anchor.parent = player;
  // The character is roughly 2.5 units tall. Place the handle in the right hand.
  anchor.position.set(0.46, 1.18, 0.05);
  anchor.rotation.set(-Math.PI / 2, 0, 0.16);
  const content = new TransformNode("axe-model-offset", scene);
  content.parent = anchor;
  for (const mesh of result.meshes) {
    if (!mesh.parent) mesh.parent = content;
    mesh.isPickable = false;
  }
  // Measure world-space geometry before shrinking; the imported asset is much
  // larger than the playable character.
  content.computeWorldMatrix(true);
  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld);
    max = Vector3.Maximize(max, box.maximumWorld);
  }
  const dimensions = max.subtract(min);
  const longest = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
  const scale = 0.78 / longest;
  content.scaling.setAll(scale);
  const center = min.add(max).scale(0.5);
  content.position = center.scale(-scale);
  // Small procedural grip movement; keep the axe attached to the player's hand
  // instead of a fixed, oversized object beside the torso.
  let elapsed = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    anchor.rotation.z = 0.16 + Math.sin(elapsed * 2.4) * 0.035;
  });
  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    anchor.dispose(false, true);
  });
  console.info("[Rewild] Axe equipped at hand scale", scale);
}
