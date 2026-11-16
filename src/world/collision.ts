import { hitsMeshCollider } from "./meshColliders";
export interface Footprint { x: number; z: number; halfWidth: number; halfDepth: number }
export const WORLD_HALF_SIZE = 69;
export const PLAYER_RADIUS = 0.4;

/** A single authoritative XZ collider set for trees, stones, buildings and props. */
export function collides(x: number, z: number, obstacles: readonly Footprint[]): boolean {
  if (hitsMeshCollider(x, z, PLAYER_RADIUS)) return true;
  return obstacles.some(o => {
    const nearestX = Math.max(o.x - o.halfWidth, Math.min(x, o.x + o.halfWidth));
    const nearestZ = Math.max(o.z - o.halfDepth, Math.min(z, o.z + o.halfDepth));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

function clampWorld(value: number): number {
  return Math.max(-WORLD_HALF_SIZE, Math.min(WORLD_HALF_SIZE, value));
}

/** Resolve existing overlaps too, including after a resource regrows. */
export function separateFromObstacles(x: number, z: number, obstacles: readonly Footprint[]): { x: number; z: number } {
  for (let iteration = 0; iteration < 8; iteration++) {
    if (!collides(x, z, obstacles)) break;
    let moved = false;
    for (const o of obstacles) {
      const left = o.x - o.halfWidth - PLAYER_RADIUS - 0.005;
      const right = o.x + o.halfWidth + PLAYER_RADIUS + 0.005;
      const bottom = o.z - o.halfDepth - PLAYER_RADIUS - 0.005;
      const top = o.z + o.halfDepth + PLAYER_RADIUS + 0.005;
      if (x <= left || x >= right || z <= bottom || z >= top) continue;
      const choices = [
        { distance: Math.abs(x - left), x: left, z },
        { distance: Math.abs(x - right), x: right, z },
        { distance: Math.abs(z - bottom), x, z: bottom },
        { distance: Math.abs(z - top), x, z: top },
      ];
      choices.sort((a, b) => a.distance - b.distance);
      x = clampWorld(choices[0].x);
      z = clampWorld(choices[0].z);
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

/** Swept axis movement prevents tunnelling even at sprint speed. */
export function resolveMovement(fromX: number, fromZ: number, dx: number, dz: number, obstacles: readonly Footprint[]): { x: number; z: number } {
  const initial = separateFromObstacles(fromX, fromZ, obstacles);
  let x = initial.x;
  let z = initial.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let i = 0; i < steps; i++) {
    const nextX = clampWorld(x + dx / steps);
    if (!collides(nextX, z, obstacles)) x = nextX;
    const nextZ = clampWorld(z + dz / steps);
    if (!collides(x, nextZ, obstacles)) z = nextZ;
  }
  return { x, z };
}
