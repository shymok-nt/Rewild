import Phaser from "phaser";

const W = 960;
const H = 600;
const HORIZON = 162;
const BOTTOM = 622;
const ROAD_TOP = 66;
const ROAD_BOTTOM = 440;
const LANES = [-1, 0, 1] as const;

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp01(t: number): number { return Math.max(0, Math.min(1, t)); }

export class RunnerScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lane = 0;
  private visualLane = 0;
  private distance = 0;
  private jumpTime = 0;
  private slideTime = 0;
  private runClock = 0;
  private pointerStart: { x: number; y: number } | null = null;

  constructor() { super("RunnerScene"); }

  create(): void {
    this.art = this.add.graphics();
    this.title = this.add.text(26, 20, "RUSH CITY", {
      fontFamily: "Arial, sans-serif", fontSize: "31px", fontStyle: "bold",
      color: "#ffffff", stroke: "#25395e", strokeThickness: 6,
    }).setDepth(10);
    this.hud = this.add.text(28, 66, "", {
      fontFamily: "Arial, sans-serif", fontSize: "16px", color: "#ffffff",
      stroke: "#25395e", strokeThickness: 4,
    }).setDepth(10);
    this.add.text(W / 2, H - 25, "← →  ŞERİT     SPACE  ZIPLA     ↓  KAY", {
      fontFamily: "Arial, sans-serif", fontSize: "15px", color: "#ffffff",
      stroke: "#25395e", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    const kb = this.input.keyboard;
    if (!kb) throw new Error("Keyboard input unavailable");
    this.keys = kb.addKeys("A,D,LEFT,RIGHT,SPACE,UP,DOWN,S,R") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerStart = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.pointerStart) return;
      const dx = p.x - this.pointerStart.x, dy = p.y - this.pointerStart.y;
      this.pointerStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
      if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 1 : -1);
      else if (dy < 0) this.jump();
      else this.slide();
    });
  }

  private move(dir: number): void { this.lane = Phaser.Math.Clamp(this.lane + dir, -1, 1); }
  private jump(): void { if (this.jumpTime <= 0 && this.slideTime <= 0) this.jumpTime = 0.78; }
  private slide(): void { if (this.slideTime <= 0 && this.jumpTime <= 0) this.slideTime = 0.7; }
  private hit(key: string): boolean { return Phaser.Input.Keyboard.JustDown(this.keys[key]); }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.hit("LEFT") || this.hit("A")) this.move(-1);
    if (this.hit("RIGHT") || this.hit("D")) this.move(1);
    if (this.hit("SPACE") || this.hit("UP")) this.jump();
    if (this.hit("DOWN") || this.hit("S")) this.slide();
    if (this.hit("R")) { this.lane = 0; this.distance = 0; }
    this.visualLane = Phaser.Math.Linear(this.visualLane, this.lane, 1 - Math.exp(-dt * 14));
    this.jumpTime = Math.max(0, this.jumpTime - dt);
    this.slideTime = Math.max(0, this.slideTime - dt);
    this.distance += dt * 20;
    this.runClock += dt * 12;
    this.draw();
    this.hud.setText(`MESAFE  ${Math.floor(this.distance)} m    •    ${Math.round(this.game.loop.actualFps)} FPS`);
  }

  private roadY(t: number): number { return lerp(HORIZON, BOTTOM, t * t); }
  private roadHalf(t: number): number { return lerp(ROAD_TOP, ROAD_BOTTOM, t); }
  private roadX(lane: number, t: number): number { return W / 2 + lane * this.roadHalf(t) / 3; }

  private poly(points: number[], color: number, alpha = 1): void {
    this.art.fillStyle(color, alpha);
    this.art.fillPoints([
      new Phaser.Geom.Point(points[0], points[1]),
      new Phaser.Geom.Point(points[2], points[3]),
      new Phaser.Geom.Point(points[4], points[5]),
      new Phaser.Geom.Point(points[6], points[7]),
    ], true);
  }

  private draw(): void {
    const g = this.art;
    g.clear();
    g.fillGradientStyle(0x78c8f4, 0x78c8f4, 0xd8f4ff, 0xd8f4ff);
    g.fillRect(0, 0, W, HORIZON + 50);
    g.fillStyle(0xffe4a1);
    g.fillCircle(744, 88, 45);
    // Distant skyline: deterministic, no new objects or random allocations per frame.
    for (let i = 0; i < 28; i++) {
      const x = i * 38 - 18;
      const height = 38 + ((i * 73 + 19) % 72);
      g.fillStyle(i % 3 === 0 ? 0x8da7c6 : 0xa6b9d0);
      g.fillRect(x, HORIZON - height, 33, height);
      g.fillStyle(0xd9e7f4, 0.7);
      for (let j = 0; j < 3; j++) g.fillRect(x + 6 + j * 9, HORIZON - height + 10, 4, 7);
    }
    g.fillStyle(0x78b78b);
    g.fillRect(0, HORIZON, W, H - HORIZON);

    // Road and pavements.
    this.poly([W/2-ROAD_TOP-28,HORIZON,W/2+ROAD_TOP+28,HORIZON,W/2+ROAD_BOTTOM+38,BOTTOM,W/2-ROAD_BOTTOM-38,BOTTOM],0xe5d7c5);
    this.poly([W/2-ROAD_TOP,HORIZON,W/2+ROAD_TOP,HORIZON,W/2+ROAD_BOTTOM,BOTTOM,W/2-ROAD_BOTTOM,BOTTOM],0x36435d);
    // Roadside buildings grow as they approach, with looping depth coordinates.
    const scroll = this.distance * 0.022;
    for (let i = 0; i < 12; i++) {
      const t = ((i / 12 + scroll) % 1 + 1) % 1;
      if (t < 0.06) continue;
      const y = this.roadY(t);
      const half = this.roadHalf(t);
      const bw = 18 + t * 105;
      const bh = 35 + t * 210;
      for (const side of [-1, 1]) {
        const x = W / 2 + side * (half + 38 + t * 42);
        g.fillStyle((i + side + 12) % 3 === 0 ? 0xffc58e : 0x84a9d4);
        g.fillRect(side < 0 ? x - bw : x, y - bh, bw, bh);
        g.fillStyle(0xfff3c6, 0.85);
        const wx = side < 0 ? x - bw + bw * 0.23 : x + bw * 0.23;
        g.fillRect(wx, y - bh * 0.78, Math.max(3, bw * 0.17), Math.max(5, bh * 0.15));
        g.fillRect(wx, y - bh * 0.44, Math.max(3, bw * 0.17), Math.max(5, bh * 0.15));
      }
    }
    // Lane markers: world-space depth scrolling, perspective-sized.
    for (let i = 0; i < 23; i++) {
      const t = ((i / 23 + this.distance * 0.055) % 1 + 1) % 1;
      if (t < 0.09) continue;
      const t2 = Math.min(1, t + 0.028);
      for (const divider of [-1, 1]) {
        const x1 = W / 2 + divider * this.roadHalf(t) / 3;
        const x2 = W / 2 + divider * this.roadHalf(t2) / 3;
        const width = 1 + t * 5;
        this.poly([x1-width,this.roadY(t),x1+width,this.roadY(t),x2+width,this.roadY(t2),x2-width,this.roadY(t2)],0xf4e8ce,0.9);
      }
    }
    this.drawPlayer();
  }

  private drawPlayer(): void {
    const g = this.art;
    const x = this.roadX(this.visualLane, 0.91);
    const ground = 538;
    const jumping = this.jumpTime > 0;
    const jumpPhase = jumping ? 1 - this.jumpTime / 0.78 : 0;
    const lift = jumping ? Math.sin(jumpPhase * Math.PI) * 112 : 0;
    const sliding = this.slideTime > 0;
    const bounce = !jumping && !sliding ? Math.sin(this.runClock * 2) * 3 : 0;
    const y = ground - lift + bounce;
    g.fillStyle(0x142338, 0.28 - lift / 800);
    g.fillEllipse(x, ground + 7, 66 - lift * 0.1, 18 - lift * 0.03);
    // Back-facing runner, legs, arms and head.
    g.lineStyle(15, 0x26334d, 1);
    const stride = sliding || jumping ? 0 : Math.sin(this.runClock) * 15;
    g.lineBetween(x - 11, y - 33, x - 14 + stride, y);
    g.lineBetween(x + 11, y - 33, x + 14 - stride, y);
    g.lineStyle(11, 0xffc68d, 1);
    g.lineBetween(x - 24, y - (sliding ? 40 : 86), x - 30 - stride * 0.4, y - 48);
    g.lineBetween(x + 24, y - (sliding ? 40 : 86), x + 30 + stride * 0.4, y - 48);
    g.fillStyle(0xff765b);
    g.fillRoundedRect(x - 28, y - (sliding ? 67 : 110), 56, sliding ? 34 : 76, 15);
    g.fillStyle(0x334c78);
    g.fillRoundedRect(x - 19, y - (sliding ? 62 : 99), 38, sliding ? 24 : 44, 10);
    g.fillStyle(0xffc68d);
    g.fillCircle(x, y - (sliding ? 79 : 127), 23);
    g.fillStyle(0x253959);
    g.fillRoundedRect(x - 24, y - (sliding ? 101 : 151), 48, 19, 8);
    g.fillRect(x - 25, y - (sliding ? 92 : 143), 50, 7);
  }
}
