import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { HarvestNode } from "../game/harvesting";

/** Swap existing stone visuals for the supplied GLB; retain colliders and harvesting. */
export async function installRockModels(scene: Scene, nodes: readonly HarvestNode[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "rock.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Rock GLB has no renderable meshes");
  const parts = meshes.map(mesh => {
    mesh.computeWorldMatrix(true);
    const scale = mesh.absoluteScaling.clone();
    const position = mesh.absolutePosition.clone();
    const rotation = mesh.absoluteRotationQuaternion.clone();
    return { mesh, scale, position, rotation };
  });
  const create = (name: string, parent: TransformNode, size: number) => {
    const anchor = new TransformNode(name, scene);
    anchor.parent = parent;
    anchor.scaling.setAll(size);
    for (const part of parts) {
      const instance = part.mesh.createInstance(name + "-" + part.mesh.name);
      instance.parent = anchor;
      instance.position.copyFrom(part.position);
      instance.scaling.copyFrom(part.scale);
      instance.rotationQuaternion = part.rotation.clone();
      instance.isPickable = false;
    }
    return anchor;
  };
  const originals = scene.meshes.filter(mesh => mesh.name.startsWith("rock-") && mesh.name !== "rock-source");
  // The source rock is about 8 world units wide; scale to original boulder size.
  for (const original of originals) {
    if (!(original instanceof AbstractMesh)) continue;
    const anchor = create("glb-" + original.name, new TransformNode("rock-placement-" + original.name, scene), 0.18);
    anchor.parent!.position.copyFrom(original.position);
    anchor.parent!.rotation.copyFrom(original.rotation);
    anchor.parent!.scaling.copyFrom(original.scaling);
    anchor.position.set(0, -0.15, 0);
    const resource = nodes.find(node => node.id.startsWith("boulder-") &&
      Math.abs(node.position.x - original.position.x) < 0.01 &&
      Math.abs(node.position.z - original.position.z) < 0.01);
    if (resource) {
      // Parent the complete placement so depletion and relocation affect the GLB.
      anchor.parent!.parent = resource.visual;
      anchor.parent!.position.x = 0;
      anchor.parent!.position.z = 0;
    }
    original.dispose();
  }
  for (const node of nodes) {
    if (node.kind !== "stone") continue;
    const anchor = create("glb-resource-" + node.id, node.visual, 0.20);
    anchor.position.set(0, -node.visual.position.y, 0);
    node.visual.isVisible = false;
    node.label = "Taş";
  }
  for (const part of parts) part.mesh.isVisible = false;
  console.info("[Rewild] Rock GLB installed:", originals.length, "boulders");
}
