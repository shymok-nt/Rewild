import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Real Sketchfab Axe.glb. Its mesh (OuterContour) is Z-long, with the
 * narrow shaft at positive Z and the wider blade at negative Z.
 * The socket is the actual hand grip, not the model's bounding-box centre.
 */
export async function equipAxe(
  scene: Scene,
  player: TransformNode,
  isHarvesting: () => boolean = () => false,
  getRightHand: () => AbstractMesh | null = () => null,
): Promise<void> {
  const imported = await SceneLoader.ImportMeshAsync("", "/models/", "Axe.glb", scene);
  if (scene.isDisposed) {
    imported.meshes.forEach(mesh => mesh.dispose());
    return;
  }
  const visible = imported.meshes.filter(mesh => mesh.getTotalVertices() > 0);
  if (!visible.length) throw new Error("Axe.glb has no geometry");

  const socket = new TransformNode("equipment-right-hand-socket", scene);
  socket.parent = player;
  socket.position.set(-0.52, 1.03, 0.18);

  const model = new TransformNode("axe-asset-orientation", scene);
  model.parent = socket;
  const gripOffset = new TransformNode("axe-asset-shaft-grip", scene);
  gripOffset.parent = model;
  // Source GLB is Z-long; convert the handle to the game's vertical axis.
  // The positive-Z narrow shaft points downward, negative-Z blade upward.
  const modelScale = 0.044;
  model.scaling.setAll(modelScale);
  model.rotation.x = Math.PI / 2;

  // The actual mesh bounds are X [-2.939,2.939], Z [-6.843,6.843].
  // Its narrow handle is on positive Z, offset toward positive X.
  // Put the grip at (1.55,0,4.8) in the original mesh coordinates.
  // Move the shaft grip onto the pivot BEFORE applying the axis rotation.
  // The handle centre is x≈1.7 and the palm grips near z≈4.5.
  gripOffset.position.set(-1.7, 0, -4.5);

  for (const mesh of imported.meshes) {
    if (!mesh.parent) mesh.parent = gripOffset;
    mesh.isPickable = false;
  }

  let attachedHand: AbstractMesh | null = null;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const hand = getRightHand();
    if (hand && hand !== attachedHand) {
      attachedHand = hand;
      socket.parent = hand;
      // The hand node itself is a mesh; attach at its geometric palm centre.
      const box = hand.getBoundingInfo().boundingBox;
      const palm = box.minimum.add(box.maximum).scale(0.5);
      socket.position.copyFrom(palm);
      // Hand_R geometry centre is close to the wrist; nudge toward the fingers.
      socket.position.z += 0.025;
      console.info("[Rewild] Sketchfab axe attached by shaft grip to Hand_R");
    }
    // Positive forward pitch keeps the blade in front of the torso.
    // Blade broad side lies on local X; turn its cutting direction forward.
    socket.rotation.set(isHarvesting() ? 0.12 : 0.26, Math.PI / 2, 0.04);
  });

  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    socket.dispose(false, true);
  });
}
