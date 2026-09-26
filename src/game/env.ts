// Realistic modern city environment: real facades (glass, concrete, brick), rooftop gear,
// day/night with lit windows, and 4 real-world-style locations. Same API as before.
import * as THREE from 'three';
import { World } from './data';

export type QualityLevel = 'low' | 'medium' | 'high';

export function detectQuality(): QualityLevel {
  try {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as any).deviceMemory || 4;
    const small = Math.min(window.screen.width, window.screen.height) < 500;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') as WebGLRenderingContext | null;
    let gpu = '';
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase();
    }
    const weakGpu = /mali-4|mali-t|adreno \(tm\) [2-5]\d\d|powervr|sgx|intel hd graphics [2-5]/.test(gpu);
    if (weakGpu || cores <= 4 || mem <= 2) return 'low';
    if (small || mem <= 4) return 'medium';
    return 'high';
  } catch { return 'medium'; }
}

/* ---------- shared textures used by engine.ts (kept) ---------- */
let windowTex: THREE.Texture | null = null;
export function getWindowTexture() {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) {
    if (Math.random() < 0.45) { const v = 150 + Math.random() * 105; g.fillStyle = `rgb(${v},${v * 0.92},${v * 0.75})`; g.fillRect(x, y, 4, 5); }
  }
  windowTex = new THREE.CanvasTexture(c);
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowTex.magFilter = THREE.NearestFilter;
  return windowTex;
}

let stripeTex: THREE.Texture | null = null;
export function getStripeTexture() {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a2a33'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#ffb800';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(16, 0); g.lineTo(0, 16); g.fill();
  g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 16); g.lineTo(16, 32); g.lineTo(0, 32); g.fill();
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  return stripeTex;
}

let tileTex: THREE.Texture | null = null;
export function getTileTexture() {
  if (tileTex) return tileTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * 64, Math.random() * 64, 3, 3); }
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
  tileTex = new THREE.CanvasTexture(c);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  return tileTex;
}

/* ---------- realistic facade textures ---------- */
type Facade = 'glass' | 'concrete' | 'brick' | 'office';
interface FacadeTex { map: THREE.CanvasTexture; lit: THREE.CanvasTexture; floorsPerTile: number; baysPerTile: number; }
const facadeCache: Partial<Record<Facade, FacadeTex>> = {};

function noise(g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}

function makeFacade(kind: Facade): FacadeTex {
  const cached = facadeCache[kind]; if (cached) return cached;
  const W = 256, H = 256, bays = 4, floors = 4;
  const bw = W / bays, fh = H / floors;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const l = document.createElement('canvas'); l.width = W; l.height = H;
  const g = c.getContext('2d')!, gl = l.getContext('2d')!;
  gl.fillStyle = '#000'; gl.fillRect(0, 0, W, H);
  const wall = { glass: '#5f7486', concrete: '#b9b4aa', brick: '#8e4a36', office: '#d6d2c8' }[kind];
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  if (kind === 'brick') {
    for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 ? -8 : 0; x < W; x += 16) {
      const v = 120 + Math.random() * 40; g.fillStyle = `rgb(${v},${v * 0.5},${v * 0.38})`; g.fillRect(x + 1, y + 1, 14, 4);
    }
  }
  noise(g, W, H, 500, 0.12);
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
    const x0 = b * bw, y0 = f * fh;
    let wx: number, wy: number, ww: number, wh: number;
    if (kind === 'glass') { wx = x0 + 2; wy = y0 + 4; ww = bw - 4; wh = fh - 8; }
    else if (kind === 'office') { wx = x0 + 5; wy = y0 + 12; ww = bw - 10; wh = fh - 26; }
    else { wx = x0 + 16; wy = y0 + 12; ww = bw - 32; wh = fh - 22; }
    // glass pane with sky reflection gradient
    const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
    const refl = 0.55 + Math.random() * 0.3;
    gr.addColorStop(0, `rgba(${150 * refl},${180 * refl},${205 * refl},1)`);
    gr.addColorStop(1, `rgba(${40 * refl},${55 * refl},${75 * refl},1)`);
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    // frame / mullions
    g.strokeStyle = kind === 'glass' ? '#2c3440' : '#3b3a38'; g.lineWidth = kind === 'glass' ? 2 : 3;
    g.strokeRect(wx, wy, ww, wh);
    g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.stroke();
    if (kind !== 'glass') { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx - 3, wy + wh, ww + 6, 3); } // sill
    // interior at night: warm or cool lights, some curtains, many off
    const r = Math.random();
    if (r < 0.42) {
      const warm = Math.random() < 0.7;
      const v = 170 + Math.random() * 85;
      gl.fillStyle = warm ? `rgb(${v},${v * 0.82},${v * 0.55})` : `rgb(${v * 0.85},${v * 0.92},${v})`;
      gl.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      if (Math.random() < 0.4) { gl.fillStyle = 'rgba(0,0,0,0.55)'; gl.fillRect(wx + 1, wy + 1, ww * 0.45, wh - 2); }
    }
  }
  // floor slab lines for glass towers
  if (kind === 'glass') { g.fillStyle = '#39424d'; for (let f = 0; f < floors; f++) g.fillRect(0, f * fh, W, 3); }
  const map = new THREE.CanvasTexture(c); const lit = new THREE.CanvasTexture(l);
  for (const t of [map, lit]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  map.colorSpace = THREE.SRGBColorSpace;
  const out = { map, lit, floorsPerTile: floors, baysPerTile: bays };
  facadeCache[kind] = out;
  return out;
}

