/// <reference types="vite/client" />

import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";

export function createDebugTools(scene: Scene, engine: Engine): void {
  if (!import.meta.env.DEV) return;

  const panel = document.createElement("aside");
  panel.id = "rewild-debug-stats";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Geliştirme istatistikleri");
  document.body.appendChild(panel);

  let inspectorVisible = false;
  let inspectorLoading = false;
  const update = () => {
    panel.innerHTML =
      "<strong>DEBUG</strong>" +
      "<span>FPS " + Math.round(engine.getFps()) + "</span>" +
      "<span>Aktif mesh " + scene.getActiveMeshes().length + " / " + scene.meshes.length + "</span>" +
      "<span>Draw call " + engine._drawCalls.total + "</span>" +
      "<small>F8 Inspector · F9 panel</small>";
  };
  let elapsed = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    if (!panel.hidden) {
      elapsed += engine.getDeltaTime();
      if (elapsed >= 250) {
        elapsed = 0;
        update();
      }
    }
  });

  const toggleInspector = async (): Promise<void> => {
    if (inspectorLoading) return;
    inspectorLoading = true;
    try {
      const { Inspector } = await import("@babylonjs/inspector");
      if (inspectorVisible) {
        Inspector.Hide();
        inspectorVisible = false;
      } else {
        Inspector.Show(scene, { overlay: true });
        inspectorVisible = true;
      }
    } finally {
      inspectorLoading = false;
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "F9") {
      event.preventDefault();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) update();
    } else if (event.code === "F8") {
      event.preventDefault();
      void toggleInspector();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  scene.onDisposeObservable.add(() => {
    scene.onBeforeRenderObservable.remove(observer);
    window.removeEventListener("keydown", onKeyDown);
    if (inspectorVisible) {
      void import("@babylonjs/inspector").then(({ Inspector }) => Inspector.Hide());
    }
    panel.remove();
  });
}
