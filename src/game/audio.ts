// Web Audio synth: SFX + procedural background music.
type Sfx = 'jump' | 'double' | 'coin' | 'gem' | 'land' | 'hit' | 'power' | 'combo' | 'click' | 'win' | 'tick' | 'chest' | 'slide' | 'dash' | 'wall' | 'spring' | 'token' | 'fail' | 'star' | 'claim';

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  musicOn = true;
  sfxOn = true;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private mode: 'menu' | 'game' = 'menu';
  private noiseBuf: AudioBuffer | null = null;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx!.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx!.destination);
    this.musicGain = this.ctx!.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx!.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.6 : 0;
    this.sfxGain.connect(this.master);
    const len = this.ctx!.sampleRate * 0.5;
    this.noiseBuf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }
  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, t0 = 0, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + t0;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, t0 = 0, filter = 1200, dest?: AudioNode, at?: number) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = at ?? this.ctx.currentTime + t0;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain!);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name: Sfx) {
    this.ensure();
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'jump': this.tone(300, 0.18, 'square', 0.12, 0, 620); break;
      case 'double': this.tone(420, 0.2, 'square', 0.12, 0, 900); this.tone(840, 0.12, 'sine', 0.08, 0.05); break;
      case 'coin': this.tone(1320, 0.07, 'square', 0.07); this.tone(1760, 0.14, 'square', 0.07, 0.06); break;
      case 'gem': [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, i * 0.04)); break;
      case 'token': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.06)); break;
      case 'land': this.noise(0.12, 0.25, 0, 400); this.tone(120, 0.1, 'sine', 0.2, 0, 60); break;
      case 'hit': this.noise(0.35, 0.5, 0, 300); this.tone(180, 0.4, 'sawtooth', 0.2, 0, 40); break;
      case 'fail': [440, 370, 311, 262].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.14)); break;
      case 'power': this.tone(400, 0.35, 'sawtooth', 0.1, 0, 1600); this.tone(800, 0.3, 'sine', 0.08, 0.1, 2000); break;
      case 'combo': this.tone(660, 0.1, 'square', 0.08); this.tone(990, 0.16, 'square', 0.08, 0.07); break;
      case 'click': this.tone(700, 0.05, 'triangle', 0.1, 0, 900); break;
      case 'tick': this.tone(1500, 0.03, 'square', 0.06); break;
      case 'star': this.tone(880, 0.25, 'triangle', 0.14, 0, 1760); break;
      case 'claim': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.08, i * 0.05)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.09, i * 0.1)); break;
      case 'chest': this.noise(0.5, 0.3, 0, 2000); [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, 0.2 + i * 0.07)); break;
      case 'slide': this.noise(0.3, 0.18, 0, 2500); break;
      case 'dash': this.noise(0.25, 0.3, 0, 3000); this.tone(200, 0.25, 'sawtooth', 0.08, 0, 800); break;
      case 'wall': this.noise(0.08, 0.15, 0, 1500); this.tone(500, 0.08, 'triangle', 0.06); break;
      case 'spring': this.tone(200, 0.4, 'sine', 0.2, 0, 1200); break;
    }
  }

  startMusic(mode: 'menu' | 'game') {
    this.ensure();
    if (!this.ctx) return;
    this.mode = mode;
    if (this.timer != null) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }
  stopMusic() {
    if (this.timer != null) { clearInterval(this.timer); this.timer = null; }
  }
  private schedule() {
    if (!this.ctx || !this.musicGain) return;
    const bpm = this.mode === 'game' ? 128 : 100;
    const sixteenth = 60 / bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }
  private playStep(s: number, t: number, len: number) {
    const ctx = this.ctx!;
    const dest = this.musicGain!;
    const prog = [[45, 57, 60, 64], [41, 53, 57, 60], [48, 60, 64, 67], [43, 55, 59, 62]];
    const chord = prog[Math.floor(s / 16) % 4];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const env = (o: OscillatorNode, vol: number, dur: number, type: OscillatorType, freq: number, lp = 0) => {
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (lp) {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
        o.connect(f); f.connect(g);
      } else o.connect(g);
      g.connect(dest);
      o.start(t); o.stop(t + dur + 0.02);
    };
    const game = this.mode === 'game';
    // kick
    if (s % 4 === 0 && (game || s % 8 === 0)) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.22);
    }
    // snare / hats
    if (game && s % 8 === 4) this.noise(0.15, 0.35, 0, 1800, dest, t);
    if (s % 2 === 1 && game) this.noise(0.04, 0.12, 0, 8000, dest, t);
    if (!game && s % 4 === 2) this.noise(0.03, 0.08, 0, 8000, dest, t);
    // bass
    if (s % 2 === 0) env(ctx.createOscillator(), game ? 0.3 : 0.2, len * 1.8, 'sawtooth', mtof(chord[0] - 12 + (s % 8 === 6 ? 12 : 0)), 600);
    // arp
    const arpIdx = [0, 1, 2, 3, 2, 1, 3, 2][s % 8];
    if (game || s % 2 === 0) env(ctx.createOscillator(), game ? 0.07 : 0.05, len * 1.5, 'square', mtof(chord[arpIdx] + 12), 2600);
    // pad on bar start
    if (s % 16 === 0) chord.slice(1).forEach((n) => env(ctx.createOscillator(), 0.04, len * 15, 'triangle', mtof(n)));
  }
}

export const audio = new AudioEngine();

export function haptic(pattern: number | number[]) {
  try {
    const on = (window as any).__skyrushHaptics !== false;
    if (on && navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* noop */ }
}
