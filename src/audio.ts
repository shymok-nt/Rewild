/** Tiny synthesized arcade audio engine; no external audio or copyrighted samples.
 * Browsers require an explicit user gesture before starting audio. */
export class GameAudio {
  private context: AudioContext | null = null;
  private muted = false;
  private readonly storageKey = "rush-city-muted";

  constructor() {
    try { this.muted = localStorage.getItem(this.storageKey) === "1"; } catch { /* storage disabled */ }
  }

  get isMuted(): boolean { return this.muted; }
  setMuted(value: boolean): void {
    this.muted = value;
    try { localStorage.setItem(this.storageKey, value ? "1" : "0"); } catch { /* storage disabled */ }
  }

  unlock(): void {
    if (this.muted) return;
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
    } catch { /* no audio output available */ }
  }

  private tone(freq: number, duration: number, type: OscillatorType,
    gainValue: number, endFreq?: number, delay = 0): void {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const ctx = this.context;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const volume = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + duration);
    volume.gain.setValueAtTime(0.0001, at);
    volume.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), at + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(volume);
    volume.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + duration + 0.01);
  }

  coin(): void {
    this.tone(740, 0.12, "sine", 0.065, 1040);
    this.tone(1100, 0.15, "sine", 0.045, 1460, 0.06);
  }
  jump(): void { this.tone(260, 0.21, "triangle", 0.07, 550); }
  slide(): void { this.tone(340, 0.18, "triangle", 0.045, 190); }
  lane(): void { this.tone(280, 0.07, "sine", 0.025, 380); }
  crash(): void {
    this.tone(180, 0.4, "sawtooth", 0.075, 55);
    this.tone(95, 0.42, "triangle", 0.08, 35, 0.04);
  }
  start(): void {
    this.tone(420, 0.12, "triangle", 0.045, 520);
    this.tone(620, 0.18, "triangle", 0.055, 900, 0.1);
  }
}
