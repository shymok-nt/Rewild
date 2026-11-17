import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";

// Each future equipment model can define its own grip profile.
type GripProfile = { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number };
const AXE_GRIP: Readonly<GripProfile> = {
  x: 0.01, y: -0.065, z: 0.155, rx: 2, ry: -93, rz: -59, scale: 0.04,
};

export async function equipAxe(
  scene: Scene,
  player: TransformNode,
  _isHarvesting: () => boolean = () => false,
  _getRightHand: () => AbstractMesh | null = () => null,
): Promise<void> {
  const imported = await SceneLoader.ImportMeshAsync("", "/models/", "Axe.glb", scene);
  if (scene.isDisposed) {
    imported.meshes.forEach(mesh => mesh.dispose());
    return;
  }
  if (!imported.meshes.some(mesh => mesh.getTotalVertices() > 0)) throw new Error("Axe.glb has no visible geometry");

  // First-person viewmodel: camera-relative, independent of invisible body rig.
  const handSocket = new TransformNode("first-person-equipment-socket", scene);
  handSocket.parent = scene.activeCamera ?? player;
  handSocket.position.set(0.30, -0.39, 0.40);
  const adjust = new TransformNode("axe-grip-adjustment", scene);
  adjust.parent = handSocket;
  const model = new TransformNode("axe-asset-orientation", scene);
  model.parent = adjust;
  model.rotation.x = Math.PI / 2;
  const grip = new TransformNode("axe-shaft-GripPoint", scene);
  grip.parent = model;
  grip.position.set(-1.7, 0, -4.5);
  for (const mesh of imported.meshes) {
    if (!mesh.parent) mesh.parent = grip;
    mesh.isPickable = false;
  }

  // Calibrated by the player; no runtime editor or browser storage needed.
  adjust.position.set(AXE_GRIP.x, AXE_GRIP.y, AXE_GRIP.z);
  adjust.rotation.set(
    AXE_GRIP.rx * Math.PI / 180,
    AXE_GRIP.ry * Math.PI / 180,
    AXE_GRIP.rz * Math.PI / 180,
  );
  model.scaling.setAll(AXE_GRIP.scale);

  // Preserve the calibrated model rotation/scale, but use a camera-space
  // position so the tool stays visible and never clips through the torso.
  adjust.position.set(0, 0, 0);
  // Simple lightweight first-person arm, fixed to the same grip as the tool.
  const gloveMat = new StandardMaterial("first-person-glove", scene);
  gloveMat.diffuseColor = Color3.FromHexString("#80664C");
  const sleeveMat = new StandardMaterial("first-person-sleeve", scene);
  sleeveMat.diffuseColor = Color3.FromHexString("#344B37");
  const glove = MeshBuilder.CreateSphere("first-person-hand", { diameter: 0.13, segments: 10 }, scene);
  glove.parent = handSocket;
  glove.position.set(0, -0.015, 0);
  glove.material = gloveMat;
  glove.isPickable = false;
  const sleeve = MeshBuilder.CreateCylinder("first-person-forearm", {
    height: 0.36, diameterTop: 0.11, diameterBottom: 0.15, tessellation: 10,
  }, scene);
  sleeve.parent = handSocket;
  sleeve.position.set(0.07, -0.22, -0.04);
  sleeve.rotation.z = -0.35;
  sleeve.material = sleeveMat;
  sleeve.isPickable = false;
  // A subtle harvesting motion without relying on hidden character bones.
  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = _isHarvesting() ? performance.now() * 0.016 : 0;
    handSocket.rotation.x = _isHarvesting() ? -0.22 + Math.sin(t) * 0.15 : 0;
  });

  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    handSocket.dispose(false, true);
    gloveMat.dispose();
    sleeveMat.dispose();
  });
}
