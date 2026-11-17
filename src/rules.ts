export type ObstacleType = "coin" | "barrier" | "gate" | "vehicle";
export function clampLane(lane: number): number { return Math.max(-1, Math.min(1, Math.round(lane))); }
export function runnerSpeed(distance: number): number { return Math.min(24, 13 + Math.max(0, distance) / 450); }
export function jumpArc(elapsed: number, duration = 0.82): number {
  if (duration <= 0 || elapsed <= 0 || elapsed >= duration) return 0;
  return Math.sin(elapsed / duration * Math.PI) * 1.8;
}
export function avoidsObstacle(kind: ObstacleType, height: number, sliding: boolean): boolean {
  if (kind === "coin") return true;
  if (kind === "barrier") return height > 0.8;
  if (kind === "gate") return sliding;
  return false;
}
export function crossesPlayer(oldZ: number, newZ: number, halfWidth = 0.45): boolean {
  return oldZ <= halfWidth && newZ >= -halfWidth;
}
/** Resolve lateral overlap at the moment the obstacle passes the player's plane. */
export function overlapsRunner(
  oldZ: number, newZ: number, previousX: number, currentX: number,
  obstacleX: number, halfWidth: number,
): boolean {
  if (!crossesPlayer(oldZ, newZ)) return false;
  const fraction = newZ === oldZ ? 1 : Math.max(0, Math.min(1, -oldZ / (newZ - oldZ)));
  const crossingX = previousX + (currentX - previousX) * fraction;
  return Math.abs(crossingX - obstacleX) <= halfWidth;
}