/* ---------- locations ---------- */
export interface Location { name: string; facades: Facade[]; minH: number; maxH: number; trees: number; snow: boolean; roofTone: string; }
export function locationFor(w: World): Location {
  switch (w.decor) {
    case 'neon': return { name: 'Downtown Financial District', facades: ['glass', 'glass', 'office', 'concrete'], minH: 35, maxH: 110, trees: 0, snow: false, roofTone: '#55595f' };
    case 'jungle': return { name: 'Riverside Old Town', facades: ['brick', 'brick', 'concrete'], minH: 12, maxH: 30, trees: 0.7, snow: false, roofTone: '#4a4038' };
    case 'ice': return { name: 'Northern Winter City', facades: ['concrete', 'brick', 'office'], minH: 16, maxH: 48, trees: 0.25, snow: true, roofTone: '#e9eef2' };
    default: return { name: 'Harbor Industrial Quarter', facades: ['concrete', 'brick', 'office'], minH: 16, maxH: 50, trees: 0.1, snow: false, roofTone: '#5a5652' };
  }
}

/* ---------- sky ---------- */
export class Sky {
  mesh: THREE.Mesh;
  uni: { top: { value: THREE.Color }; bottom: { value: THREE.Color }; night: { value: number }; time: { value: number } };
  sun: THREE.Mesh;
  constructor() {
    this.uni = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, night: { value: 0 }, time: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uni as any,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform float night; uniform float time; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){ float t = clamp(vP.y*1.4+0.15,0.0,1.0); vec3 c = mix(bottom, top, pow(t,0.8));
          vec3 q = floor(vP*220.0); float s = step(0.9985, h(q)) * night * smoothstep(0.15,0.5,vP.y) * 0.6;
          gl_FragColor = vec4(c + vec3(s), 1.0); }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), m);
    this.mesh.renderOrder = -10;
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(14, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.95 }));
    this.mesh.add(this.sun);
  }
}

export interface EnvState { night: number; }

interface Bld { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; decor: THREE.Group | null; side: number; facade: Facade; }

// shared geometries for rooftop details (created once)
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  mast: new THREE.CylinderGeometry(0.04, 0.06, 1, 5),
  cone: new THREE.ConeGeometry(0.5, 1, 7),
  sphere: new THREE.SphereGeometry(0.5, 8, 6),
};
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function std(color: string, rough = 0.85, metal = 0.05) {
  const k = `${color}|${rough}|${metal}`;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); matCache.set(k, m); }
  return m;
}
function part(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}

