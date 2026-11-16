import type { Scene } from "@babylonjs/core/scene";
import { Inventory, RESOURCE_LABELS } from "./inventory";
import { createHarvestNodes, nearestHarvestNode } from "./harvesting";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { PlayerController } from "../player/createPlayer";
import type { Footprint } from "../world/collision";
import type { HarvestNode } from "./harvesting";

export function createGatheringSystem(scene: Scene, player: PlayerController, obstacles: Footprint[]): HarvestNode[] {
  const inventory = new Inventory();
  const nodes = createHarvestNodes(scene);
  const resourceColliders = new Map<string, Footprint>();
  for (const node of nodes) {
    const radius = node.kind === "wood" ? 0.9 : 0.65;
    const footprint: Footprint = { x: node.position.x, z: node.position.z, halfWidth: radius, halfDepth: radius };
    obstacles.push(footprint);
    resourceColliders.set(node.id, footprint);
  }
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
  let audio: AudioContext | null = null;
  function playImpact(kind: "wood" | "stone"): void {
    try {
      audio ??= new AudioContext();
      if (audio.state === "suspended") void audio.resume();
      const oscillator = audio.createOscillator();
      const volume = audio.createGain();
      const now = audio.currentTime;
      oscillator.type = kind === "wood" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(kind === "wood" ? 160 : 390, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "wood" ? 75 : 170, now + 0.11);
      volume.gain.setValueAtTime(0.06, now);
      volume.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      oscillator.connect(volume);
      volume.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } catch { /* Audio is optional; harvesting must still work. */ }
  }
  const fragments: { mesh: ReturnType<typeof MeshBuilder.CreateBox>; velocity: Vector3; until: number }[] = [];
  const woodParticle = new StandardMaterial("wood-chips", scene);
  woodParticle.diffuseColor = Color3.FromHexString("#B89B70");
  const stoneParticle = new StandardMaterial("stone-chips", scene);
  stoneParticle.diffuseColor = Color3.FromHexString("#B4B9B0");
  function burst(x: number, z: number, kind: "wood" | "stone"): void {
    const now = performance.now();
    for (let i = 0; i < (kind === "wood" ? 12 : 8); i++) {
      const chip = MeshBuilder.CreateBox("harvest-chip", { size: kind === "wood" ? 0.15 : 0.11 }, scene);
      chip.material = kind === "wood" ? woodParticle : stoneParticle;
      chip.position.set(x, kind === "wood" ? 1.4 : 0.6, z);
      const angle = (i / (kind === "wood" ? 12 : 8)) * Math.PI * 2;
      fragments.push({ mesh: chip, velocity: new Vector3(Math.cos(angle) * 2.8, 2.1 + (i % 5) * 0.35, Math.sin(angle) * 2.8), until: now + 600 });
    }
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === "KeyI") {
      event.preventDefault();
      panel.hidden = !panel.hidden;
      renderInventory();
      return;
    }
    if (event.code !== "KeyE" || !panel.hidden) return;
    const target = nearestHarvestNode(nodes, player.root.position);
    if (!target || performance.now() < target.cooldownUntil) return;
    event.preventDefault();
    player.harvest();
    playImpact(target.kind);
    target.remaining--;
    target.hitUntil = performance.now() + 180;
    burst(target.position.x, target.position.z, target.kind);
    target.cooldownUntil = performance.now() + 450;
    inventory.add(target.kind);
    renderInventory();
    toast.textContent = "+1 " + RESOURCE_LABELS[target.kind];
    noticeUntil = performance.now() + 1250;
    if (target.remaining <= 0) {
      target.visual.setEnabled(false);
      const collider = resourceColliders.get(target.id);
      if (collider) {
        const index = obstacles.indexOf(collider);
        if (index >= 0) obstacles.splice(index, 1);
      }
      // Depleted nodes regenerate after 30 seconds, preserving gameplay availability.
      target.cooldownUntil = performance.now() + 30000;
    }
  };
  window.addEventListener("keydown", onKeyDown);
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    for (let i = fragments.length - 1; i >= 0; i--) {
      const fragment = fragments[i];
      if (now >= fragment.until) {
        fragment.mesh.dispose();
        fragments.splice(i, 1);
        continue;
      }
      fragment.velocity.y -= 10 * dt;
      fragment.mesh.position.addInPlace(fragment.velocity.scale(dt));
      fragment.mesh.rotation.x += dt * 6;
    }
    for (const node of nodes) {
      if (node.remaining > 0) {
        node.visual.scaling.copyFrom(node.baseScale);
        if (now < node.hitUntil) node.visual.scaling.scaleInPlace(0.91);
      }
      if (node.remaining === 0 && now >= node.cooldownUntil) {
        node.remaining = node.maximum;
        node.visual.setEnabled(true);
        const collider = resourceColliders.get(node.id);
        if (collider && !obstacles.includes(collider)) obstacles.push(collider);
      }
    }
    const target = nearestHarvestNode(nodes, player.root.position);
    prompt.textContent = target && panel.hidden ? "[E] " + target.label + " topla (" + target.remaining + " kaldı)" : "";
    toast.style.opacity = now < noticeUntil ? "1" : "0";
  });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", onKeyDown);
    panel.remove();
    prompt.remove();
    toast.remove();
    for (const fragment of fragments) fragment.mesh.dispose();
    if (audio) void audio.close();
  });
  return nodes;
}
