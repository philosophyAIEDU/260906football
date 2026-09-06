import { assetConfig } from "../data/assets";
import type { Settings } from "../game/types";
class AudioSystem {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  crowd: GainNode | null = null;
  settings: Settings | null = null;
  crowdSample: HTMLAudioElement | null = null;
  async start(settings: Settings) {
    this.settings = settings;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate * 3,
          buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate),
          data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.18;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 700;
        this.crowd = this.ctx.createGain();
        source.connect(filter).connect(this.crowd).connect(this.master);
        source.start();
      }
      await this.ctx.resume();
      if (assetConfig.audio.crowd && !this.crowdSample) {
        const sample = new Audio(assetConfig.audio.crowd);
        sample.loop = true;
        this.crowdSample = sample;
        void sample
          .play()
          .then(() => {
            if (this.crowd) this.crowd.gain.value = 0;
          })
          .catch(() => {
            this.crowdSample = null;
          });
      }
      this.update(settings);
    } catch {
      /* Audio is optional. */
    }
  }
  update(s: Settings) {
    this.settings = s;
    if (this.master) this.master.gain.value = s.muted ? 0 : s.volume;
    if (this.crowd)
      this.crowd.gain.value = this.crowdSample ? 0 : s.crowdVolume * 0.28;
    if (this.crowdSample)
      this.crowdSample.volume = s.muted ? 0 : s.volume * s.crowdVolume;
  }
  play(kind: "kick" | "shot" | "whistle" | "goal" | "post" | "tackle" | "ui") {
    const url = assetConfig.audio[kind];
    if (url && typeof Audio !== "undefined") {
      const sample = new Audio(url);
      sample.volume = this.settings?.muted
        ? 0
        : (this.settings?.volume ?? 0.65) *
          (this.settings?.effectsVolume ?? 0.8);
      void sample.play().catch(() => this.synth(kind));
      return;
    }
    this.synth(kind);
  }
  synth(kind: "kick" | "shot" | "whistle" | "goal" | "post" | "tackle" | "ui") {
    if (!this.ctx || !this.master) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = kind === "whistle" ? "sine" : "triangle";
    o.frequency.setValueAtTime(
      kind === "whistle"
        ? 2200
        : kind === "post"
          ? 650
          : kind === "goal"
            ? 440
            : 95,
      c.currentTime,
    );
    if (kind === "goal")
      o.frequency.linearRampToValueAtTime(880, c.currentTime + 0.5);
    else
      o.frequency.exponentialRampToValueAtTime(
        kind === "whistle" ? 1800 : 45,
        c.currentTime + 0.15,
      );
    const duration = kind === "goal" ? 0.8 : kind === "whistle" ? 0.35 : 0.12;
    g.gain.setValueAtTime(
      (this.settings?.effectsVolume ?? 0.6) * 0.2,
      c.currentTime,
    );
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
    if (kind === "goal" && this.crowd) {
      this.crowd.gain.setValueAtTime(
        this.settings?.crowdVolume ?? 0.5,
        c.currentTime,
      );
      this.crowd.gain.linearRampToValueAtTime(
        (this.settings?.crowdVolume ?? 0.5) * 0.28,
        c.currentTime + 3,
      );
    }
  }
}
export const audio = new AudioSystem();
