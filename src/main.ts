import Phaser from "phaser";
import "./style.css";
import { RunnerScene } from "./scenes/RunnerScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#9bd9ff",
  width: 960,
  height: 600,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
  render: { antialias: true, pixelArt: false },
  scene: [RunnerScene],
  fps: { target: 60, forceSetTimeOut: false },
});

window.addEventListener("pagehide", () => game.destroy(true), { once: true });
