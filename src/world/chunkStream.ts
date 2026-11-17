import "@babylonjs/core/Meshes/thinInstanceMesh";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export const CHUNK_SIZE = 12;
export const LOAD_RADIUS = 4;
export const UNLOAD_RADIUS = 6;
export type ChunkPosition = { x: number; z: number };
export type ChunkGenerator = (cx: number, cz: number, lod: number, random: () => number) => Matrix[];
export function chunkRandom(cx: number, cz: number): () => number {
  let state = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x51f15e) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Shared mesh geometry/material; only per-chunk matrix buffers are allocated. */
export function createChunkStream(scene: Scene, source: Mesh, position: () => ChunkPosition,
  generate: ChunkGenerator, options: { size?: number; load?: number; unload?: number; bounds?: number } = {}) {
  const size = options.size ?? CHUNK_SIZE;
  const load = options.load ?? LOAD_RADIUS;
  const unload = Math.max(load + 1, options.unload ?? UNLOAD_RADIUS);
  const bounds = options.bounds ?? 68;
  const active = new Map<string, Mesh>();
  let pending: { cx: number; cz: number; distance: number }[] = [];
  let lastCx = Infinity;
  let lastCz = Infinity;
  let frame = 0;
  let disposed = false;
  source.isVisible = false;
  const observer = scene.onBeforeRenderObservable.add(() => {
    if (disposed) return;
    const p = position();
    const cx = Math.floor(p.x / size);
    const cz = Math.floor(p.z / size);
    if (cx !== lastCx || cz !== lastCz) {
      lastCx = cx;
      lastCz = cz;
      for (const [key, mesh] of active) {
        const [x, z] = key.split(",").map(Number);
        if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > unload) {
          // Geometry and material belong to source; never dispose shared assets.
          mesh.dispose(false, false);
          active.delete(key);
        }
      }
      pending = [];
      for (let dx = -load; dx <= load; dx++) {
        for (let dz = -load; dz <= load; dz++) {
          const x = cx + dx;
          const z = cz + dz;
          if (Math.abs((x + 0.5) * size) > bounds + size || Math.abs((z + 0.5) * size) > bounds + size) continue;
          if (!active.has(x + "," + z)) pending.push({ cx: x, cz: z, distance: dx * dx + dz * dz });
        }
      }
      pending.sort((a, b) => a.distance - b.distance);
    }
    // Queue work, at most two chunks per rendered frame.
    for (let i = 0; i < 2 && pending.length; i++) {
      const next = pending.shift()!;
      const key = next.cx + "," + next.cz;
      if (active.has(key)) continue;
      const distance = Math.max(Math.abs(next.cx - cx), Math.abs(next.cz - cz));
      const lod = distance <= 1 ? 1 : distance <= 2 ? 0.55 : 0.22;
      const matrices = generate(next.cx, next.cz, lod, chunkRandom(next.cx, next.cz));
      if (!matrices.length) continue;
      const mesh = source.clone("chunk-" + key, null, true, false);
      if (!mesh) continue;
      mesh.isVisible = true;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = false;
      const buffer = new Float32Array(matrices.length * 16);
      matrices.forEach((matrix, index) => matrix.copyToArray(buffer, index * 16));
      mesh.thinInstanceSetBuffer("matrix", buffer, 16, true);
      mesh.thinInstanceRefreshBoundingInfo();
      active.set(key, mesh);
    }
    frame++;
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.onBeforeRenderObservable.remove(observer);
    for (const mesh of active.values()) mesh.dispose(false, false);
    active.clear();
    pending = [];
  };
  scene.onDisposeObservable.add(dispose);
  return { dispose, active };
}