/** Themed world environment attached to a scene. Call update(playerZ, playerY, camPos, dt) each frame. */
export class Environment {
  group = new THREE.Group();
  sky = new Sky();
  hemi: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  fog: THREE.Fog;
  world: World;
  location: Location;
  private buildings: Bld[] = [];
  private far: THREE.Mesh[] = [];
  private span = 260;
  private cycle: number;
  private t = 0;
  private rngS = 1;
  private quality: QualityLevel;
  private litMats: THREE.MeshStandardMaterial[] = [];
  private beacons: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene, world: World, quality: QualityLevel, seed = 1, fixedNight: number | null = null) {
    this.world = world;
    this.location = locationFor(world);
    this.quality = quality;
    this.rngS = Math.max(1, seed);
    this.cycle = fixedNight == null ? (seed % 7) / 7 : -1;
    scene.add(this.group);
    scene.add(this.sky.mesh);
    // real-world haze: softer, bluish-grey instead of saturated colour fog
    const hazeCol = new THREE.Color(world.fog).lerp(new THREE.Color('#b8c2cc'), 0.55);
    this.fog = new THREE.Fog(hazeCol, 40, quality === 'low' ? 140 : 210);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight('#dfe9f5', '#6b6258', 0.95);
    scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight('#fff4e0', 1.8);
    this.sunLight.position.set(-8, 20, -6);
    if (quality !== 'low') {
      this.sunLight.castShadow = true;
      const s = quality === 'high' ? 2048 : 1024;
      this.sunLight.shadow.mapSize.set(s, s);
      const cam = this.sunLight.shadow.camera;
      cam.left = -14; cam.right = 14; cam.top = 22; cam.bottom = -10; cam.near = 1; cam.far = 60;
      this.sunLight.shadow.bias = -0.0008;
      this.sunLight.shadow.normalBias = 0.03;
    }
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);
    this.buildSkyline(quality);
    this.applyTime(fixedNight != null ? fixedNight : 0);
  }

  private rnd() { this.rngS = (this.rngS * 16807) % 2147483647; return this.rngS / 2147483647; }
  private pick<T>(a: T[]) { return a[Math.floor(this.rnd() * a.length) % a.length]; }

  private buildSkyline(q: QualityLevel) {
    const count = q === 'low' ? 22 : q === 'medium' ? 34 : 46;
    for (let i = 0; i < count; i++) {
      const facade = this.pick(this.location.facades);
      const f = makeFacade(facade);
      const map = f.map.clone(); map.needsUpdate = true;
      const lit = f.lit.clone(); lit.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        map, emissiveMap: lit, emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 0,
        roughness: facade === 'glass' ? 0.25 : 0.9, metalness: facade === 'glass' ? 0.55 : 0.02,
      });
      this.litMats.push(mat);
      const mesh = new THREE.Mesh(G.box, mat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      const b: Bld = { mesh, mat, decor: null, side: i % 2 ? 1 : -1, facade };
      this.buildings.push(b);
      this.placeBuilding(b, (i / count) * this.span - 40);
    }
    // distant skyline silhouettes
    const farMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.fog.color).multiplyScalar(0.82), fog: false });
    const farN = q === 'low' ? 14 : 26;
    for (let i = 0; i < farN; i++) {
      const w = 8 + this.rnd() * 16, h = 30 + this.rnd() * (this.location.maxH * 1.4);
      const m = new THREE.Mesh(G.box, farMat);
      m.scale.set(w, h, 6);
      m.userData.off = new THREE.Vector3((i - farN / 2) * 18 + this.rnd() * 8, h / 2 - 70, 300 + this.rnd() * 40);
      this.group.add(m); this.far.push(m);
    }
  }

  /** Rooftop gear that makes a building read as a real present-day building. */
  private makeDecor(h: number, wdt: number, dep: number, facade: Facade): THREE.Group {
    const g = new THREE.Group();
    const loc = this.location;
    const roof = std(loc.roofTone, 0.95);
    const metal = std('#9aa0a6', 0.5, 0.6);
    const dark = std('#3a3d42', 0.7, 0.3);
    // parapet
    const p = 0.35;
    g.add(part(G.box, roof, wdt + p, 1.1, p, 0, h + 0.55, dep / 2));
    g.add(part(G.box, roof, wdt + p, 1.1, p, 0, h + 0.55, -dep / 2));
    g.add(part(G.box, roof, p, 1.1, dep, wdt / 2, h + 0.55, 0));
    g.add(part(G.box, roof, p, 1.1, dep, -wdt / 2, h + 0.55, 0));
    // HVAC units
    const ac = 1 + Math.floor(this.rnd() * 3);
    for (let i = 0; i < ac; i++) {
      const x = (this.rnd() - 0.5) * wdt * 0.6, z = (this.rnd() - 0.5) * dep * 0.6;
      g.add(part(G.box, metal, 1.6, 1.1, 1.2, x, h + 0.55, z));
      g.add(part(G.cyl, dark, 0.9, 0.08, 0.9, x, h + 1.14, z));
    }
    // stair / lift housing
    g.add(part(G.box, std(facade === 'brick' ? '#7d4533' : '#8d8a84'), 2.4, 2.6, 2.4, (this.rnd() - 0.5) * wdt * 0.4, h + 1.3, (this.rnd() - 0.5) * dep * 0.4));
    // classic wooden water tank on brick/old town roofs
    if (facade === 'brick' && this.rnd() < 0.6) {
      const x = (this.rnd() - 0.5) * wdt * 0.5, z = (this.rnd() - 0.5) * dep * 0.5;
      for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) g.add(part(G.box, dark, 0.15, 2.4, 0.15, x + lx, h + 1.2, z + lz));
      g.add(part(G.cyl, std('#6e5238', 0.95), 2.2, 2.6, 2.2, x, h + 3.7, z));
      g.add(part(G.cone, dark, 2.4, 0.9, 2.4, x, h + 5.45, z));
    }
    // tall towers: antenna mast with red aircraft-warning light
    if (h > 55 || (facade === 'glass' && this.rnd() < 0.5)) {
      const mh = 6 + this.rnd() * 10;
      g.add(part(G.mast, metal, 1, mh, 1, 0, h + mh / 2, 0));
      const bm = new THREE.MeshStandardMaterial({ color: '#550000', emissive: '#ff2020', emissiveIntensity: 0 });
      this.beacons.push(bm);
      g.add(part(G.sphere, bm, 0.4, 0.4, 0.4, 0, h + mh, 0));
    }
    // solar panels on some modern roofs
    if (facade !== 'brick' && this.rnd() < 0.35) {
      const pm = std('#1d2b44', 0.3, 0.4);
      for (let i = 0; i < 3; i++) { const s = part(G.box, pm, 1.6, 0.08, 1.0, -wdt * 0.25 + i * 1.8, h + 0.5, dep * 0.25); s.rotation.x = -0.35; g.add(s); }
    }
    // snow caps in the winter city
    if (loc.snow) g.add(part(G.box, std('#f4f8fb', 0.9), wdt, 0.25, dep, 0, h + 0.13, 0));
    // street trees at the base for the old-town / riverside look
    if (this.rnd() < loc.trees) {
      const leaf = std(loc.snow ? '#6f8a78' : this.rnd() < 0.5 ? '#3f6b3a' : '#4d7b40', 0.95);
      for (let i = 0; i < 2; i++) {
        const tz = (i - 0.5) * dep * 0.7, tx = -wdt / 2 - 2;
        g.add(part(G.cyl, std('#5a4330'), 0.35, 4, 0.35, tx, 2, tz));
        g.add(part(G.sphere, leaf, 3.4, 3.8, 3.4, tx, 5.2, tz));
      }
    }
    return g;
  }

  private disposeDecor(d: THREE.Group) {
    this.group.remove(d);
    d.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && this.beacons.includes(m)) { this.beacons.splice(this.beacons.indexOf(m), 1); m.dispose(); }
    });
  }

  private placeBuilding(b: Bld, z: number) {
    const loc = this.location;
    const width = 8 + this.rnd() * 10;
    const depth = 8 + this.rnd() * 10;
    const tall = b.facade === 'glass';
    const h = loc.minH + this.rnd() * (tall ? loc.maxH - loc.minH : (loc.maxH - loc.minH) * 0.6);
    const x = b.side * (9 + width / 2 + this.rnd() * 22);
    b.mesh.scale.set(width, h, depth);
    b.mesh.position.set(x, -40, z);
    // keep real-world proportions: ~3.5 m per floor, ~3 m per window bay
    const f = makeFacade(b.facade);
    const rx = Math.max(1, Math.round(width / 3 / f.baysPerTile));
    const ry = Math.max(1, Math.round(h / 3.5 / f.floorsPerTile));
    (b.mat.map as THREE.Texture).repeat.set(rx, ry);
    (b.mat.emissiveMap as THREE.Texture).repeat.set(rx, ry);
    const off = Math.floor(this.rnd() * 4) / 4;
    (b.mat.map as THREE.Texture).offset.set(off, 0);
    (b.mat.emissiveMap as THREE.Texture).offset.set(off, 0);
    if (b.decor) this.disposeDecor(b.decor);
    b.decor = this.makeDecor(h / 2, width, depth, b.facade);
    b.decor.position.set(x, -40, z);
    this.group.add(b.decor);
  }

  private applyTime(n: number) {
    const w = this.world;
    this.sky.uni.night.value = n;
    // realistic sky: soft blue day -> orange dusk -> deep navy night
    const dayTop = new THREE.Color(w.skyTop).lerp(new THREE.Color('#4f8fd6'), 0.6);
    const dayBot = new THREE.Color(w.skyBottom).lerp(new THREE.Color('#cfe3f2'), 0.6);
    const dusk = Math.max(0, 1 - Math.abs(n - 0.5) * 3); // peaks at sunset
    this.sky.uni.top.value.copy(dayTop).lerp(new THREE.Color('#0b1426'), n);
    this.sky.uni.bottom.value.copy(dayBot).lerp(new THREE.Color('#1c2438'), n).lerp(new THREE.Color('#f29a5c'), dusk * 0.6);
    this.fog.color.copy(this.sky.uni.bottom.value).lerp(new THREE.Color('#9aa6b2'), 0.3 * (1 - n));
    this.hemi.intensity = 1.0 - n * 0.55;
    this.hemi.color.set('#dfe9f5').lerp(new THREE.Color('#6d7fb0'), n);
    this.sunLight.intensity = 1.9 - n * 1.5;
    this.sunLight.color.set('#fff4e0').lerp(new THREE.Color('#ff9a5a'), dusk).lerp(new THREE.Color('#9fb4ff'), n * 0.8);
    const a = 0.35 + n * 0.1;
    (this.sky.sun.material as THREE.MeshBasicMaterial).color.set(n > 0.6 ? '#e8f0ff' : dusk > 0.4 ? '#ffb070' : '#fff8e8');
    this.sky.sun.position.set(-Math.cos(a) * 300, 70 - n * 45, 250);
    this.sky.sun.lookAt(0, 0, 0);
    // windows light up as it gets dark; aircraft beacons on at night
    const glow = THREE.MathUtils.smoothstep(n, 0.3, 0.8) * 1.6;
    this.litMats.forEach((m) => (m.emissiveIntensity = glow));
    this.beacons.forEach((m) => (m.emissiveIntensity = n > 0.3 ? 2 : 0.3));
  }

  get night() { return this.sky.uni.night.value; }

  update(pz: number, py: number, camPos: THREE.Vector3, dt: number) {
    this.t += dt;
    this.sky.uni.time.value = this.t;
    this.sky.mesh.position.copy(camPos);
    if (this.cycle >= 0) {
      const phase = (this.cycle + this.t / 180) % 1; // full day/night every 3 minutes
      const n = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
      this.applyTime(n);
    }
    // blink beacons
    if (this.night > 0.3) { const on = Math.sin(this.t * 3) > 0 ? 2.2 : 0.2; this.beacons.forEach((m) => (m.emissiveIntensity = on)); }
    const baseY = py - 40;
    for (const b of this.buildings) {
      if (b.mesh.position.z < pz - 40) this.placeBuilding(b, b.mesh.position.z + this.span);
      b.mesh.position.y += (baseY - b.mesh.position.y) * Math.min(1, dt * 0.8);
      if (b.decor) b.decor.position.y = b.mesh.position.y;
    }
    for (const f of this.far) {
      const o = f.userData.off as THREE.Vector3;
      f.position.set(o.x + camPos.x * 0.9, o.y + py * 0.7, o.z + pz);
    }
    this.sunLight.position.set(camPos.x - 8, py + 20, pz - 6);
    this.sunLight.target.position.set(camPos.x, py, pz + 6);
  }
}
