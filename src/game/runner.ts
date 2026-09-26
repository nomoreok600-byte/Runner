// Procedural humanoid runner with a bone-like hierarchy and blended animation states.
import * as THREE from 'three';
import { CharacterDef, Slot, charById, itemById } from './data';

export type Anim = 'idle' | 'run' | 'jump' | 'double' | 'fall' | 'slide' | 'roll' | 'wallL' | 'wallR' | 'zip' | 'swing' | 'ledge' | 'dash' | 'vault' | 'victory' | 'dead' | 'spring';

export interface Look { equip: Record<Slot, string>; colors: Partial<Record<Slot, string>>; }

const JOINTS = ['hipsY', 'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY', 'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'elR', 'thLx', 'thLz', 'knL', 'thRx', 'thRz', 'knR', 'rootZ'] as const;
type J = Record<(typeof JOINTS)[number], number>;
const zeroJ = (): J => Object.fromEntries(JOINTS.map((k) => [k, 0])) as J;

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, opts: { emissive?: string; ei?: number; rough?: number; metal?: number } = {}) {
  const key = `${color}|${opts.emissive || ''}|${opts.ei || 0}|${opts.rough ?? 0.6}|${opts.metal ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0, flatShading: true });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei ?? 1; }
    matCache.set(key, m);
  }
  return m;
}
function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 3, 8);
const sph = (r: number, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);

export class Runner {
  root = new THREE.Group();
  pivot = new THREE.Group();
  hips = new THREE.Group();
  torso = new THREE.Group();
  head = new THREE.Group();
  shL = new THREE.Group(); elL = new THREE.Group();
  shR = new THREE.Group(); elR = new THREE.Group();
  thL = new THREE.Group(); knL = new THREE.Group();
  thR = new THREE.Group(); knR = new THREE.Group();
  scarf: THREE.Group[] = [];
  tail: THREE.Group[] = [];
  j: J = zeroJ();
  spin = 0; // flip rotation (x)
  spinY = 0;
  emote = 'fist';
  private t = 0;
  private hipBase = 0.98;

  constructor(look: Look) {
    this.root.add(this.pivot);
    this.pivot.position.y = 0.9;
    this.pivot.add(this.hips);
    this.hips.position.y = this.hipBase - 0.9;
    this.build(look);
  }

  dispose() { this.root.removeFromParent(); }

  build(look: Look) {
    const c: CharacterDef = charById(look.equip.character);
    this.emote = itemById(look.equip.emote)?.style || 'fist';
    [this.hips, this.torso, this.head, this.shL, this.elL, this.shR, this.elR, this.thL, this.knL, this.thR, this.knR].forEach((g) => g.clear());
    this.scarf = []; this.tail = [];
    const pick = (slot: Slot, base: string, baseColor: string) => {
      const it = itemById(look.equip[slot]);
      const style = it && it.style !== 'default' ? it.style : base;
      const color = look.colors[slot] || (it && it.style !== 'default' ? it.color : baseColor);
      return { style, color };
    };
    const top = pick('top', c.top, c.topColor);
    const pants = pick('pants', c.pants, c.pantsColor);
    const shoes = pick('shoes', c.shoes, c.shoesColor);
    const hat = pick('hat', 'none', '#fff');
    const mask = pick('mask', 'none', '#fff');
    const bp = pick('backpack', 'none', '#fff');
    const b = c.build;
    this.root.scale.setScalar(c.height);

    const skin = mat(c.skin, { rough: 0.8 });
    const topM = top.style === 'tech' ? mat(top.color, { rough: 0.35, metal: 0.4 }) : mat(top.color);
    const accentM = mat(c.color, { emissive: c.color, ei: 1.6 });
    const pantsM = mat(pants.color);
    const shoeM = mat(shoes.color, shoes.style === 'glow' ? { emissive: shoes.color, ei: 0.8 } : { rough: 0.4 });
    const soleM = shoes.style === 'glow' ? accentM : mat('#f4f4f4');

    // hips / pelvis
    this.hips.add(mesh(box(0.34 * b, 0.18, 0.2), pantsM, 0, 0.02, 0));
    this.hips.add(mesh(box(0.36 * b, 0.05, 0.22), mat('#15151c'), 0, 0.11, 0));
    this.hips.add(this.torso);
    this.torso.position.y = 0.1;
    // torso
    const tw = 0.4 * b;
    const chest = mesh(box(tw, 0.44, 0.23), topM, 0, 0.25, 0);
    this.torso.add(chest);
    this.torso.add(mesh(box(tw * 0.85, 0.12, 0.2), topM, 0, 0.02, 0));
    if (top.style === 'hoodie') {
      this.torso.add(mesh(box(tw * 0.9, 0.12, 0.06), mat(top.color), 0, 0.14, 0.13));
      this.torso.add(mesh(box(0.28, 0.14, 0.12), mat(top.color), 0, 0.5, -0.13)); // hood
    }
    if (top.style === 'jacket') {
      this.torso.add(mesh(box(0.04, 0.42, 0.02), mat('#dddddd', { metal: 0.8, rough: 0.3 }), 0, 0.25, 0.121));
      this.torso.add(mesh(box(tw + 0.02, 0.08, 0.25), mat('#222'), 0, 0.46, 0));
    }
    if (top.style === 'tech') {
      this.torso.add(mesh(box(tw + 0.01, 0.03, 0.24), accentM, 0, 0.32, 0));
      this.torso.add(mesh(box(0.03, 0.3, 0.235), accentM, 0.1, 0.22, 0));
    }
    if (top.style === 'tank') {
      this.torso.add(mesh(box(tw * 0.5, 0.16, 0.232), skin, 0, 0.42, 0));
    }
    // neck + head
    this.torso.add(mesh(cap(0.06, 0.05), skin, 0, 0.5, 0));
    this.torso.add(this.head);
    this.head.position.y = 0.58;
    this.head.add(mesh(sph(0.15, 12, 10), skin, 0, 0.12, 0));
    this.head.add(mesh(box(0.2, 0.1, 0.1), skin, 0, 0.05, 0.05)); // jaw
    const eyeM = mat('#10121c', { rough: 0.2 });
    this.head.add(mesh(sph(0.022, 6, 5), eyeM, -0.055, 0.14, 0.135));
    this.head.add(mesh(sph(0.022, 6, 5), eyeM, 0.055, 0.14, 0.135));
    this.head.add(mesh(box(0.05, 0.012, 0.02), mat('#5a2e2e'), 0, 0.06, 0.14));
    this.head.add(mesh(sph(0.03, 6, 5), skin, -0.15, 0.12, 0));
    this.head.add(mesh(sph(0.03, 6, 5), skin, 0.15, 0.12, 0));
    // hair
    const hairM = mat(c.hair, { rough: 0.9 });
    const hs = c.hairStyle;
    if (hs !== 'bald' && hat.style !== 'helmet') {
      const capH = mesh(new THREE.SphereGeometry(0.158, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairM, 0, 0.13, -0.01);
      this.head.add(capH);
      if (hs === 'spiky') for (let i = 0; i < 6; i++) {
        const s = mesh(new THREE.ConeGeometry(0.05, 0.14, 5), hairM, -0.1 + i * 0.04, 0.27, -0.03 - (i % 2) * 0.04);
        s.rotation.x = -0.5; s.rotation.z = (i - 2.5) * 0.15; this.head.add(s);
      }
      if (hs === 'mohawk') for (let i = 0; i < 5; i++) {
        const s = mesh(box(0.04, 0.12, 0.06), mat(c.hair, { emissive: c.hair, ei: 0.3 }), 0, 0.3, 0.08 - i * 0.06); this.head.add(s);
      }
      if (hs === 'bun') this.head.add(mesh(sph(0.07, 8, 6), hairM, 0, 0.3, -0.08));
      if (hs === 'long' || hs === 'ponytail') {
        this.head.add(mesh(box(0.3, 0.22, 0.06), hairM, 0, 0.06, -0.13));
        let parent: THREE.Object3D = this.head;
        for (let i = 0; i < 3; i++) {
          const g = new THREE.Group();
          g.position.set(0, i === 0 ? 0.2 : -0.1, i === 0 ? -0.15 : 0);
          g.add(mesh(cap(0.045 - i * 0.008, 0.06), hairM, 0, -0.05, 0));
          parent.add(g); parent = g; this.tail.push(g);
        }
      }
    }
    // hats
    const hatM = mat(hat.color, { rough: 0.5 });
    if (hat.style === 'cap') { this.head.add(mesh(new THREE.SphereGeometry(0.162, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatM, 0, 0.14, 0)); this.head.add(mesh(box(0.2, 0.02, 0.14), hatM, 0, 0.15, 0.17)); }
    if (hat.style === 'beanie') { this.head.add(mesh(new THREE.SphereGeometry(0.168, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.9), hatM, 0, 0.13, 0)); this.head.add(mesh(sph(0.04), mat('#ffffff'), 0, 0.31, 0)); }
    if (hat.style === 'headphones') { this.head.add(mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 16, Math.PI), hatM, 0, 0.13, 0)); [-1, 1].forEach((s) => this.head.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), mat(hat.color, { emissive: hat.color, ei: 1 }), 0.165 * s, 0.12, 0).rotateZ(Math.PI / 2))); }
    if (hat.style === 'visor') this.head.add(mesh(box(0.34, 0.06, 0.22), mat(hat.color, { emissive: hat.color, ei: 1.4 }), 0, 0.2, 0.06));
    if (hat.style === 'helmet') { this.head.add(mesh(sph(0.19, 12, 10), hatM, 0, 0.14, -0.01)); this.head.add(mesh(box(0.28, 0.08, 0.05), mat('#111', { rough: 0.1, metal: 0.8 }), 0, 0.14, 0.17)); this.head.add(mesh(box(0.03, 0.2, 0.36), mat('#ffffff'), 0, 0.28, 0)); }
    if (hat.style === 'horns') [-1, 1].forEach((s) => { const h = mesh(new THREE.ConeGeometry(0.035, 0.16, 6), mat(hat.color, { emissive: hat.color, ei: 0.5 }), 0.1 * s, 0.3, 0); h.rotation.z = -0.5 * s; this.head.add(h); });
    if (hat.style === 'crown') { const cr = mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.08, 8, 1, true), mat('#ffb800', { metal: 0.9, rough: 0.2, emissive: '#ffb800', ei: 0.3 }), 0, 0.3, 0); (cr.material as THREE.Material).side = THREE.DoubleSide; this.head.add(cr); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; this.head.add(mesh(new THREE.ConeGeometry(0.025, 0.07, 4), mat('#ffb800', { metal: 0.9, rough: 0.2 }), Math.cos(a) * 0.12, 0.37, Math.sin(a) * 0.12)); } }
    // masks
    if (mask.style === 'bandana') this.head.add(mesh(box(0.3, 0.1, 0.18), mat(mask.color), 0, 0.05, 0.06));
    if (mask.style === 'shades') this.head.add(mesh(box(0.28, 0.05, 0.03), mat(mask.color, { rough: 0.1, metal: 0.6 }), 0, 0.14, 0.145));
    if (mask.style === 'cyber') { this.head.add(mesh(box(0.3, 0.06, 0.04), mat(mask.color, { emissive: mask.color, ei: 2 }), 0, 0.14, 0.145)); this.head.add(mesh(box(0.2, 0.08, 0.12), mat('#1a1a26'), 0, 0.04, 0.1)); }
    if (mask.style === 'oni' || mask.style === 'skull') {
      this.head.add(mesh(box(0.28, 0.28, 0.06), mat(mask.color, { rough: 0.4 }), 0, 0.1, 0.15));
      const glow = mat(mask.style === 'oni' ? '#ffe600' : '#00f0ff', { emissive: mask.style === 'oni' ? '#ffe600' : '#00f0ff', ei: 2.5 });
      this.head.add(mesh(box(0.06, 0.03, 0.02), glow, -0.06, 0.15, 0.185));
      this.head.add(mesh(box(0.06, 0.03, 0.02), glow, 0.06, 0.15, 0.185));
    }
    // backpacks
    const bpM = mat(bp.color, { rough: 0.5 });
    if (bp.style === 'pack') { this.torso.add(mesh(box(0.3, 0.34, 0.14), bpM, 0, 0.24, -0.18)); this.torso.add(mesh(box(0.26, 0.1, 0.05), mat('#111'), 0, 0.14, -0.26)); }
    if (bp.style === 'tank') [-1, 1].forEach((s) => this.torso.add(mesh(cap(0.07, 0.24), mat(bp.color, { metal: 0.8, rough: 0.25 }), 0.08 * s, 0.26, -0.18)));
    if (bp.style === 'katana') [-1, 1].forEach((s) => { const k = mesh(box(0.03, 0.8, 0.02), mat('#dfe6ff', { metal: 1, rough: 0.15, emissive: bp.color, ei: 0.3 }), 0.05 * s, 0.3, -0.16); k.rotation.z = 0.6 * s; this.torso.add(k); });
    if (bp.style === 'jet') { [-1, 1].forEach((s) => { this.torso.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 10), mat(bp.color, { metal: 0.7, rough: 0.3 }), 0.1 * s, 0.24, -0.2)); this.torso.add(mesh(new THREE.ConeGeometry(0.06, 0.14, 8), mat('#ff8a00', { emissive: '#ff6a00', ei: 3 }), 0.1 * s, 0.0, -0.2).rotateX(Math.PI)); }); }
    if (bp.style === 'wings') [-1, 1].forEach((s) => { const w = mesh(box(0.55, 0.3, 0.02), mat(bp.color, { emissive: bp.color, ei: 1.2 }), 0.3 * s, 0.35, -0.2); w.rotation.z = 0.35 * s; w.rotation.y = 0.4 * s; this.torso.add(w); });
    // scarf chain
    const scarfM = mat(c.scarf, { emissive: c.scarf, ei: 0.25 });
    this.torso.add(mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), scarfM, 0, 0.48, 0).rotateX(Math.PI / 2));
    let parent: THREE.Object3D = this.torso;
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.position.set(i === 0 ? 0.05 : 0, i === 0 ? 0.47 : -0.13, i === 0 ? -0.1 : 0);
      g.add(mesh(box(0.09 - i * 0.008, 0.14, 0.02), scarfM, 0, -0.065, 0));
      parent.add(g); parent = g; this.scarf.push(g);
    }
    // arms
    const armM = top.style === 'tank' ? skin : topM;
    const buildArm = (sh: THREE.Group, el: THREE.Group, side: number) => {
      sh.position.set(side * (tw / 2 + 0.05), 0.42, 0);
      this.torso.add(sh);
      sh.add(mesh(sph(0.07, 8, 6), topM, 0, 0, 0));
      sh.add(mesh(cap(0.055 * b, 0.18), armM, 0, -0.14, 0));
      el.position.y = -0.29;
      sh.add(el);
      el.add(mesh(cap(0.048 * b, 0.17), top.style === 'jacket' || top.style === 'hoodie' ? topM : skin, 0, -0.12, 0));
      el.add(mesh(box(0.08, 0.09, 0.05), skin, 0, -0.27, 0.01));
      if (top.style === 'tech') el.add(mesh(box(0.1, 0.03, 0.1), accentM, 0, -0.2, 0));
    };
    buildArm(this.shL, this.elL, -1);
    buildArm(this.shR, this.elR, 1);
    // legs
    const buildLeg = (th: THREE.Group, kn: THREE.Group, side: number) => {
      th.position.set(side * 0.1 * b, -0.02, 0);
      this.hips.add(th);
      th.add(mesh(cap(0.075 * b, 0.26), pantsM, 0, -0.2, 0));
      kn.position.y = -0.42;
      th.add(kn);
      if (pants.style === 'shorts') kn.add(mesh(cap(0.058, 0.26), skin, 0, -0.18, 0));
      else kn.add(mesh(cap(0.065, 0.26), pantsM, 0, -0.18, 0));
      if (pants.style === 'cargo') th.add(mesh(box(0.06, 0.1, 0.12), pantsM, side * 0.08, -0.22, 0));
      if (pants.style === 'tech') kn.add(mesh(box(0.14, 0.03, 0.14), accentM, 0, -0.08, 0));
      const hi = shoes.style === 'high' || shoes.style === 'boot';
      kn.add(mesh(box(0.13, hi ? 0.16 : 0.09, 0.24), shoeM, 0, hi ? -0.38 : -0.41, 0.04));
      kn.add(mesh(box(0.14, 0.035, 0.26), soleM, 0, -0.46, 0.045));
    };
    buildLeg(this.thL, this.knL, -1);
    buildLeg(this.thR, this.knR, 1);
  }

  /** Update animation. phase advances with run speed. */
  animate(anim: Anim, dt: number, speed = 1, extra = 0) {
    this.t += dt;
    const t = this.t;
    const T = zeroJ();
    T.hipsY = this.hipBase;
    T.shLz = -0.12; T.shRz = 0.12;
    let spinTarget = 0;
    const run = (freq: number, amp: number) => {
      const p = t * freq;
      const s = Math.sin(p);
      T.thLx = -s * amp; T.thRx = s * amp;
      T.knL = 0.35 + 1.1 * Math.max(0, Math.sin(p - 1.3)) * amp;
      T.knR = 0.35 + 1.1 * Math.max(0, Math.sin(p + Math.PI - 1.3)) * amp;
      T.shLx = s * amp * 0.9; T.shRx = -s * amp * 0.9;
      T.elL = -1.3; T.elR = -1.3;
      T.hipsY = this.hipBase - 0.04 + Math.abs(Math.cos(p)) * 0.07;
      T.torsoX = 0.28; T.torsoY = s * 0.12; T.headX = -0.15;
    };
    switch (anim) {
      case 'idle': {
        const b = Math.sin(t * 2);
        T.hipsY = this.hipBase - 0.01 + b * 0.008;
        T.torsoX = 0.03 + b * 0.02; T.headX = -0.05; T.headY = Math.sin(t * 0.7) * 0.3;
        T.shLx = 0.05; T.shRx = 0.05; T.elL = -0.25; T.elR = -0.25; T.shLz = -0.18; T.shRz = 0.18;
        T.thLz = -0.05; T.thRz = 0.05; T.knL = 0.05; T.knR = 0.05;
        break;
      }
      case 'run': case 'dash': run(11 * Math.min(1.5, speed), 1); if (anim === 'dash') { T.torsoX = 0.7; T.shLx = 1.2; T.shRx = 1.2; T.elL = -0.3; T.elR = -0.3; } break;
      case 'jump': case 'spring':
        T.thLx = -1.4; T.knL = 1.6; T.thRx = 0.5; T.knR = 0.9; T.shLx = 0.9; T.shRx = -1.8; T.elL = -0.8; T.elR = -0.6; T.torsoX = 0.2; T.headX = -0.2;
        if (anim === 'spring') { T.shLx = -2.8; T.shRx = -2.8; T.elL = -0.2; T.elR = -0.2; T.thLx = 0.1; T.thRx = 0.2; T.knL = 0.3; T.knR = 0.4; }
        break;
      case 'double':
        T.thLx = -1.9; T.knL = 2.2; T.thRx = -1.9; T.knR = 2.2; T.shLx = -1.0; T.shRx = -1.0; T.elL = -1.5; T.elR = -1.5; T.torsoX = 0.6; T.hipsY = this.hipBase + 0.1;
        spinTarget = extra * Math.PI * 2;
        break;
      case 'fall':
        T.thLx = -0.6; T.knL = 0.9; T.thRx = 0.2; T.knR = 0.5; T.shLx = -1.2; T.shRx = -1.2; T.shLz = -1.1; T.shRz = 1.1; T.elL = -0.4; T.elR = -0.4; T.torsoX = 0.1;
        break;
      case 'slide':
        T.hipsY = 0.36; T.torsoX = -0.9; T.headX = 0.6; T.thLx = -1.45; T.knL = 0.1; T.thRx = -0.8; T.knR = 1.6; T.shLx = 0.6; T.shRx = -0.4; T.shLz = -0.7; T.shRz = 0.9; T.elL = -0.2; T.elR = -0.6;
        break;
      case 'roll':
        T.hipsY = 0.55; T.torsoX = 1.2; T.thLx = -2.2; T.knL = 2.4; T.thRx = -2.2; T.knR = 2.4; T.shLx = -1.3; T.shRx = -1.3; T.elL = -1.6; T.elR = -1.6; T.headX = 0.5;
        spinTarget = extra * Math.PI * 2;
        break;
      case 'wallL': case 'wallR': {
        run(12, 0.85);
        const side = anim === 'wallL' ? -1 : 1;
        T.rootZ = -0.5 * side; T.torsoZ = -0.1 * side;
        if (side > 0) { T.shLx = -1.6; T.shLz = -0.8; T.elL = -0.5; } else { T.shRx = -1.6; T.shRz = 0.8; T.elR = -0.5; }
        break;
      }
      case 'zip':
        T.shLx = -2.95; T.shRx = -2.95; T.shLz = -0.15; T.shRz = 0.15; T.elL = -0.1; T.elR = -0.1;
        T.thLx = -0.8 + Math.sin(t * 6) * 0.1; T.knL = 1.1; T.thRx = -0.6 - Math.sin(t * 6) * 0.1; T.knR = 0.9; T.torsoX = -0.05; T.hipsY = this.hipBase - 0.05;
        break;
      case 'swing':
        T.shLx = -3.0; T.shRx = -3.0; T.elL = 0; T.elR = 0; T.thLx = -0.4 + extra * 0.6; T.thRx = -0.4 + extra * 0.6; T.knL = 0.4; T.knR = 0.4; T.torsoX = -extra * 0.3;
        break;
      case 'ledge':
        T.shLx = -2.8 + extra * 2.2; T.shRx = -2.8 + extra * 2.2; T.elL = -0.6 * extra; T.elR = -0.6 * extra; T.thLx = -1.4 * extra; T.knL = 1.2 * extra + 0.3; T.thRx = -0.3; T.knR = 0.6; T.torsoX = 0.4 * extra; T.hipsY = this.hipBase - 0.1 * extra;
        break;
      case 'vault':
        T.torsoX = 0.4; T.torsoZ = 0.35; T.shLx = -0.3; T.shLz = -0.3; T.elL = 0; T.shRx = -1.4; T.shRz = 0.6; T.elR = -0.5;
        T.thLx = -1.5; T.thLz = 0.5; T.knL = 1.4; T.thRx = -1.3; T.thRz = 0.6; T.knR = 1.5; T.rootZ = -0.25;
        break;
      case 'victory': {
        const e = this.emote;
        const w = Math.sin(t * 8);
        T.thLz = -0.15; T.thRz = 0.15; T.knL = 0.05; T.knR = 0.05;
        if (e === 'fist') { T.shRx = -2.9 + w * 0.2; T.elR = -0.9 - w * 0.3; T.shLx = 0.2; T.elL = -1.2; T.headX = -0.3; }
        else if (e === 'wave') { T.shRx = -2.6; T.shRz = 0.6 + w * 0.4; T.elR = -0.3; T.headY = 0.2; }
        else if (e === 'dance') { T.hipsY = this.hipBase - 0.06 + Math.abs(w) * 0.06; T.torsoZ = w * 0.2; T.shLx = -1.5; T.shRx = -1.5; T.shLz = -0.8 - w * 0.4; T.shRz = 0.8 - w * 0.4; T.elL = -1.2; T.elR = -1.2; T.thLx = -Math.max(0, w) * 0.8; T.knL = Math.max(0, w) * 1.2; T.thRx = Math.min(0, w) * 0.8; T.knR = -Math.min(0, w) * 1.2; }
        else if (e === 'bow') { T.torsoX = 0.9 + Math.sin(t * 2) * 0.1; T.shRx = -1.2; T.elR = -1.8; T.shLx = 0.5; T.shLz = -0.5; T.headX = 0.3; }
        else if (e === 'flex') { T.shLz = -1.5; T.shRz = 1.5; T.elL = -2.2 + w * 0.2; T.elR = -2.2 - w * 0.2; T.shLx = -0.1; T.shRx = -0.1; T.torsoX = -0.1; T.hipsY = this.hipBase - 0.08; T.thLz = -0.35; T.thRz = 0.35; T.knL = 0.4; T.knR = 0.4; }
        else if (e === 'spin') { T.shLz = -1.4; T.shRz = 1.4; this.spinY += dt * 9; }
        break;
      }
      case 'dead':
        T.hipsY = 0.2; T.torsoX = -1.4; T.shLz = -1.3; T.shRz = 1.3; T.thLx = -1.2; T.thRx = -1.4; T.knL = 0.3; T.knR = 0.6; T.headX = -0.4;
        break;
    }
    const k = Math.min(1, dt * (anim === 'run' || anim === 'wallL' || anim === 'wallR' ? 22 : 13));
    for (const key of JOINTS) this.j[key] += (T[key] - this.j[key]) * k;
    if (anim === 'double' || anim === 'roll') this.spin = spinTarget;
    else this.spin += (0 - this.spin) * Math.min(1, dt * 20);
    if (anim !== 'victory' || this.emote !== 'spin') this.spinY += (0 - (this.spinY % (Math.PI * 2))) * Math.min(1, dt * 10);
    const j = this.j;
    this.hips.position.y = j.hipsY - 0.9;
    this.torso.rotation.set(j.torsoX, j.torsoY, j.torsoZ);
    this.head.rotation.set(j.headX, j.headY, 0);
    this.shL.rotation.set(j.shLx, 0, j.shLz); this.elL.rotation.x = j.elL;
    this.shR.rotation.set(j.shRx, 0, j.shRz); this.elR.rotation.x = j.elR;
    this.thL.rotation.set(j.thLx, 0, j.thLz); this.knL.rotation.x = j.knL;
    this.thR.rotation.set(j.thRx, 0, j.thRz); this.knR.rotation.x = j.knR;
    this.pivot.rotation.set(this.spin, this.spinY, j.rootZ);
    // secondary motion: scarf + hair streaming with speed
    const flow = anim === 'idle' || anim === 'victory' ? 0.25 : Math.min(1.35, 0.6 + speed * 0.5);
    this.scarf.forEach((g, i) => {
      g.rotation.x = (i === 0 ? flow * 1.1 : 0.25 * flow) + Math.sin(t * 13 - i * 0.9) * 0.18 * flow + (anim === 'fall' || anim === 'jump' ? -0.3 : 0);
      g.rotation.z = Math.sin(t * 7 - i) * 0.12;
    });
    this.tail.forEach((g, i) => {
      g.rotation.x = (i === 0 ? 0.3 + flow * 0.5 : 0.15) + Math.sin(t * 10 - i * 1.2) * 0.15 * flow;
      g.rotation.z = Math.sin(t * 5 - i) * 0.1;
    });
  }
}
