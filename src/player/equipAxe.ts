import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

/** Preview equipment. Keeps the tool at hand height and scales by real bounds. */
export async function equipAxe(scene: Scene, player: TransformNode, isHarvesting: () => boolean = () => false, getRightHand: () => import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh | null = () => null): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "Axe.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Axe GLB has no visible geometry");
  const anchor = new TransformNode("equipped-axe", scene);
  // The procedural explorer is hidden after survivor_character.glb loads.
  // Never parent equipment to its hidden arm: it makes the axe disappear.
  anchor.parent = player;
  anchor.position.set(0.53, 1.03, 0.22);
  anchor.rotation.set(0, 0, 0);
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
  const scale = 0.83 / longest;
  content.scaling.setAll(scale);
  const center = min.add(max).scale(0.5);
  // Original asset uses Z-up; point the handle vertically.
  content.rotation.x = -Math.PI / 2;
  const grip = new Vector3(center.x, center.y, min.z + dimensions.z * 0.18);
  content.position.set(-grip.x * scale, grip.z * scale, -grip.y * scale);
  // Small procedural grip movement; keep the axe attached to the player's hand
  // instead of a fixed, oversized object beside the torso.
  const HAND_CARRY_ROTATION = new Vector3(0.12, -0.12, 0.22);
  let elapsed = 0;
  let attachedHand: import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh | null = null;
  const observer = scene.onBeforeRenderObservable.add(() => {
    elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    const hand = getRightHand();
    if (hand && hand !== attachedHand) {
      attachedHand = hand;
      anchor.parent = hand;
      anchor.position.set(-0.16, -0.09, 0.12);
      anchor.rotation.copyFrom(HAND_CARRY_ROTATION);
      console.info("[Rewild] Axe attached to animated Hand_R");
    }
    const chopping = isHarvesting();
    if (!attachedHand) {
      anchor.rotation.x = chopping ? -0.65 + Math.sin(elapsed * 21) * 0.65 : 0;
      anchor.rotation.z = chopping ? -0.15 : Math.sin(elapsed * 2.4) * 0.012;
    }
  });
  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    anchor.dispose(false, true);
  });
  console.info("[Rewild] Axe equipped at hand scale", scale);
}
