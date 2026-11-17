import { validImportedMeshes } from "./validateImportedMeshes";
import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { HarvestNode } from "../game/harvesting";

/** Swap existing stone visuals for the supplied GLB; retain colliders and harvesting. */
export async function installRockModels(scene: Scene, nodes: readonly HarvestNode[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "rock.glb", scene);
  if (scene.isDisposed) return;
  const meshes = validImportedMeshes(result.meshes, "Rock");
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
  // Align the actual imported rock geometry with the terrain, not the
  // original placeholder pivot. This also works for resource respawns.
  const settleOnGround = (anchor: TransformNode) => {
    anchor.computeWorldMatrix(true);
    let minY = Infinity;
    for (const child of anchor.getChildMeshes(false)) {
      child.computeWorldMatrix(true);
      const bottom = child.getBoundingInfo().boundingBox.minimumWorld.y;
      if (bottom < minY) minY = bottom;
    }
    if (!Number.isFinite(minY)) return;
    const parentScaleY = anchor.parent?.getWorldMatrix().getRow(1)?.length() ?? 1;
    anchor.position.y += (0.015 - minY) / Math.max(0.0001, parentScaleY);
  };
  const originals = scene.meshes.filter(mesh =>
    mesh.name.startsWith("rock-") && mesh.name !== "rock-source"
  );
  // The source rock is about 8 world units wide; scale to original boulder size.
  for (const original of originals) {
    // Procedural boulders are InstancedMesh, not Mesh. The old Mesh-only
    // check silently skipped all 45 boulders and left their flat placeholders.
    if (!(original instanceof InstancedMesh || original instanceof Mesh)) continue;
    const placement = new TransformNode("rock-placement-" + original.name, scene);
    const anchor = create("glb-" + original.name, placement, 0.18);
    placement.position.copyFrom(original.position);
    placement.rotation.copyFrom(original.rotation);
    placement.scaling.copyFrom(original.scaling);
    anchor.position.set(0, 0, 0);
    const resource = nodes.find(node => node.id.startsWith("boulder-") &&
      Math.abs(node.position.x - original.position.x) < 0.01 &&
      Math.abs(node.position.z - original.position.z) < 0.01);
    if (resource) {
      // Parent the complete placement so depletion and relocation affect the GLB.
      placement.parent = resource.visual;
      placement.position.x = 0;
      placement.position.z = 0;
    }
    settleOnGround(anchor);
    original.dispose();
  }
  for (const node of nodes) {
    if (node.kind !== "stone") continue;
    const anchor = create("glb-resource-" + node.id, node.visual, 0.20);
    anchor.position.set(0, -node.visual.position.y, 0);
    settleOnGround(anchor);
    node.visual.isVisible = false;
    node.label = "Taş";
  }
  for (const part of parts) part.mesh.isVisible = false;
  console.info("[Rewild] Rock GLB installed:", originals.length, "boulders replaced");
}
