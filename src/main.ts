import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
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
const scene = createWorld(engine, canvas);
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
window.addEventListener("pagehide", () => engine.dispose(), { once: true });
