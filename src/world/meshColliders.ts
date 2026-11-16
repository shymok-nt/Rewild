import type { Scene } from "@babylonjs/core/scene";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";

/** Static GLB triangle collision, sampled across the player's standing height.
 * Spatial buckets keep movement checks independent of the total triangle count.
 */
type Segment = { ax: number; az: number; bx: number; bz: number };
const CELL = 3;
const HEIGHTS = [0.3, 0.9, 1.5];
const buckets = new Map<string, Segment[]>();
const key = (x: number, z: number) => Math.floor(x / CELL) + ":" + Math.floor(z / CELL);
let enabled = false;

export function resetMeshColliders(): void {
  buckets.clear();
  enabled = false;
}

function addSegment(segment: Segment): void {
  const minX = Math.floor(Math.min(segment.ax, segment.bx) / CELL);
  const maxX = Math.floor(Math.max(segment.ax, segment.bx) / CELL);
  const minZ = Math.floor(Math.min(segment.az, segment.bz) / CELL);
  const maxZ = Math.floor(Math.max(segment.az, segment.bz) / CELL);
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
    const id = x + ":" + z;
    const bucket = buckets.get(id) ?? [];
    bucket.push(segment);
    buckets.set(id, bucket);
  }
}

function triangleAtHeight(a: Vector3, b: Vector3, c: Vector3, height: number): void {
  const points: Vector3[] = [];
  for (const [p, q] of [[a, b], [b, c], [c, a]]) {
    if ((p.y <= height && q.y > height) || (q.y <= height && p.y > height)) {
      const t = (height - p.y) / (q.y - p.y);
      points.push(Vector3.Lerp(p, q, t));
    }
  }
  if (points.length === 2) addSegment({ ax: points[0].x, az: points[0].z, bx: points[1].x, bz: points[1].z });
}

/** Traverses all renderable GLB child meshes and registers their world-space triangles. */
export function registerGlbCollider(scene: Scene, roots: readonly Mesh[], transforms: readonly Matrix[]): void {
  for (const root of roots) {
    const positions = root.getVerticesData(VertexBuffer.PositionKind);
    const indices = root.getIndices();
    if (!positions || !indices) continue;
    root.computeWorldMatrix(true);
    const base = root.getWorldMatrix();
    const vertices: Vector3[] = [];
    for (let i = 0; i < positions.length; i += 3) vertices.push(new Vector3(positions[i], positions[i + 1], positions[i + 2]));
    for (const placement of transforms) {
      const world = base.multiply(placement);
      const transformed = vertices.map(v => Vector3.TransformCoordinates(v, world));
      for (let i = 0; i + 2 < indices.length; i += 3) {
        const a = transformed[indices[i]];
        const b = transformed[indices[i + 1]];
        const c = transformed[indices[i + 2]];
        for (const height of HEIGHTS) triangleAtHeight(a, b, c, height);
      }
    }
  }
  enabled = true;
  scene.onDisposeObservable.addOnce(resetMeshColliders);
}

export function hitsMeshCollider(x: number, z: number, radius: number): boolean {
  if (!enabled) return false;
  const seen = new Set<Segment>();
  const minX = Math.floor((x - radius) / CELL);
  const maxX = Math.floor((x + radius) / CELL);
  const minZ = Math.floor((z - radius) / CELL);
  const maxZ = Math.floor((z + radius) / CELL);
  for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) {
    for (const segment of buckets.get(cx + ":" + cz) ?? []) {
      if (seen.has(segment)) continue;
      seen.add(segment);
      const dx = segment.bx - segment.ax;
      const dz = segment.bz - segment.az;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - segment.ax) * dx + (z - segment.az) * dz) / lengthSq)) : 0;
      const ox = x - (segment.ax + dx * t);
      const oz = z - (segment.az + dz * t);
      if (ox * ox + oz * oz < radius * radius) return true;
    }
  }
  return false;
}
