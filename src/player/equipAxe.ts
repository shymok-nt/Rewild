import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";

/**
 * A compact procedural axe with a deliberate grip pivot at (0,0,0).
 * Geometry is independent from the hand socket, so future GLB tools can
 * replace the model without rewriting the attachment or harvesting logic.
 */
export async function equipAxe(
  scene: Scene,
  player: TransformNode,
  isHarvesting: () => boolean = () => false,
  getRightHand: () => AbstractMesh | null = () => null,
): Promise<void> {
  const socket = new TransformNode("equipment-right-hand-socket", scene);
  socket.parent = player;
  socket.position.set(0.52, 1.03, 0.18);

  const tool = new TransformNode("procedural-axe-grip", scene);
  tool.parent = socket;

  const wood = new StandardMaterial("axe-handle-wood", scene);
  wood.diffuseColor = Color3.FromHexString("#755137");
  wood.specularColor = Color3.FromHexString("#24180f");
  const metal = new StandardMaterial("axe-head-steel", scene);
  metal.diffuseColor = Color3.FromHexString("#89969b");
  metal.specularColor = Color3.FromHexString("#bdc8ca");
  const edge = new StandardMaterial("axe-blade-edge", scene);
  edge.diffuseColor = Color3.FromHexString("#b9c3c3");

  // Hand grips the shaft at y=0. The heavy head is above the fist.
  const handle = MeshBuilder.CreateCylinder("axe-wooden-shaft", {
    height: 0.69, diameterTop: 0.052, diameterBottom: 0.064, tessellation: 8,
  }, scene);
  handle.parent = tool;
  handle.position.y = 0.10;
  handle.material = wood;

  const neck = MeshBuilder.CreateBox("axe-metal-collar", {
    width: 0.115, height: 0.14, depth: 0.12,
  }, scene);
  neck.parent = tool;
  neck.position.y = 0.405;
  neck.material = metal;

  const blade = MeshBuilder.CreateBox("axe-metal-blade", {
    width: 0.28, height: 0.22, depth: 0.085,
  }, scene);
  blade.parent = tool;
  blade.position.set(-0.19, 0.42, 0);
  blade.material = metal;

  const cuttingEdge = MeshBuilder.CreateBox("axe-cutting-edge", {
    width: 0.035, height: 0.26, depth: 0.09,
  }, scene);
  cuttingEdge.parent = tool;
  cuttingEdge.position.set(-0.345, 0.42, 0);
  cuttingEdge.material = edge;

  for (const mesh of [handle, neck, blade, cuttingEdge]) mesh.isPickable = false;

  let attachedHand: AbstractMesh | null = null;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const hand = getRightHand();
    if (hand && hand !== attachedHand) {
      attachedHand = hand;
      socket.parent = hand;
      // The GLB's right arm is on negative X. Place the grip just outside
      // the palm; avoid offsetting the entire model from its centre.
      const bounds = hand.getBoundingInfo().boundingBox;
      const palm = bounds.minimum.add(bounds.maximum).scale(0.5);
      // Grip pivot sits in the palm; the shaft crosses the hand rather than
      // being mounted to the outer side of the forearm.
      socket.position.set(palm.x, palm.y, palm.z);
      socket.rotation.set(0.52, 0.06, -0.18);
      console.info("[Rewild] Procedural axe mounted at Hand_R grip");
    }
    if (!attachedHand) {
      socket.rotation.x = isHarvesting() ? -0.45 : 0.12;
    }
  });

  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    socket.dispose(false, true);
    wood.dispose();
    metal.dispose();
    edge.dispose();
  });
}
