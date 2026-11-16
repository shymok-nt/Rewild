import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { HarvestNode } from "../game/harvesting";
import { registerGlbCollider } from "./meshColliders";

export interface ForestTree { x: number; z: number; scale: number; rotation: number }

/**
 * Replace the procedural pine canopy with the supplied oak GLB.
 * Four mesh parts are loaded once and drawn as thin instances.
 * Old pines stay visible if the model is missing or fails to load.
 */
export async function installOakForest(scene: Scene, trees: readonly ForestTree[], harvestNodes: readonly HarvestNode[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "stylized_mese_agaci.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (meshes.length === 0) throw new Error("Oak GLB has no renderable meshes");
  const matrices = new Float32Array(trees.length * 16);
  const placements: Matrix[] = [];
  trees.forEach((tree, i) => {
    const placement = Matrix.Compose(
      new Vector3(tree.scale, tree.scale, tree.scale),
      Quaternion.RotationAxis(Vector3.Up(), tree.rotation),
      new Vector3(tree.x, 0, tree.z),
    );
    placements.push(placement);
    placement.copyToArray(matrices, i * 16);
  });
  for (const mesh of meshes) {
    // The uploaded asset has identity mesh transforms; keep its materials and vertex colors.
    mesh.isPickable = false;
    mesh.thinInstanceSetBuffer("matrix", matrices, 16);
    mesh.alwaysSelectAsActiveMesh = true;
  }
  // Collectible trees use instances of the SAME oak geometry. Their anchor remains
  // enabled/disabled by the harvesting system, so depletion and regrowth work.
  for (const node of harvestNodes) {
    if (node.kind !== "wood") continue;
    const oldCrowns = node.visual.getChildMeshes(false);
    for (const crown of oldCrowns) crown.dispose();
    node.visual.isVisible = false;
    for (const mesh of meshes) {
      const instance = mesh.createInstance("harvest-oak-" + node.id + "-" + mesh.name);
      instance.parent = node.visual;
      // The existing harvest anchor is at y=1.7, while the GLB is ground-based.
      instance.position.set(0, -1.7, 0);
      instance.scaling.setAll(0.82);
      instance.isPickable = false;
    }
  }
  registerGlbCollider(scene, meshes, placements);
  for (const name of [
    "pine-trunk-source", "pine-crown-source-0", "pine-crown-source-1",
    "pine-crown-source-2", "pine-crown-source-3", "pine-crown-source-4",
  ]) {
    scene.getMeshByName(name)?.setEnabled(false);
  }
}
