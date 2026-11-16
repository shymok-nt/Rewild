import type { Scene } from "@babylonjs/core/scene";
import { Inventory, RESOURCE_LABELS } from "./inventory";
import { createHarvestNodes, nearestHarvestNode } from "./harvesting";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export function createGatheringSystem(scene: Scene, player: TransformNode): void {
  const inventory = new Inventory();
  const nodes = createHarvestNodes(scene);
  const panel = document.createElement("section");
  panel.id = "rewild-inventory";
  panel.setAttribute("aria-label", "Envanter");
  panel.hidden = true;
  panel.innerHTML = '<h2>ÇANTA <small>[I] Kapat</small></h2><div id="rewild-items"></div><p>Kaynaklar bu tarayıcıda saklanır.</p>';
  const prompt = document.createElement("div");
  prompt.id = "rewild-interaction";
  prompt.setAttribute("aria-live", "polite");
  const toast = document.createElement("div");
  toast.id = "rewild-toast";
  document.body.append(panel, prompt, toast);
  const items = panel.querySelector<HTMLElement>("#rewild-items");
  const renderInventory = () => {
    if (items) items.textContent = inventory.snapshot().map(stack => RESOURCE_LABELS[stack.kind] + ": " + stack.count).join("   •   ");
  };
  renderInventory();
  let noticeUntil = 0;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === "KeyI") {
      event.preventDefault();
      panel.hidden = !panel.hidden;
      renderInventory();
      return;
    }
    if (event.code !== "KeyE" || !panel.hidden) return;
    const target = nearestHarvestNode(nodes, player.position);
    if (!target || performance.now() < target.cooldownUntil) return;
    event.preventDefault();
    target.remaining--;
    target.cooldownUntil = performance.now() + 450;
    inventory.add(target.kind);
    renderInventory();
    toast.textContent = "+1 " + RESOURCE_LABELS[target.kind];
    noticeUntil = performance.now() + 1250;
    if (target.remaining <= 0) {
      target.visual.setEnabled(false);
      // Depleted nodes regenerate after 30 seconds, preserving gameplay availability.
      target.cooldownUntil = performance.now() + 30000;
    }
  };
  window.addEventListener("keydown", onKeyDown);
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    for (const node of nodes) {
      if (node.remaining === 0 && now >= node.cooldownUntil) {
        node.remaining = node.maximum;
        node.visual.setEnabled(true);
      }
    }
    const target = nearestHarvestNode(nodes, player.position);
    prompt.textContent = target && panel.hidden ? "[E] " + target.label + " topla (" + target.remaining + " kaldı)" : "";
    toast.style.opacity = now < noticeUntil ? "1" : "0";
  });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", onKeyDown);
    panel.remove();
    prompt.remove();
    toast.remove();
  });
}
