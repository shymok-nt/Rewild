import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";

type GripSettings = { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number };
const STORAGE_KEY = "rewild-axe-grip-v2";
const defaults: GripSettings = { x: 0.01, y: -0.065, z: 0.155, rx: 2, ry: -93, rz: -59, scale: 0.04 };

export async function equipAxe(
  scene: Scene,
  player: TransformNode,
  _isHarvesting: () => boolean = () => false,
  getRightHand: () => AbstractMesh | null = () => null,
): Promise<void> {
  const imported = await SceneLoader.ImportMeshAsync("", "/models/", "Axe.glb", scene);
  if (scene.isDisposed) {
    imported.meshes.forEach(mesh => mesh.dispose());
    return;
  }
  if (!imported.meshes.some(mesh => mesh.getTotalVertices() > 0)) throw new Error("Axe.glb has no visible geometry");

  const handSocket = new TransformNode("RightHandGrip", scene);
  handSocket.parent = player;
  const adjust = new TransformNode("axe-grip-adjustment", scene);
  adjust.parent = handSocket;
  const model = new TransformNode("axe-asset-orientation", scene);
  model.parent = adjust;
  model.rotation.x = Math.PI / 2;
  const grip = new TransformNode("axe-shaft-GripPoint", scene);
  grip.parent = model;
  grip.position.set(-1.7, 0, -4.5);
  for (const mesh of imported.meshes) {
    if (!mesh.parent) mesh.parent = grip;
    mesh.isPickable = false;
  }

  let settings: GripSettings = { ...defaults };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<GripSettings> | null;
    if (stored) for (const key of Object.keys(defaults) as (keyof GripSettings)[]) {
      if (typeof stored[key] === "number" && Number.isFinite(stored[key])) settings[key] = stored[key];
    }
  } catch { /* invalid saved configuration */ }

  const apply = () => {
    adjust.position.set(settings.x, settings.y, settings.z);
    adjust.rotation.set(settings.rx * Math.PI / 180, settings.ry * Math.PI / 180, settings.rz * Math.PI / 180);
    model.scaling.setAll(settings.scale);
  };
  apply();

  const panel = document.createElement("section");
  panel.id = "rewild-axe-editor";
  panel.style.cssText = "position:fixed;right:16px;top:82px;z-index:100;background:#14251feF;color:#f6f5e9;padding:15px;border-radius:12px;width:245px;font:13px system-ui;box-shadow:0 10px 35px #0008;display:none;max-height:75vh;overflow:auto";
  panel.innerHTML = '<div style="font-weight:700;font-size:16px;margin-bottom:8px">Balta tutuş ayarı</div><div style="opacity:.75;font-size:11px;margin-bottom:10px">F8 ile aç/kapat · Değerler anında uygulanır</div>';
  const fields: Array<[keyof GripSettings, string, number, number, number]> = [
    ["x", "Konum X", -0.5, 0.5, 0.005], ["y", "Konum Y", -0.5, 0.5, 0.005],
    ["z", "Konum Z", -0.5, 0.5, 0.005], ["rx", "Açı X", -180, 180, 1],
    ["ry", "Açı Y", -180, 180, 1], ["rz", "Açı Z", -180, 180, 1],
    ["scale", "Ölçek", 0.01, 0.1, 0.001],
  ];
  for (const [key, label, min, max, step] of fields) {
    const line = document.createElement("label");
    line.style.cssText = "display:block;margin:8px 0";
    const heading = document.createElement("div");
    heading.style.cssText = "display:flex;justify-content:space-between;margin-bottom:3px";
    const name = document.createElement("span");
    name.textContent = label;
    const value = document.createElement("output");
    value.textContent = String(settings[key]);
    heading.append(name, value);
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = String(min); slider.max = String(max); slider.step = String(step);
    slider.value = String(settings[key]); slider.style.width = "100%";
    slider.addEventListener("input", () => { settings[key] = Number(slider.value); value.textContent = slider.value; apply(); });
    line.append(heading, slider); panel.append(line);
  }
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:6px;margin-top:12px";
  const makeButton = (label: string, action: () => void) => {
    const button = document.createElement("button");
    button.textContent = label; button.type = "button";
    button.style.cssText = "flex:1;padding:8px 4px;background:#d4e3b5;border:0;border-radius:6px;cursor:pointer";
    button.addEventListener("click", action); buttons.append(button);
  };
  makeButton("Kaydet", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    status.textContent = "Kaydedildi";
  });
  makeButton("Kopyala", () => {
    const data = JSON.stringify(settings, null, 2);
    void navigator.clipboard?.writeText(data).then(() => { status.textContent = "Ayarlar kopyalandı"; }).catch(() => { status.textContent = data; });
  });
  makeButton("Sıfırla", () => {
    localStorage.removeItem(STORAGE_KEY);
    settings = { ...defaults };
    apply();
    const inputs = panel.querySelectorAll<HTMLInputElement>('input[type="range"]');
    fields.forEach(([key], i) => {
      inputs[i].value = String(settings[key]);
      const output = inputs[i].parentElement?.querySelector("output");
      if (output) output.textContent = String(settings[key]);
    });
    status.textContent = "Varsayılan ayarlara dönüldü";
  });
  panel.append(buttons);
  const status = document.createElement("p");
  status.style.cssText = "font-size:11px;opacity:.8;overflow-wrap:anywhere";
  panel.append(status);
  document.body.append(panel);
  const toggle = (event: KeyboardEvent) => {
    if (event.key !== "F8") return;
    event.preventDefault();
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    if (panel.style.display === "block" && document.pointerLockElement) document.exitPointerLock();
  };
  window.addEventListener("keydown", toggle);

  let attached: AbstractMesh | null = null;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const hand = getRightHand();
    if (!hand || hand === attached) return;
    attached = hand;
    // Follow the animated hand hierarchy directly, never the torso centre.
    handSocket.parent = hand;
    const bounds = hand.getBoundingInfo().boundingBox;
    const palm = bounds.minimum.add(bounds.maximum).scale(0.5);
    handSocket.position.copyFrom(palm);
    handSocket.rotation.set(0, 0, 0);
  });

  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    window.removeEventListener("keydown", toggle);
    panel.remove();
    handSocket.dispose(false, true);
  });
}
