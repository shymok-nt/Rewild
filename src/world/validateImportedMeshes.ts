import { Mesh } from "@babylonjs/core/Meshes/mesh";

/**
 * glTF assets can have incomplete vertex attributes. WebGL rejects draw calls
 * when any enabled attribute buffer is shorter than the vertex range.
 * Normalize these buffers before producing instances.
 */
export function validImportedMeshes(
  meshes: readonly import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh[],
  label: string,
): Mesh[] {
  const valid: Mesh[] = [];
  for (const mesh of meshes) {
    if (!(mesh instanceof Mesh) || mesh.getTotalVertices() === 0) continue;
    const vertices = mesh.getTotalVertices();
    const indices = mesh.getIndices();
    const indexed = !!indices?.length;
    const badIndex = indexed && Array.from(indices!).some(
      index => !Number.isInteger(index) || index < 0 || index >= vertices,
    );
    const positions = mesh.getVerticesData("position");
    if (!positions || positions.length < vertices * 3 || badIndex) {
      console.warn("[Rewild] Skipping malformed", label, "geometry:", mesh.name);
      mesh.setEnabled(false);
      continue;
    }
    // Inspect every vertex buffer, not just positions. This is essential for
    // foliage with UVs, colors, tangents or other optional glTF attributes.
    for (const kind of mesh.getVerticesDataKinds()) {
      const buffer = mesh.getVertexBuffer(kind);
      const stride = buffer?.getSize() ?? (kind === "uv" ? 2 : 3);
      const data = mesh.getVerticesData(kind);
      if (!data || !Number.isFinite(stride) || stride <= 0) continue;
      const expected = vertices * stride;
      if (data.length >= expected) continue;
      const repaired = new Float32Array(expected);
      repaired.set(Array.from(data).slice(0, expected));
      if (kind === "color") {
        for (let i = data.length; i < expected; i += stride) {
          repaired[i] = 1;
          if (stride > 1) repaired[i + 1] = 1;
          if (stride > 2) repaired[i + 2] = 1;
          if (stride > 3) repaired[i + 3] = 1;
        }
      }
      mesh.setVerticesData(kind, repaired, false, stride);
      console.warn("[Rewild] Repaired short vertex attribute:", label, mesh.name, kind);
    }
    valid.push(mesh);
  }
  return valid;
}
