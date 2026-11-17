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
import type { ForestTree } from "../world/installOakForest";

export function createGatheringSystem(scene: Scene, player: PlayerController, obstacles: Footprint[], forestTrees: readonly ForestTree[] = []): HarvestNode[] {
  const inventory = new Inventory();
  const nodes = createHarvestNodes(scene);
  // Convert every placed forest tree and boulder into a harvestable resource.
  // Their GLB instances will be parented to these lightweight visual anchors.
  const rockMeshes = scene.meshes.filter(mesh => /^rock-\\d+$/.test(mesh.name));
  const extraResources: { kind: "wood" | "stone"; x: number; z: number; id: string }[] = [
    ...forestTrees.map((tree, i) => ({ kind: "wood" as const, x: tree.x, z: tree.z, id: "forest-" + i })),
    ...rockMeshes.map((rock, i) => ({ kind: "stone" as const, x: rock.position.x, z: rock.position.z, id: "boulder-" + i })),
  ];
  for (const item of extraResources) {
    const visual = MeshBuilder.CreateBox("resource-anchor-" + item.id, { size: 0.01 }, scene);
    visual.position.set(item.x, 0, item.z);
    visual.isVisible = false;
    visual.isPickable = false;
    nodes.push({
      id: item.id,
      kind: item.kind,
      label: item.kind === "wood" ? "Ağaç" : "Taş",
      position: new Vector3(item.x, 0, item.z),
      remaining: item.kind === "wood" ? 5 : 4,
      maximum: item.kind === "wood" ? 5 : 4,
      cooldownUntil: 0,
      visual,
      baseScale: visual.scaling.clone(),
      hitUntil: 0,
    });
  }
  const resourceColliders = new Map<string, Footprint>();
  for (const node of nodes) {
    const existing = obstacles.find(c => Math.abs(c.x - node.position.x) < 0.01 && Math.abs(c.z - node.position.z) < 0.01);
    const radius = node.kind === "wood" ? 0.9 : 0.65;
    const footprint: Footprint = existing ?? { x: node.position.x, z: node.position.z, halfWidth: radius, halfDepth: radius };
    if (!existing) obstacles.push(footprint);
    resourceColliders.set(node.id, footprint);
  }
  // Stable pseudo-random spawn selection, constrained to playable meadow.
  let spawnSeed = 0x42f0a1;
  const random = () => {
    spawnSeed = (Math.imul(spawnSeed, 1664525) + 1013904223) >>> 0;
    return spawnSeed / 4294967296;
  };
  const findSpawn = (node: HarvestNode): Vector3 | null => {
    for (let attempt = 0; attempt < 120; attempt++) {
      const x = (random() - 0.5) * 124;
      const z = (random() - 0.5) * 124;
      if (Math.hypot(x - player.root.position.x, z - player.root.position.z) < 15) continue;
      if (Math.abs(x) < 7 && Math.abs(z) < 10) continue;
      if (Math.abs(x + 12) < 10 && Math.abs(z - 46) < 9) continue;
      if (z >= 7 && z <= 60 && Math.abs(x - Math.sin(z * 0.12) * 3) < 7) continue;
      if (nodes.some(other => other !== node && other.remaining > 0 &&
        Math.hypot(x - other.position.x, z - other.position.z) < (node.kind === "wood" || other.kind === "wood" ? 9 : 4))) continue;
      if (obstacles.some(c => c !== resourceColliders.get(node.id) &&
        Math.abs(x - c.x) < c.halfWidth + 2 && Math.abs(z - c.z) < c.halfDepth + 2)) continue;
      return new Vector3(x, 0, z);
    }
    return null;
  };
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
  // Nine-slot survival hotbar. It mirrors the real saved inventory;
  // selecting a slot does not pretend to equip an unimplemented item.
  const hotbar = document.createElement("nav");
  hotbar.id = "rewild-hotbar";
  hotbar.setAttribute("aria-label", "Hızlı erişim çubuğu");
  const slotItems = [
    { icon: "🪓", label: "Balta", kind: null },
    { icon: "🪵", label: "Odun", kind: "wood" },
    { icon: "🪨", label: "Taş", kind: "stone" },
    ...Array.from({ length: 6 }, () => ({ icon: "", label: "Boş", kind: null })),
  ] as const;
  let selectedSlot = 0;
  const slotElements = slotItems.map((item, index) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "rewild-hotbar-slot";
    slot.title = item.label;
    slot.setAttribute("aria-label", (index + 1) + ". " + item.label);
    slot.innerHTML = '<span class="rewild-slot-key">' + (index + 1) + '</span><span class="rewild-slot-icon"></span><span class="rewild-slot-count"></span>';
    slot.querySelector<HTMLElement>(".rewild-slot-icon")!.textContent = item.icon;
    slot.addEventListener("click", () => selectSlot(index));
    hotbar.appendChild(slot);
    return slot;
  });
  function selectSlot(index: number): void {
    selectedSlot = (index + 9) % 9;
    slotElements.forEach((slot, i) => {
      slot.classList.toggle("is-selected", i === selectedSlot);
      slot.setAttribute("aria-pressed", String(i === selectedSlot));
    });
  }
  function updateHotbar(): void {
    slotItems.forEach((item, i) => {
      const count = item.kind ? inventory.count(item.kind) : 0;
      slotElements[i].querySelector<HTMLElement>(".rewild-slot-count")!.textContent = count > 0 ? String(count) : "";
      slotElements[i].classList.toggle("is-empty", i > 0 && count === 0);
    });
  }
  selectSlot(0);
  updateHotbar();
  document.body.appendChild(hotbar);

  const items = panel.querySelector<HTMLElement>("#rewild-items");
  const renderInventory = () => {
    if (items) items.textContent = inventory.snapshot().map(stack => RESOURCE_LABELS[stack.kind] + ": " + stack.count).join("   •   ");
    updateHotbar();
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
    if (/^Digit[1-9]$/.test(event.code) && panel.hidden) {
      selectSlot(Number(event.code.slice(5)) - 1);
      return;
    }
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
      // Respawn elsewhere after a staggered cooldown; reuse the same GLB instances.
      target.cooldownUntil = performance.now() + 25000 + random() * 20000;
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
        const spawn = findSpawn(node);
        if (!spawn) {
          node.cooldownUntil = now + 5000;
          continue;
        }
        node.position.copyFrom(spawn);
        // Special resource visuals have an original local height offset.
        node.visual.position.x = spawn.x;
        node.visual.position.z = spawn.z;
        node.remaining = node.maximum;
        node.visual.setEnabled(true);
        const collider = resourceColliders.get(node.id);
        if (collider) {
          collider.x = spawn.x;
          collider.z = spawn.z;
          if (!obstacles.includes(collider)) obstacles.push(collider);
        }
      }
    }
    const target = nearestHarvestNode(nodes, player.root.position);
    prompt.textContent = target && panel.hidden ? "[E] " + target.label + " topla (" + target.remaining + " kaldı)" : "";
    toast.style.opacity = now < noticeUntil ? "1" : "0";
  });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", onKeyDown);
    panel.remove();
    hotbar.remove();
    prompt.remove();
    toast.remove();
    for (const fragment of fragments) fragment.mesh.dispose();
    if (audio) void audio.close();
  });
  return nodes;
}
