export type ResourceKind = "wood" | "stone";
export interface ResourceStack { kind: ResourceKind; count: number }
export const RESOURCE_LABELS: Record<ResourceKind, string> = { wood: "Odun", stone: "Taş" };
const STORAGE_KEY = "rewild.inventory.v1";
export class Inventory {
  private amounts: Record<ResourceKind, number> = { wood: 0, stone: 0 };
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<Record<ResourceKind, unknown>>;
      for (const kind of ["wood", "stone"] as const) {
        const value = saved[kind];
        if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) this.amounts[kind] = value;
      }
    } catch { /* unavailable storage or invalid old data */ }
  }
  add(kind: ResourceKind, count = 1): void {
    if (!Number.isSafeInteger(count) || count <= 0) return;
    this.amounts[kind] = Math.min(9999, this.amounts[kind] + count);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.amounts)); } catch { /* session-only */ }
  }
  count(kind: ResourceKind): number { return this.amounts[kind]; }
  snapshot(): ResourceStack[] {
    return (["wood", "stone"] as const).map(kind => ({ kind, count: this.amounts[kind] }));
  }
}
