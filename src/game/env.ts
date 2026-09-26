// Shared environment: gradient sky with day/night, lights, recycling skyline + themed decor.
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
          vec3 q = floor(vP*220.0); float s = step(0.9965, h(q)) * night * smoothstep(0.05,0.4,vP.y);
          s *= 0.6 + 0.4*sin(time*3.0 + h(q)*40.0);
          gl_FragColor = vec4(c + vec3(s), 1.0); }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), m);
    this.mesh.renderOrder = -10;
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(18, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.95 }));
    this.mesh.add(this.sun);
  }
}

export interface EnvState { night: number; }

/** Themed world environment attached to a scene. Call update(playerZ, dt) each frame. */
export class Environment {
  group = new THREE.Group();
  sky = new Sky();
  hemi: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  fog: THREE.Fog;
  world: World;
  private buildings: { mesh: THREE.Mesh; decor: THREE.Object3D | null; side: number }[] = [];
  private far: THREE.Mesh[] = [];
  private span = 260;
  private cycle: number;
  private t = 0;
  private rngS = 1;
  private neonMats: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene, world: World, quality: QualityLevel, seed = 1, fixedNight: number | null = null) {
    this.world = world;
    this.rngS = seed;
    this.cycle = fixedNight == null ? (seed % 7) / 7 : -1;
    scene.add(this.group);
    scene.add(this.sky.mesh);
    this.fog = new THREE.Fog(world.fog, 30, quality === 'low' ? 120 : 170);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight('#ffffff', world.ground, 0.9);
    scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(world.sun, 1.6);
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
    if (fixedNight != null) this.applyTime(fixedNight);
    this.buildSkyline(quality);
  }

  private rnd() { this.rngS = (this.rngS * 16807) % 2147483647; return this.rngS / 2147483647; }

  private buildSkyline(q: QualityLevel) {
    const w = this.world;
    const count = q === 'low' ? 22 : q === 'medium' ? 34 : 46;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const tex = getWindowTexture();
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const color = new THREE.Color(w.building).offsetHSL(0, 0, (this.rnd() - 0.5) * 0.08);
      const isNature = w.decor === 'jungle' || w.decor === 'ice';
      const m = new THREE.MeshStandardMaterial({
        color, roughness: 0.85, flatShading: true,
        emissive: isNature ? new THREE.Color('#000') : new THREE.Color(w.decor === 'neon' ? '#9fdcff' : '#ffd9a0'),
        emissiveMap: isNature ? null : tex.clone(), emissiveIntensity: w.decor === 'neon' ? 1.3 : 0.9,
      });
      if (m.emissiveMap) { m.emissiveMap.needsUpdate = true; }
      const mesh = new THREE.Mesh(geo, m);
      mesh.receiveShadow = false;
      this.group.add(mesh);
      const b = { mesh, decor: null as THREE.Object3D | null, side };
      this.buildings.push(b);
      this.placeBuilding(b, (i / count) * this.span - 40);
    }
    // far parallax silhouettes
    const farMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(w.building).multiplyScalar(0.6), fog: true });
    const farCount = q === 'low' ? 8 : 16;
    for (let i = 0; i < farCount; i++) {
      const isPeak = w.decor === 'ice' || w.decor === 'jungle';
      const g = isPeak ? new THREE.ConeGeometry(30 + this.rnd() * 30, 60 + this.rnd() * 70, 5) : new THREE.BoxGeometry(20 + this.rnd() * 20, 60 + this.rnd() * 90, 20);
      const mm = new THREE.Mesh(g, isPeak && w.decor === 'ice' ? new THREE.MeshBasicMaterial({ color: '#cfe4f7' }) : farMat);
      const a = (i / farCount) * Math.PI - Math.PI / 2 + (this.rnd() - 0.5) * 0.2;
      mm.userData.off = new THREE.Vector3(Math.sin(a) * 150, -20, Math.cos(a) * 150 + 40);
      this.group.add(mm);
      this.far.push(mm);
    }
  }

  private makeDecor(h: number, wdt: number): THREE.Object3D | null {
    const w = this.world;
    const r = this.rnd();
    const g = new THREE.Group();
    const std = (c: string, e = 0) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, emissive: e ? new THREE.Color(c) : new THREE.Color('#000'), emissiveIntensity: e });
    if (w.decor === 'neon') {
      const c = r < 0.5 ? w.accent : w.accent2;
      const mat = std(c, 2.2); this.neonMats.push(mat);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(wdt * 0.8, 1.2 + r * 2, 0.3), mat);
      sign.position.y = h * (0.5 + r * 0.4);
      g.add(sign);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, h * 0.9, 0.25), mat);
      strip.position.set(wdt * 0.5, h * 0.45, 0); g.add(strip);
    } else if (w.decor === 'city') {
      if (r < 0.5) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 10), std('#6b4a3a'));
        tank.position.y = h + 3.2; g.add(tank);
        const legs = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 4, 1, true), std('#333'));
        legs.position.y = h + 1; g.add(legs);
      } else {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 4), std('#888'));
        ant.position.y = h + 3; g.add(ant);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), std('#ff3030', 3));
        light.position.y = h + 6; g.add(light);
      }
    } else if (w.decor === 'industrial') {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 10, 8), std('#5a4238'));
      stack.position.set(0, h + 5, 0); g.add(stack);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 8), std(w.accent, 1.5));
      band.position.set(0, h + 8.5, 0); g.add(band);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, wdt + 4, 6), std('#7a6a5a'));
      pipe.rotation.z = Math.PI / 2; pipe.position.y = h * 0.6; g.add(pipe);
    } else if (w.decor === 'jungle') {
      for (let i = 0; i < 2; i++) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 5, 5), std('#5a3d24'));
        trunk.position.set((i - 0.5) * wdt * 0.5, h + 2.5, 0); g.add(trunk);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4 + r, 0), std(i ? '#2f8f4f' : '#3fae5a'));
        leaves.position.set((i - 0.5) * wdt * 0.5, h + 5.8, 0); g.add(leaves);
      }
      const vine = new THREE.Mesh(new THREE.BoxGeometry(0.3, h * 0.6, 0.3), std('#2EE6A6', 0.3));
      vine.position.set(wdt * 0.5, h * 0.7, 0); g.add(vine);
    } else if (w.decor === 'ice') {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.5 + r, 5 + r * 5, 5), new THREE.MeshStandardMaterial({ color: '#dff6ff', roughness: 0.15, metalness: 0.1, flatShading: true, emissive: '#6fd0ff', emissiveIntensity: 0.25 }));
      spike.position.y = h + 2.5 + r * 2.5; g.add(spike);
    }
    return g;
  }

  private placeBuilding(b: { mesh: THREE.Mesh; decor: THREE.Object3D | null; side: number }, z: number) {
    const w = this.world;
    const nature = w.decor === 'jungle' || w.decor === 'ice';
    const width = 6 + this.rnd() * 10;
    const depth = 6 + this.rnd() * 10;
    const h = nature ? 10 + this.rnd() * 25 : 18 + this.rnd() * (w.decor === 'neon' ? 70 : 45);
    const x = b.side * (9 + width / 2 + this.rnd() * 22);
    b.mesh.scale.set(width, h, depth);
    b.mesh.position.set(x, -40, z);
    const m = b.mesh.material as THREE.MeshStandardMaterial;
    if (m.emissiveMap) m.emissiveMap.repeat.set(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(h / 8)));
    if (b.decor) { this.group.remove(b.decor); }
    b.decor = this.makeDecor(h, width);
    if (b.decor) { b.decor.position.set(x - b.side * 0.5 * (w.decor === 'neon' ? -width / 2 - 0.2 : 0), -40, z); if (w.decor === 'neon') b.decor.position.x = x - b.side * (width / 2 + 0.2); this.group.add(b.decor); }
  }

  private applyTime(n: number) {
    const w = this.world;
    this.sky.uni.night.value = n;
    this.sky.uni.top.value.set(w.skyTop).lerp(new THREE.Color(w.nightTop), n);
    this.sky.uni.bottom.value.set(w.skyBottom).lerp(new THREE.Color(w.nightBottom), n);
    this.fog.color.set(w.fog).lerp(new THREE.Color(w.nightBottom), n * 0.85);
    this.hemi.intensity = 1.0 - n * 0.45;
    this.hemi.color.set('#ffffff').lerp(new THREE.Color('#7f8cff'), n);
    this.sunLight.intensity = 1.7 - n * 1.1;
    this.sunLight.color.set(w.sun).lerp(new THREE.Color('#9fb4ff'), n);
    const a = 0.35 + n * 0.1;
    (this.sky.sun.material as THREE.MeshBasicMaterial).color.set(n > 0.5 ? '#e8f0ff' : w.sun);
    this.sky.sun.position.set(-Math.cos(a) * 300, 60 + (1 - n) * 40, 250);
    this.sky.sun.lookAt(0, 0, 0);
    this.neonMats.forEach((m) => (m.emissiveIntensity = 1.6 + n * 1.4));
  }

  get night() { return this.sky.uni.night.value; }

  update(pz: number, py: number, camPos: THREE.Vector3, dt: number) {
    this.t += dt;
    this.sky.uni.time.value = this.t;
    this.sky.mesh.position.copy(camPos);
    if (this.cycle >= 0) {
      const phase = (this.cycle + this.t / 120) % 1; // full day/night every 2 minutes
      const n = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
      this.applyTime(n);
    }
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
