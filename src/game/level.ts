// Deterministic procedural course generation. Level N => same course every time.
import { mulberry32 } from './store';

export const LW = 2.2; // lane width
export const laneX = (lane: number) => -lane * LW; // lane +1 = screen right = world -x
export const FULL_W = 7.2;
export const G = 34;
export const JUMP_V = 11.5;

export type PlatKind = 'solid' | 'crumble' | 'moving' | 'conveyor';
export interface Plat { id: number; x: number; z0: number; z1: number; w: number; y: number; kind: PlatKind; mx?: number; my?: number; ms?: number; mp?: number; conv?: number; fallAt?: number; drop?: number; }
export interface WallS { id: number; side: -1 | 1; z0: number; z1: number; y0: number; y1: number; }
export type ObstType = 'wall' | 'bar' | 'laserLow' | 'laserHigh' | 'laserV' | 'drone';
export interface Obst { id: number; type: ObstType; x: number; z: number; w: number; y: number; mx?: number; ms?: number; mp?: number; dead?: boolean; }
export interface Swing { id: number; x: number; y: number; z: number; }
export interface Zip { id: number; x: number; z0: number; y0: number; z1: number; y1: number; }
export interface Spring { id: number; x: number; z: number; y: number; }
export type PickType = 'coin' | 'gem' | 'token' | 'magnet' | 'shield' | 'slowmo' | 'double' | 'superjump';
export interface Pick { id: number; type: PickType; x: number; y: number; z: number; token?: number; taken?: boolean; }
export interface Hint { z: number; text: string; }

export interface Course {
  plats: Plat[]; walls: WallS[]; obst: Obst[]; swings: Swing[]; zips: Zip[]; springs: Spring[]; picks: Pick[];
  checkpoints: number[]; finishZ: number; baseSpeed: number; diff: number; coinTotal: number; par: number; hints: Hint[];
  endless: boolean; level: number;
}

export const diffForLevel = (n: number) => (n <= 0 ? 0 : 1 - Math.exp(-(n - 1) / 22));
const diffForDist = (z: number) => 1 - Math.exp(-z / 2600);
export const speedForDiff = (d: number) => 11.5 + 9.5 * d;

type Chunk = 'flat' | 'gap' | 'stepUp' | 'stepDown' | 'wallrun' | 'zip' | 'swing' | 'spring' | 'moving' | 'crumble' | 'conveyor' | 'islands';
const FEATURE_LEVEL: Record<Chunk, number> = { flat: 1, gap: 1, stepUp: 1, stepDown: 1, spring: 1, zip: 1, wallrun: 2, swing: 3, moving: 4, crumble: 5, conveyor: 6, islands: 7 };

export class CourseBuilder {
  c: Course;
  z = 0;
  y = 0;
  private rng: () => number;
  private id = 1;
  private last: Chunk = 'flat';
  private tokenCandidates: { x: number; y: number; z: number }[] = [];
  private level: number;
  private endless: boolean;
  private targetLen: number;

  constructor(level: number, endless = false) {
    this.level = level;
    this.endless = endless;
    this.rng = mulberry32(endless ? (Date.now() & 0xffffff) : level * 7919 + 1337);
    const d = endless ? 0 : diffForLevel(level);
    this.targetLen = endless ? Infinity : Math.round(520 + Math.min(900, level * 14));
    this.c = {
      plats: [], walls: [], obst: [], swings: [], zips: [], springs: [], picks: [], checkpoints: [], finishZ: 0,
      baseSpeed: speedForDiff(d), diff: d, coinTotal: 0, par: 0, hints: [], endless, level,
    };
    // starting runway
    this.plat(0, -30, 30, FULL_W, 0, 'solid');
    this.z = 30;
    if (level === 0 && !endless) this.buildTutorial();
    else if (!endless) this.buildLevel();
    else this.extendTo(260);
  }

