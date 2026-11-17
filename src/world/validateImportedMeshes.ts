import { Mesh } from "@babylonjs/core/Meshes/mesh";

/** Reject malformed imported geometry before creating hundreds of GPU instances. */
export function validImportedMeshes(meshes: readonly import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh[], label: string): Mesh[] {
  const valid: Mesh[] = [];
  for (const mesh of meshes) {
    if (!(mesh instanceof Mesh) || mesh.getTotalVertices() === 0) continue;
    const positions = mesh.getVerticesData("position");
    const indices = mesh.getIndices();
    const vertices = mesh.getTotalVertices();
    const badIndex = indices?.some(index => !Number.isInteger(index) || index < 0 || index >= vertices);
    const invalid = !positions || positions.length < vertices * 3 ||
      !indices || indices.length < 3 || indices.length % 3 !== 0 || badIndex;
    if (invalid) {
      console.warn("[Rewild] Skipping invalid", label, "geometry:", mesh.name);
      mesh.setEnabled(false);
      continue;
    }
    valid.push(mesh);
  }
  return valid;
}
