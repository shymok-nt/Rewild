import Phaser from "phaser";
import "./style.css";
import { RunnerScene } from "./scenes/RunnerScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#9bd9ff",
  width: 960,
  height: 600,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, pixelArt: false },
  scene: [RunnerScene],
  fps: { target: 60, forceSetTimeOut: false },
});

window.addEventListener("pagehide", () => game.destroy(true), { once: true });