  private r(a = 0, b = 1) { return a + this.rng() * (b - a); }
  private ri(a: number, b: number) { return Math.floor(this.r(a, b + 1)); }
  private pick<T>(arr: T[]): T { return arr[Math.floor(this.rng() * arr.length)]; }
  diffAt(z: number) { return this.endless ? diffForDist(z) : this.c.diff; }
  speedAt(z: number) { return this.endless ? speedForDiff(this.diffAt(z)) + Math.min(3, z / 4000) : this.c.baseSpeed; }
  private allowed(ch: Chunk) {
    if (this.endless) return this.diffAt(this.z) * 25 + 2 >= FEATURE_LEVEL[ch];
    return this.level >= FEATURE_LEVEL[ch];
  }

  private plat(x: number, z0: number, z1: number, w: number, y: number, kind: PlatKind, extra: Partial<Plat> = {}) {
    const p: Plat = { id: this.id++, x, z0, z1, w, y, kind, ...extra };
    this.c.plats.push(p);
    return p;
  }
  private coin(x: number, y: number, z: number) { this.c.picks.push({ id: this.id++, type: 'coin', x, y, z }); if (!this.endless) this.c.coinTotal++; }
  private coinLine(lane: number, y: number, z0: number, z1: number) { for (let z = z0; z <= z1; z += 2.2) this.coin(laneX(lane), y + 1, z); }
  private coinArc(x: number, y0: number, z0: number, z1: number, y1 = y0, peak = 2.2) {
    const n = Math.max(3, Math.floor((z1 - z0) / 1.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.coin(x, y0 + (y1 - y0) * t + 1 + Math.sin(t * Math.PI) * peak, z0 + (z1 - z0) * t);
    }
  }
  private obstacle(type: ObstType, x: number, z: number, w: number, y: number, extra: Partial<Obst> = {}) {
    this.c.obst.push({ id: this.id++, type, x, z, w, y, ...extra });
  }
  private maybePower(x: number, y: number, z: number, chance = 0.12) {
    if (this.rng() > chance) return;
    const t = this.pick<PickType>(['magnet', 'shield', 'slowmo', 'double', 'superjump', 'magnet', 'double']);
    this.c.picks.push({ id: this.id++, type: t, x, y: y + 1.2, z });
  }
  private maybeGem(x: number, y: number, z: number, chance = 0.08) {
    if (this.rng() < chance) this.c.picks.push({ id: this.id++, type: 'gem', x, y: y + 1.3, z });
  }

  private chooseChunk(): Chunk {
    const d = this.diffAt(this.z);
    const w: [Chunk, number][] = [
      ['flat', 3.2 - d], ['gap', 2], ['stepUp', 1.1], ['stepDown', 1.1], ['spring', 0.8], ['zip', 0.7],
      ['wallrun', 1.2 + d], ['swing', 0.9 + d * 0.5], ['moving', 0.8 + d], ['crumble', 0.8 + d], ['conveyor', 0.6], ['islands', 0.7 + d],
    ];
    const options = w.filter(([c]) => this.allowed(c) && c !== this.last && !(c === 'stepUp' && this.y > 9) && !(c === 'stepDown' && this.y < 2 && this.last === 'stepDown'));
    const total = options.reduce((s, [, v]) => s + v, 0);
    let roll = this.rng() * total;
    for (const [c, v] of options) { roll -= v; if (roll <= 0) return c; }
    return 'flat';
  }

  private runChunk(ch: Chunk) {
    this.last = ch;
    const s = this.speedAt(this.z);
    const d = this.diffAt(this.z);
    const y = this.y;
    switch (ch) {
      case 'flat': this.flat(this.ri(40, 70) + d * 30); break;
      case 'gap': {
        const needDouble = d > 0.3 && this.rng() < d * 0.6;
        const g = s * (needDouble ? this.r(0.8, 0.92) : this.r(0.38, 0.5) + d * 0.08);
        const ny = Math.max(0, y + (this.rng() < 0.3 ? this.r(-1, 1.2) : 0));
        this.coinArc(laneX(this.ri(-1, 1)), y, this.z - 2, this.z + g + 2, ny, needDouble ? 3.4 : 2.2);
        this.z += g; this.y = ny;
        this.flat(this.ri(18, 30));
        break;
      }
      case 'stepUp': {
        this.z += this.rng() < 0.5 ? 0 : this.r(2, 3.5);
        this.y = y + this.r(1.2, 1.75);
        this.tokenCandidates.push({ x: laneX(this.pick([-1, 1])), y: this.y + 1, z: this.z + 1 });
        this.flat(this.ri(24, 36));
        break;
      }
      case 'stepDown': {
        const g = s * 0.35;
        this.coinArc(laneX(0), y, this.z, this.z + g + 4, y - 3, 1.5);
        this.z += g; this.y = Math.max(0, y - this.r(2.8, 4.5));
        this.flat(this.ri(24, 34));
        break;
      }
      case 'spring': {
        this.flat(14, false);
        for (const l of [-1, 0, 1]) this.c.springs.push({ id: this.id++, x: laneX(l), z: this.z - 3, y });
        const g = s * this.r(0.62, 0.74);
        const ny = y + this.r(1.5, 3.2);
        this.coinArc(laneX(0), y, this.z - 2, this.z + g, ny, 4.2);
        this.tokenCandidates.push({ x: laneX(this.pick([-1, 1])), y: y + 5.5, z: this.z + g * 0.5 });
        this.z += g; this.y = ny;
        this.flat(this.ri(20, 30));
        break;
      }
      case 'zip': {
        this.flat(14, false);
        const len = this.r(34, 56);
        const drop = Math.min(y + 0, this.r(3, 7));
        const ny = Math.max(0, y - drop) + (y - drop < 0 ? 0 : 0);
        const lane = this.ri(-1, 1);
        this.c.zips.push({ id: this.id++, x: laneX(lane), z0: this.z - 2, y0: y + 2.9, z1: this.z + len + 3, y1: ny + 2.9 });
        for (let i = 1; i < 10; i++) { const t = i / 10; this.coin(laneX(lane), y + 1.4 + (ny - y) * t, this.z - 2 + (len + 5) * t); }
        this.tokenCandidates.push({ x: laneX(lane), y: (y + ny) / 2 + 3.6, z: this.z + len * 0.55 });
        this.z += len; this.y = ny;
        this.flat(this.ri(22, 30));
        break;
      }
      case 'swing': {
        this.flat(12, false);
        const bars = d > 0.45 && this.rng() < 0.5 ? 2 : 1;
        let z = this.z;
        for (let b = 0; b < bars; b++) {
          const bz = z + s * 0.42;
          this.c.swings.push({ id: this.id++, x: 0, y: y + 3.3, z: bz });
          for (let i = -2; i <= 2; i++) this.coin(0, y + 2.6 + Math.cos(i * 0.5) * 0.6, bz + i * 1.3);
          if (b === 0) this.tokenCandidates.push({ x: 0, y: y + 5.2, z: bz });
          z = bz + s * 0.95;
        }
        this.z = z; this.flat(this.ri(20, 30));
        break;
      }
      case 'wallrun': {
        this.flat(10, false);
        const double = d > 0.35 && this.rng() < 0.55;
        const len = s * (double ? this.r(2.0, 2.4) : this.r(1.45, 1.75));
        const side: -1 | 1 = this.rng() < 0.5 ? -1 : 1;
        if (double) {
          const mid = this.z + len * 0.5;
          this.c.walls.push({ id: this.id++, side, z0: this.z + 1, z1: mid + 1, y0: y - 2, y1: y + 4.5 });
          this.c.walls.push({ id: this.id++, side: (-side) as -1 | 1, z0: mid + 1.5, z1: this.z + len - 1, y0: y - 1.5, y1: y + 5 });
          this.coinLine(side, y + 1.2, this.z + 3, mid - 1);
          this.coinLine(-side, y + 1.5, mid + 4, this.z + len - 3);
        } else {
          this.c.walls.push({ id: this.id++, side, z0: this.z + 1, z1: this.z + len - 1, y0: y - 2, y1: y + 4.5 });
          this.coinLine(side, y + 1.2, this.z + 3, this.z + len - 3);
        }
        this.tokenCandidates.push({ x: laneX(side), y: y + 3.4, z: this.z + len * 0.4 });
        this.z += len;
        this.flat(this.ri(22, 30));
        break;
      }
      case 'moving': {
        this.flat(8, false);
        const n = this.ri(3, 4 + Math.floor(d * 2));
        const vertical = this.rng() < 0.5 || d < 0.35;
        for (let i = 0; i < n; i++) {
          const gap = s * this.r(0.3, 0.38);
          this.z += gap;
          const len = this.r(6, 8);
          if (vertical) this.plat(0, this.z, this.z + len, FULL_W, y, 'moving', { my: this.r(0.8, 1.4), ms: this.r(1.4, 2.2), mp: this.r(0, 6.28) });
          else this.plat(0, this.z, this.z + len, 4.6, y, 'moving', { mx: 1.5, ms: this.r(1.1, 1.7) + d * 0.5, mp: this.r(0, 6.28) });
          this.coinLine(0, y + 0.3, this.z + 1, this.z + len - 1);
          this.z += len;
        }
        this.z += s * 0.35;
        this.flat(this.ri(18, 28));
        break;
      }
      case 'crumble': {
        this.flat(8, false);
        const n = this.ri(5, 8 + Math.floor(d * 5));
        this.z += 0.6;
        for (let i = 0; i < n; i++) {
          const narrow = d > 0.4 && this.rng() < 0.4;
          if (narrow) {
            const lane = this.ri(-1, 1);
            this.plat(laneX(lane), this.z, this.z + 3.2, 2.1, y, 'crumble');
            if (lane !== 0) this.plat(0, this.z, this.z + 3.2, 2.1, y, 'crumble');
            else this.plat(laneX(this.pick([-1, 1])), this.z, this.z + 3.2, 2.1, y, 'crumble');
          } else this.plat(0, this.z, this.z + 3.2, FULL_W, y, 'crumble');
          if (i % 2 === 0) this.coin(0, y + 1, this.z + 1.6);
          this.z += 3.5;
        }
        this.z += 0.4;
        this.flat(this.ri(20, 28));
        break;
      }
      case 'conveyor': {
        const len = this.ri(30, 45);
        const conv = this.rng() < 0.6 ? this.r(4, 7) : -this.r(3, 5);
        this.plat(0, this.z, this.z + len, FULL_W, y, 'conveyor', { conv });
        this.rows(this.z + 8, this.z + len - 4, s, d);
        this.z += len;
        this.flat(this.ri(10, 20));
        break;
      }
      case 'islands': {
        this.flat(8, false);
        let lane = this.ri(-1, 1);
        const n = this.ri(4, 6);
        for (let i = 0; i < n; i++) {
          this.z += s * this.r(0.28, 0.36);
          const len = this.r(7, 11);
          this.plat(laneX(lane), this.z, this.z + len, 2.1, y, 'solid');
          this.coinLine(lane, y, this.z + 1, this.z + len - 1);
          if (i === n - 2) this.tokenCandidates.push({ x: laneX(lane === 0 ? 1 : 0), y: y + 2.4, z: this.z + len / 2 });
          const next = Math.max(-1, Math.min(1, lane + this.pick([-1, 1, 0])));
          if (next !== lane) this.plat(laneX(next), this.z + len - 3, this.z + len, 2.1, y, 'solid');
          lane = next;
          this.z += len;
        }
        this.z += s * 0.3;
        this.flat(this.ri(18, 26));
        break;
      }
    }
  }

  /** Solid full-width run with obstacle rows. */
  private flat(len: number, withRows = true) {
    const s = this.speedAt(this.z);
    const d = this.diffAt(this.z);
    this.plat(0, this.z, this.z + len, FULL_W, this.y, 'solid');
    if (withRows && len > 16) this.rows(this.z + 8, this.z + len - 5, s, d);
    else this.coinLine(this.ri(-1, 1), this.y, this.z + 2, this.z + len - 2);
    this.z += len;
  }

  private rows(z0: number, z1: number, s: number, d: number) {
    const y = this.y;
    const spacing = Math.max(s * 0.8, 17 - d * 7);
    let z = z0;
    let coinLane = this.ri(-1, 1);
    const lvl = this.endless ? 3 + d * 25 : this.level;
    while (z < z1) {
      const types: ObstType[] = ['wall', 'bar', 'wall'];
      if (lvl >= 3) types.push('laserLow', 'laserHigh');
      if (lvl >= 8) types.push('drone', 'drone');
      if (lvl >= 10) types.push('laserV');
      const t = this.pick(types);
      const lanes = [-1, 0, 1];
      if (t === 'wall' || t === 'bar') {
        const count = this.rng() < 0.3 + d * 0.5 ? 3 : this.ri(1, 2);
        const shuffled = lanes.sort(() => this.rng() - 0.5).slice(0, count);
        shuffled.forEach((l) => this.obstacle(t, laneX(l), z, 2.0, y));
        if (t === 'wall') this.coinArc(laneX(shuffled[0]), y, z - 3, z + 3, y, 1.4);
      } else if (t === 'laserLow' || t === 'laserHigh') {
        this.obstacle(t, 0, z, FULL_W, y);
      } else if (t === 'laserV') {
        const free = this.ri(-1, 1);
        lanes.filter((l) => l !== free).slice(0, d > 0.6 ? 2 : 1 + (this.rng() < 0.5 ? 1 : 0)).forEach((l) => this.obstacle('laserV', laneX(l), z, 1.6, y));
        this.coinLine(free, y, z - 4, z + 2);
      } else if (t === 'drone') {
        const l = this.ri(-1, 1);
        this.obstacle('drone', laneX(l), z, 1.0, y, d > 0.45 ? { mx: 2.2, ms: this.r(1.2, 2), mp: this.r(0, 6) } : {});
      }
      // coins between rows
      if (this.rng() < 0.7) {
        coinLane = Math.max(-1, Math.min(1, coinLane + this.pick([-1, 0, 1])));
        this.coinLine(coinLane, y, z + 3, Math.min(z1, z + spacing - 4));
      }
      this.maybePower(laneX(this.ri(-1, 1)), y, z + spacing / 2);
      this.maybeGem(laneX(this.ri(-1, 1)), y, z + spacing / 2 + 2);
      if (this.rng() < 0.15) this.tokenCandidates.push({ x: laneX(this.pick([-1, 1])), y: y + 2.6, z: z + 0.1 });
      z += spacing * this.r(0.9, 1.25);
    }
  }

  private buildLevel() {
    const cps = [this.targetLen / 3, (2 * this.targetLen) / 3];
    let cpIdx = 0;
    this.flat(20, false);
    while (this.z < this.targetLen) {
      if (cpIdx < 2 && this.z >= cps[cpIdx]) {
        this.c.checkpoints.push(this.z + 4);
        this.flat(24, false);
        cpIdx++;
        continue;
      }
      this.runChunk(this.chooseChunk());
    }
    this.flat(20, false);
    this.c.finishZ = this.z;
    this.plat(0, this.z, this.z + 40, FULL_W, this.y, 'solid');
    this.placeTokens();
    this.c.par = (this.c.finishZ / this.c.baseSpeed) * 1.18 + 4;
  }

  private placeTokens() {
    const cand = this.tokenCandidates.filter((t) => t.z > 40 && t.z < this.c.finishZ - 20);
    for (let i = 0; i < 3; i++) {
      const lo = (this.c.finishZ * i) / 3, hi = (this.c.finishZ * (i + 1)) / 3;
      const inRange = cand.filter((t) => t.z >= lo && t.z < hi);
      const t = inRange.length ? this.pick(inRange) : { x: laneX(this.pick([-1, 1])), y: this.y + 2.5, z: (lo + hi) / 2 };
      this.c.picks.push({ id: this.id++, type: 'token', token: i, x: t.x, y: t.y, z: t.z });
    }
  }

  extendTo(z: number) {
    while (this.z < z) this.runChunk(this.chooseChunk());
  }

  private buildTutorial() {
    const H = (text: string) => this.c.hints.push({ z: this.z - 12, text });
    this.c.baseSpeed = 10.5;
    const s = 10.5;
    this.flat(16, false);
    H('Swipe UP (or Space) to JUMP the gap');
    this.z += s * 0.45; this.flat(26, false);
    H('Swipe DOWN (or S) to SLIDE under the bar');
    this.flat(4, false); [-1, 0, 1].forEach((l) => this.obstacle('bar', laneX(l), this.z + 8, 2, 0)); this.flat(26, false);
    H('Swipe LEFT / RIGHT to change lanes');
    this.flat(4, false); [0, 1].forEach((l) => this.obstacle('laserV', laneX(l), this.z + 10, 1.6, 0)); this.coinLine(-1, 0, this.z + 2, this.z + 14); this.flat(28, false);
    H('TAP just before a low wall to VAULT it');
    this.flat(4, false); [-1, 0, 1].forEach((l) => this.obstacle('wall', laneX(l), this.z + 10, 2, 0)); this.flat(28, false);
    H('Jump, then jump again in the air: DOUBLE JUMP');
    this.z += s * 0.82; this.flat(26, false);
    H('Jump toward the wall and hold the side lane to WALL-RUN');
    this.flat(4, false); this.c.walls.push({ id: this.id++, side: -1, z0: this.z + 1, z1: this.z + s * 1.6 - 1, y0: -2, y1: 4.5 }); this.coinLine(-1, 1.2, this.z + 3, this.z + s * 1.6 - 3); this.z += s * 1.6; this.flat(26, false);
    H('Run into a tall ledge to GRAB and CLIMB it');
    this.y = 1.6; this.flat(28, false);
    H('Big drop ahead: swipe DOWN as you land to ROLL');
    this.z += 4; this.y = 0; this.flat(30, false);
    H('Ride the ZIP LINE across');
    this.c.zips.push({ id: this.id++, x: 0, z0: this.z - 2, y0: 2.9, z1: this.z + 38, y1: 2.9 }); this.z += 35; this.flat(26, false);
    H('Jump to grab the SWING BAR');
    this.flat(4, false); const bz = this.z + s * 0.42; this.c.swings.push({ id: this.id++, x: 0, y: 3.3, z: bz }); this.z = bz + s * 0.95; this.flat(26, false);
    H('DOUBLE TAP (or Shift) to DASH through the drone');
    this.flat(4, false); [-1, 0, 1].forEach((l) => this.obstacle('drone', laneX(l), this.z + 12, 1, 0)); this.flat(30, false);
    H('Hit the SPRING PAD for a super launch');
    this.flat(10, false); [-1, 0, 1].forEach((l) => this.c.springs.push({ id: this.id++, x: laneX(l), z: this.z - 3, y: 0 })); this.z += s * 0.7; this.y = 2; this.flat(26, false);
    H('Chain moves for COMBOS. Reach the finish!');
    this.flat(30, false);
    this.c.finishZ = this.z;
    this.plat(0, this.z, this.z + 40, FULL_W, this.y, 'solid');
    this.c.par = 999;
    this.c.checkpoints = [];
  }
}
