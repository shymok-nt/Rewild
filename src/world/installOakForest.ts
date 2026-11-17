import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { HarvestNode } from "../game/harvesting";

export interface ForestTree { x: number; z: number; scale: number; rotation: number }

/**
 * Stable GLB instancing. Avoid combining thin instances and normal instances on
 * the same source mesh, and never do expensive triangle collision generation here.
 * Keep procedural pines visible until the new forest is fully ready.
 */
export async function installOakForest(scene: Scene, trees: readonly ForestTree[], harvestNodes: readonly HarvestNode[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "stylized_mese_agaci.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error("Oak GLB has no renderable geometry");

  // GLB mesh coordinates can inherit transforms from multiple parent nodes.
  // Bake those transforms into each instance's local placement, not its geometry.
  const parts = meshes.map(mesh => {
    mesh.computeWorldMatrix(true);
    const scale = new Vector3();
    const rotation = new Quaternion();
    const position = new Vector3();
    mesh.getWorldMatrix().decompose(scale, rotation, position);
    return { mesh, scale, rotation, position };
  });

  const created: TransformNode[] = [];
  const instantiate = (name: string, x: number, z: number, size: number, angle: number, y = 0) => {
    const anchor = new TransformNode(name, scene);
    anchor.position.set(x, y, z);
    anchor.scaling.setAll(size);
    anchor.rotation.y = angle;
    for (const part of parts) {
      const instance = part.mesh.createInstance(name + "-" + part.mesh.name);
      instance.parent = anchor;
      instance.position.copyFrom(part.position);
      instance.rotationQuaternion = part.rotation.clone();
      instance.scaling.copyFrom(part.scale);
      instance.isPickable = false;
      instance.isVisible = true;
    }
    created.push(anchor);
    return anchor;
  };

  try {
    for (const [i, tree] of trees.entries()) {
      const anchor = instantiate("oak-forest", tree.x, tree.z, tree.scale, tree.rotation);
      const resource = harvestNodes.find(node => node.id === "forest-" + i);
      if (resource) {
        anchor.parent = resource.visual;
        anchor.position.set(0, 0, 0);
      }
    }
    for (const node of harvestNodes) {
      if (node.kind !== "wood") continue;
      const anchor = instantiate("oak-harvest-" + node.id, node.position.x, node.position.z, 0.82, 0);
      // Harvesting controls the original visual's enabled state.
      anchor.parent = node.visual;
      anchor.position.set(0, -node.visual.position.y, 0);
    }

    // The original source meshes must not appear at the world origin.
    // InstancedMesh visibility is independent from source mesh visibility.
    for (const part of parts) part.mesh.isVisible = false;

    // Remove the old crowns only after all replacement trees were created.
    for (const node of harvestNodes) {
      if (node.kind !== "wood") continue;
      for (const crown of node.visual.getChildMeshes(false)) {
        if (crown.name.startsWith("harvest-tree-crown-")) crown.dispose();
      }
      node.visual.isVisible = false;
    }
    for (const name of [
      "pine-trunk-source", "pine-crown-source-0", "pine-crown-source-1",
      "pine-crown-source-2", "pine-crown-source-3", "pine-crown-source-4",
    ]) scene.getMeshByName(name)?.setEnabled(false);
    console.info("[Rewild] Oak forest ready:", trees.length, "trees,", meshes.length, "GLB parts");
  } catch (error) {
    for (const anchor of created) anchor.dispose(false, true);
    throw error;
  }
}
