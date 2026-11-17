import { Mesh } from "@babylonjs/core/Meshes/mesh";

/** Check imported geometry without rejecting valid non-indexed glTF primitives. */
export function validImportedMeshes(
  meshes: readonly import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh[],
  label: string,
): Mesh[] {
  const valid: Mesh[] = [];
  for (const mesh of meshes) {
    if (!(mesh instanceof Mesh) || mesh.getTotalVertices() === 0) continue;
    const vertices = mesh.getTotalVertices();
    const positions = mesh.getVerticesData("position");
    const indices = mesh.getIndices();
    // glTF TRIANGLES can use drawArrays without an index buffer. The foliage
    // and rocks in stylized_mese_agaci.glb intentionally use that layout.
    const indexed = indices !== null && indices !== undefined && indices.length > 0;
    const badIndex = indexed && Array.from(indices).some(
      index => !Number.isInteger(index) || index < 0 || index >= vertices,
    );
    const invalid = !positions || positions.length < vertices * 3 ||
      (indexed ? indices.length % 3 !== 0 || badIndex : vertices % 3 !== 0);
    if (invalid) {
      console.warn("[Rewild] Skipping malformed", label, "mesh:", mesh.name);
      mesh.setEnabled(false);
      continue;
    }
    valid.push(mesh);
  }
  return valid;
}
