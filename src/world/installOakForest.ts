import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface ForestTree { x: number; z: number; scale: number; rotation: number }

/**
 * Replace the procedural pine canopy with the supplied oak GLB.
 * Four mesh parts are loaded once and drawn as thin instances.
 * Old pines stay visible if the model is missing or fails to load.
 */
export async function installOakForest(scene: Scene, trees: readonly ForestTree[]): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync("", "/models/", "stylized_mese_agaci.glb", scene);
  if (scene.isDisposed) return;
  const meshes = result.meshes.filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
  if (meshes.length === 0) throw new Error("Oak GLB has no renderable meshes");
  const matrices = new Float32Array(trees.length * 16);
  trees.forEach((tree, i) => {
    Matrix.Compose(
      new Vector3(tree.scale, tree.scale, tree.scale),
      Quaternion.RotationAxis(Vector3.Up(), tree.rotation),
      new Vector3(tree.x, 0, tree.z),
    ).copyToArray(matrices, i * 16);
  });
  for (const mesh of meshes) {
    // The uploaded asset has identity mesh transforms; keep its materials and vertex colors.
    mesh.isPickable = false;
    mesh.thinInstanceSetBuffer("matrix", matrices, 16);
    mesh.alwaysSelectAsActiveMesh = true;
  }
  for (const name of [
    "pine-trunk-source", "pine-crown-source-0", "pine-crown-source-1",
    "pine-crown-source-2", "pine-crown-source-3", "pine-crown-source-4",
  ]) {
    scene.getMeshByName(name)?.setEnabled(false);
  }
}
