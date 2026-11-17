import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
// glTF assets use PBRMaterial, which needs its own vertex/fragment shader pair.
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";
// GLB textures and environment decoding require these shader registrations.
// Without them Babylon requests shader URLs and Vite returns index.html.
import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createWorld } from "./world/createWorld";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
if (!canvas) throw new Error("Missing #renderCanvas");

const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
// Render at a bounded resolution on high-DPI displays. Dynamic resolution
// adjusts only occasionally to avoid frame-to-frame visual instability.
const nativeRatio = Math.max(1, window.devicePixelRatio || 1);
const maxRatio = Math.min(nativeRatio, 1.5);
let resolutionScale = maxRatio;
engine.setHardwareScalingLevel(nativeRatio / resolutionScale);
const scene = createWorld(engine, canvas);
let sampledFrames = 0;
let sampledTime = 0;
let cooldown = 0;
scene.onAfterRenderObservable.add(() => {
  sampledFrames++;
  sampledTime += Math.min(engine.getDeltaTime(), 100);
  if (sampledTime < 2500) return;
  const fps = sampledFrames * 1000 / sampledTime;
  sampledFrames = 0;
  sampledTime = 0;
  if (cooldown > 0) { cooldown--; return; }
  const next = fps < 42
    ? Math.max(0.75, resolutionScale - 0.125)
    : fps > 57 ? Math.min(maxRatio, resolutionScale + 0.125) : resolutionScale;
  if (next !== resolutionScale) {
    resolutionScale = next;
    engine.setHardwareScalingLevel(nativeRatio / resolutionScale);
    engine.resize();
    cooldown = 2;
  }
});
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
window.addEventListener("pagehide", () => engine.dispose(), { once: true });
