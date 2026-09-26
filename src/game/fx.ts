// GPU-light particle system (single Points draw call) + speed lines.
import * as THREE from 'three';

export class Particles {
  points: THREE.Points;
  private max: number;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private vel: Float32Array; private life: Float32Array; private maxLife: Float32Array; private grav: Float32Array; private baseSize: Float32Array;
  private next = 0;
  private tmp = new THREE.Color();

  constructor(max = 600) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.baseSize = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: window.innerHeight * 0.5 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if(r>0.5) discard; float a = smoothstep(0.5,0.0,r); gl_FragColor = vec4(vC, a*vA); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, n: number, color: string | THREE.Color, o: { speed?: number; up?: number; life?: number; size?: number; grav?: number; spread?: number; vz?: number; hueShift?: boolean } = {}) {
    const c = typeof color === 'string' ? this.tmp.set(color) : color;
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      const sp = o.speed ?? 3; const spread = o.spread ?? 0.2;
      this.pos[i * 3] = x + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = (Math.random() - 0.5) * sp * 2;
      this.vel[i * 3 + 1] = (o.up ?? 1) * Math.random() * sp;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * sp * 2 + (o.vz ?? 0);
      const l = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      this.life[i] = l; this.maxLife[i] = l;
      this.grav[i] = o.grav ?? 6;
      this.baseSize[i] = (o.size ?? 0.25) * (0.6 + Math.random() * 0.8);
      if (o.hueShift) { this.tmp.setHSL(Math.random(), 1, 0.6); this.col[i * 3] = this.tmp.r; this.col[i * 3 + 1] = this.tmp.g; this.col[i * 3 + 2] = this.tmp.b; }
      else { this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b; }
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = t;
      this.size[i] = this.baseSize[i] * (0.4 + t * 0.6);
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class SpeedLines {
  lines: THREE.LineSegments;
  private n: number;
  private data: { x: number; y: number; z: number }[] = [];
  private arr: Float32Array;
  constructor(n = 40) {
    this.n = n;
    this.arr = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.arr, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.lines.frustumCulled = false;
    for (let i = 0; i < n; i++) this.data.push(this.rand(Math.random() * 30));
  }
  private rand(z: number) {
    const a = Math.random() * Math.PI * 2; const r = 2.5 + Math.random() * 4;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7 + 1.5, z };
  }
  update(cx: number, cy: number, cz: number, speed: number, intensity: number, dt: number) {
    const m = this.lines.material as THREE.LineBasicMaterial;
    m.opacity += (Math.min(0.6, intensity) - m.opacity) * Math.min(1, dt * 6);
    if (m.opacity < 0.01) { this.lines.visible = false; return; }
    this.lines.visible = true;
    for (let i = 0; i < this.n; i++) {
      const d = this.data[i];
      d.z -= speed * 2.2 * dt;
      if (d.z < -2) this.data[i] = this.rand(30);
      const len = 1.5 + speed * 0.12;
      this.arr[i * 6] = cx + d.x; this.arr[i * 6 + 1] = cy + d.y; this.arr[i * 6 + 2] = cz + d.z;
      this.arr[i * 6 + 3] = cx + d.x; this.arr[i * 6 + 4] = cy + d.y; this.arr[i * 6 + 5] = cz + d.z + len;
    }
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

export const TRAIL_COLORS: Record<string, string[]> = {
  neon: ['#00F0FF', '#7df9ff'], smoke: ['#6a6f85', '#9aa0b5'], fire: ['#ff3d00', '#ff9a00', '#ffd23f'], stars: ['#fff4b0', '#ffffff', '#ffe066'],
  ice: ['#a8e8ff', '#e8fbff'], rainbow: [], gold: ['#ffb800', '#ffd966'],
};
export const LANDING_COLORS: Record<string, string[]> = {
  dust: ['#c8b89a', '#a89878'], sparks: ['#ffb800', '#ff6a00'], snow: ['#ffffff', '#dff4ff'], petals: ['#ff8fc7', '#ffc2e0'], shock: ['#00f0ff', '#ffffff'], bolt: ['#b45cff', '#ffffff'],
};
