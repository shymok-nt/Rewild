export interface Footprint { x: number; z: number; halfWidth: number; halfDepth: number }
export const WORLD_HALF_SIZE = 69;
export const PLAYER_RADIUS = 0.4;

/** Resolve a circular player's horizontal motion against solid rectangular footprints. */
export function resolveMovement(
  fromX: number, fromZ: number, dx: number, dz: number, obstacles: readonly Footprint[]
): { x: number; z: number } {
  const moveAxis = (x: number, z: number, axis: "x" | "z", amount: number) => {
    const proposed = (axis === "x" ? x : z) + amount;
    const candidateX = axis === "x" ? proposed : x;
    const candidateZ = axis === "z" ? proposed : z;
    const blocked = obstacles.some((o) => {
      const nearestX = Math.max(o.x - o.halfWidth, Math.min(candidateX, o.x + o.halfWidth));
      const nearestZ = Math.max(o.z - o.halfDepth, Math.min(candidateZ, o.z + o.halfDepth));
      return (candidateX - nearestX) ** 2 + (candidateZ - nearestZ) ** 2 < PLAYER_RADIUS ** 2;
    });
    return blocked ? (axis === "x" ? x : z) : Math.max(-WORLD_HALF_SIZE, Math.min(WORLD_HALF_SIZE, proposed));
  };
  const x = moveAxis(fromX, fromZ, "x", dx);
  const z = moveAxis(x, fromZ, "z", dz);
  return { x, z };
}
