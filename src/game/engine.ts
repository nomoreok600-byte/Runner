// SKYRUSH gameplay engine: physics, parkour state machine, course rendering, camera and FX.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Runner, Look, Anim } from './runner';
import { CourseBuilder, Course, Plat, Obst, WallS, Zip, Swing, Spring, Pick, LW, laneX, G, JUMP_V, FULL_W, PickType } from './level';
import { Environment, QualityLevel, getWindowTexture, getStripeTexture, getTileTexture } from './env';
import { Particles, SpeedLines, TRAIL_COLORS, LANDING_COLORS } from './fx';
import { World, worldForLevel, itemById } from './data';
import { audio, haptic } from './audio';

export type Input = 'jump' | 'slide' | 'left' | 'right' | 'tap' | 'dash';
export type PowerKind = 'magnet' | 'shield' | 'slowmo' | 'double' | 'superjump';
export interface Hud {
  coins: number; gems: number; distance: number; progress: number; combo: number; comboT: number; time: number;
  tokens: boolean[]; powers: Record<PowerKind, number>; score: number; speed: number;
}
export interface RunResult {
  mode: 'level' | 'endless' | 'tutorial'; level: number; completed: boolean; stars: number; starFlags: [boolean, boolean, boolean];
  time: number; par: number; coins: number; coinTotal: number; gems: number; tokens: boolean[]; distance: number; bestCombo: number; score: number;
  deaths: number; stats: Record<string, number>; xp: number;
}
export interface EngineCallbacks {
  onHud: (h: Hud) => void;
  onPopup: (text: string, color: string, big?: boolean) => void;
  onDeath: (canRevive: boolean) => void;
  onEnd: (r: RunResult) => void;
  onHint: (text: string) => void;
}
export interface EngineOpts { canvas: HTMLCanvasElement; level: number; endless: boolean; look: Look; quality: QualityLevel; }

type Mode = 'ground' | 'air' | 'wall' | 'zip' | 'swing' | 'ledge' | 'dead' | 'finish' | 'intro';
const POWER_DUR: Record<PowerKind, number> = { magnet: 9, shield: 20, slowmo: 5, double: 10, superjump: 8 };
const POWER_COLOR: Record<PowerKind, string> = { magnet: '#ff4d6d', shield: '#3b9cff', slowmo: '#b45cff', double: '#ffb800', superjump: '#2ee6a6' };
const VIEW = 170;

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  composer: EffectComposer | null = null;
  env: Environment;
  runner: Runner;
  course: Course;
  builder: CourseBuilder;
  world: World;
  particles: Particles;
  speedLines: SpeedLines;
  cb: EngineCallbacks;
  quality: QualityLevel;
  paused = false;

  // player
  px = 0; py = 0; pz = 0; vy = 0; lane = 0; mode: Mode = 'intro';
  jumps = 0; airTime = 0; coyote = 0; slideT = 0; rollT = 0; vaultT = 0; dashT = 0; dashCd = 0; ledgeT = 0; ledgeFrom = 0; ledgeTo = 0;
  swingT = 0; swingA0 = 0; swingBoost = 0; invulnT = 0; stumbleT = 0; jumpBuffer = 0; rollQueue = -9; tapQueue = -9; springT = 0;
  curWall: WallS | null = null; lastWallId = -1; curZip: Zip | null = null; curSwing: Swing | null = null; groundPlat: Plat | null = null;
  lastSafe = { z: 0, y: 0 }; lastGroundY = 0;
  // run state
  time = 0; now = 0; coins = 0; gems = 0; tokens = [false, false, false]; combo = 0; comboT = 0; bestCombo = 0; score = 0; deaths = 0; revived = false;
  powers: Record<PowerKind, number> = { magnet: 0, shield: 0, slowmo: 0, double: 0, superjump: 0 };
  stats: Record<string, number> = {};
  slowMoT = 0; shake = 0; fovKick = 0; deathT = 0; finishT = 0; introT = 0; cpIdx = 0; hintIdx = 0; ended = false; deathReported = false;
  deathKind: 'fall' | 'hit' = 'fall';

  private objs = new Map<number, THREE.Object3D>();
  private coinMesh: THREE.InstancedMesh;
  private trolley: THREE.Mesh;
  private mats: Record<string, THREE.Material> = {};
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private trailStyle: string;
  private landingStyle: string;
  private dummy = new THREE.Object3D();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private finishObj: THREE.Object3D | null = null;
  private cpObjs: THREE.Object3D[] = [];
  private ro: ResizeObserver;
  private disposed = false;

  constructor(o: EngineOpts, cb: EngineCallbacks) {
    this.cb = cb;
    this.quality = o.quality;
    const q = o.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const tut = o.level === 0 && !o.endless;
    this.world = o.endless ? worldForLevel(1 + Math.floor(Math.random() * 50)) : worldForLevel(Math.max(1, o.level));
    this.builder = new CourseBuilder(o.level, o.endless);
    this.course = this.builder.c;
    this.env = new Environment(this.scene, this.world, q, o.endless ? Date.now() % 1000 : o.level * 31 + 7, tut ? 0.2 : null);
    this.runner = new Runner(o.look);
    this.runner.root.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = q !== 'low'; });
    this.scene.add(this.runner.root);
    this.trailStyle = itemById(o.look.equip.trail)?.style || 'none';
    this.landingStyle = itemById(o.look.equip.landing)?.style || 'dust';
    this.particles = new Particles(q === 'low' ? 350 : 800);
    this.scene.add(this.particles.points);
    this.speedLines = new SpeedLines(q === 'low' ? 24 : 48);
    this.scene.add(this.speedLines.lines);
    this.buildMaterials();
    const coinGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.09, q === 'low' ? 10 : 16);
    coinGeo.rotateX(Math.PI / 2);
    this.coinMesh = new THREE.InstancedMesh(coinGeo, this.mats.coin, 320);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    this.scene.add(this.coinMesh);
    this.trolley = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), this.mats.metal);
    this.trolley.visible = false;
    this.scene.add(this.trolley);
    this.buildStatic();

    if (q === 'high') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.82));
      this.composer.addPass(new OutputPass());
    }

    this.camPos.set(0, 4, -8);
    this.camera.position.copy(this.camPos);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(o.canvas.parentElement || o.canvas);
    this.resize();
    this.lastSafe = { z: 0, y: 0 };
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------ setup
  private buildMaterials() {
    const w = this.world;
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ flatShading: true, ...p });
    const top = std({ color: w.ground, map: getTileTexture(), roughness: 0.85 });
    const side = std({ color: w.building, roughness: 0.9, emissive: new THREE.Color(w.decor === 'jungle' || w.decor === 'ice' ? '#000000' : w.decor === 'neon' ? '#8fd8ff' : '#ffd08a'), emissiveMap: getWindowTexture(), emissiveIntensity: w.decor === 'neon' ? 1.2 : 0.7 });
    if (w.decor === 'jungle') { side.color = new THREE.Color('#6b6a4f'); }
    if (w.decor === 'ice') { side.color = new THREE.Color('#bcd8ef'); side.roughness = 0.3; }
    this.mats = {
      top, side,
      edge: std({ color: w.groundEdge, emissive: new THREE.Color(w.groundEdge), emissiveIntensity: 2.2 }),
      crumble: std({ color: '#c46b3a', map: getTileTexture(), roughness: 1, emissive: new THREE.Color('#401000'), emissiveIntensity: 0.4 }),
      moving: std({ color: '#5a6690', roughness: 0.4, metalness: 0.5 }),
      under: std({ color: w.accent2, emissive: new THREE.Color(w.accent2), emissiveIntensity: 2.5 }),
      conveyor: std({ color: '#ffffff', map: getStripeTexture().clone(), roughness: 0.6 }),
      hazard: std({ color: '#ffffff', map: getStripeTexture(), roughness: 0.7 }),
      metal: std({ color: '#aab4c8', metalness: 0.85, roughness: 0.3 }),
      dark: std({ color: '#1b1e2c', roughness: 0.6 }),
      laser: new THREE.MeshBasicMaterial({ color: '#ff2a4a', transparent: true, opacity: 0.95 }),
      laserGlow: new THREE.MeshBasicMaterial({ color: '#ff2a4a', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
      droneEye: new THREE.MeshBasicMaterial({ color: '#ff2a4a' }),
      coin: std({ color: '#ffc21a', metalness: 0.9, roughness: 0.25, emissive: new THREE.Color('#ff9900'), emissiveIntensity: 0.6 }),
      gem: std({ color: '#ff3fb4', metalness: 0.3, roughness: 0.1, emissive: new THREE.Color('#ff2e9e'), emissiveIntensity: 1.2 }),
      token: std({ color: '#ffd84a', metalness: 1, roughness: 0.15, emissive: new THREE.Color('#ffb800'), emissiveIntensity: 1.4 }),
      bubble: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2 }),
      spring: std({ color: '#2ee6a6', emissive: new THREE.Color('#2ee6a6'), emissiveIntensity: 1.8 }),
      wallrun: std({ color: w.building, roughness: 0.7, emissive: new THREE.Color(w.accent), emissiveMap: getWindowTexture(), emissiveIntensity: 0.5 }),
      accent: std({ color: w.accent, emissive: new THREE.Color(w.accent), emissiveIntensity: 2 }),
      accent2: std({ color: w.accent2, emissive: new THREE.Color(w.accent2), emissiveIntensity: 2 }),
      flag: std({ color: '#ffffff', side: THREE.DoubleSide, emissive: new THREE.Color(w.accent), emissiveIntensity: 0.3 }),
      shield: new THREE.MeshBasicMaterial({ color: '#3b9cff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    (this.mats.conveyor as THREE.MeshStandardMaterial).map!.repeat.set(3, 12);
  }

  private shieldMesh!: THREE.Mesh;
  private buildStatic() {
    const c = this.course;
    // finish arch
    if (c.finishZ > 0) {
      const g = new THREE.Group();
      const fy = this.platTopAt(c.finishZ + 5);
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 16;
      const cx = cv.getContext('2d')!;
      for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { cx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cx.fillRect(i * 4, j * 4, 4, 4); }
      const checker = new THREE.CanvasTexture(cv); checker.magFilter = THREE.NearestFilter;
      const banner = new THREE.Mesh(new THREE.BoxGeometry(FULL_W + 1.5, 1.2, 0.3), new THREE.MeshStandardMaterial({ map: checker, emissive: new THREE.Color('#ffffff'), emissiveMap: checker, emissiveIntensity: 0.4 }));
      banner.position.set(0, 5.2, 0); g.add(banner);
      [-1, 1].forEach((s) => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.8, 0.5), this.mats.accent); p.position.set(s * (FULL_W / 2 + 0.5), 2.9, 0); g.add(p);
      });
      const line = new THREE.Mesh(new THREE.PlaneGeometry(FULL_W, 1.2), new THREE.MeshBasicMaterial({ map: checker }));
      line.rotation.x = -Math.PI / 2; line.position.y = 0.02; g.add(line);
      g.position.set(0, fy, c.finishZ);
      this.scene.add(g);
      this.finishObj = g;
    }
    c.checkpoints.forEach((z) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), this.mats.metal); pole.position.y = 1.8; g.add(pole);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(1.4, -0.4); shape.lineTo(0, -0.85);
      const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), (this.mats.flag as THREE.Material).clone()); flag.position.set(0, 3.5, 0); flag.rotation.y = Math.PI / 2; g.add(flag);
      g.userData.flag = flag;
      [-1, 1].forEach((s) => { const cp = g.clone(); cp.position.set(s * (FULL_W / 2 + 0.2), this.platTopAt(z), z); cp.userData.flag = cp.children[1]; this.scene.add(cp); this.cpObjs.push(cp); });
    });
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 12), this.mats.shield);
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);
  }

  private platTopAt(z: number) {
    let best = -99;
    for (const p of this.course.plats) if (z >= p.z0 && z <= p.z1 && p.y > best) best = p.y;
    return best === -99 ? 0 : best;
  }

  resize() {
    const el = this.renderer.domElement.parentElement || this.renderer.domElement;
    const w = el.clientWidth || window.innerWidth; const h = el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pm = this.particles.points.material as THREE.ShaderMaterial;
    pm.uniforms.scale.value = h * 0.5 * this.renderer.getPixelRatio();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.composer?.dispose();
    this.renderer.dispose();
  }

  setPaused(p: boolean) { this.paused = p; this.last = performance.now(); }

  // ------------------------------------------------ helpers
  private get speedBase() {
    let s = this.builder.speedAt(this.pz);
    if (this.powers.slowmo > 0) s *= 0.68;
    if (this.dashT > 0) s *= 1.75;
    if (this.swingBoost > 0 && this.mode === 'air') s *= 1.3;
    if (this.stumbleT > 0) s *= 0.7;
    if (this.mode === 'ground' && this.groundPlat?.kind === 'conveyor') s += this.groundPlat.conv || 0;
    return Math.max(4, s);
  }
  private platOffset(p: Plat) {
    if (p.kind !== 'moving') return { x: 0, y: 0 };
    const a = this.now * (p.ms || 1) + (p.mp || 0);
    return { x: (p.mx || 0) * Math.sin(a), y: (p.my || 0) * Math.sin(a) };
  }
  private near<T extends { z0?: number; z1?: number; z?: number }>(arr: T[], back = 4, ahead = 8): T[] {
    const pz = this.pz;
    return arr.filter((a) => {
      const z0 = a.z0 ?? a.z!; const z1 = a.z1 ?? a.z!;
      return z1 > pz - back && z0 < pz + ahead;
    });
  }
  private groundAt(x: number, z: number, feet: number): { y: number; p: Plat } | null {
    let best: { y: number; p: Plat } | null = null;
    for (const p of this.near(this.course.plats, 2, 2)) {
      if (z < p.z0 - 0.1 || z > p.z1 + 0.1) continue;
      const off = this.platOffset(p);
      if (Math.abs(x - (p.x + off.x)) > p.w / 2 + 0.3) continue;
      if (p.kind === 'crumble' && (p.drop || 0) > 0.35) continue;
      const top = p.y + off.y - (p.drop || 0);
      if (top <= feet + 0.4 && (!best || top > best.y)) best = { y: top, p };
    }
    return best;
  }
  private addStat(k: string, n = 1) { this.stats[k] = (this.stats[k] || 0) + n; }
  private trick(name: string, color = '#00F0FF', perfect = false) {
    this.combo += 1;
    this.comboT = 3;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += 100 * this.combo * (perfect ? 2 : 1);
    const label = this.combo > 1 ? `${name} x${this.combo}` : name;
    this.cb.onPopup(label, perfect ? '#FFB800' : color, perfect || this.combo % 5 === 0);
    if (this.combo > 1) audio.play('combo');
    if (perfect) this.slowMoT = 0.28;
  }
  private breakCombo() { this.combo = 0; this.comboT = 0; }

  // ------------------------------------------------ input
  input(i: Input) {
    if (this.paused) return;
    if (this.mode === 'intro') { if (i === 'jump' || i === 'tap') this.introT = 99; return; }
    if (this.mode === 'dead' || this.mode === 'finish') return;
    const sj = this.powers.superjump > 0 ? 1.3 : 1;
    switch (i) {
      case 'jump':
        if (this.mode === 'ground' || (this.mode === 'air' && this.coyote > 0 && this.jumps === 0)) {
          this.vy = JUMP_V * sj; this.mode = 'air'; this.jumps = 1; this.slideT = 0; this.rollT = 0; this.airTime = 0; this.coyote = 0;
          this.addStat('jumps'); audio.play('jump');
        } else if (this.mode === 'wall' && this.curWall) {
          const w = this.curWall;
          this.lastWallId = w.id; this.curWall = null;
          this.vy = JUMP_V * 1.02 * sj; this.mode = 'air'; this.jumps = 1; this.lane = -w.side;
          this.addStat('wallJumps'); this.addStat('jumps'); this.trick('WALL JUMP', '#FF2E9E'); audio.play('double'); haptic(12);
        } else if (this.mode === 'zip') {
          this.curZip = null; this.trolley.visible = false; this.mode = 'air'; this.vy = JUMP_V * 0.85; this.jumps = 1; audio.play('jump');
        } else if (this.mode === 'swing') {
          this.releaseSwing();
        } else if (this.mode === 'air' && this.jumps < 2) {
          this.vy = JUMP_V * 0.95 * sj; this.jumps = 2; this.flip = 0;
          this.addStat('doubleJumps'); this.addStat('jumps'); audio.play('double');
          this.particles.emit(this.px, this.py, this.pz, 12, '#ffffff', { speed: 3, up: -0.5, life: 0.4, size: 0.25, grav: 0 });
        } else this.jumpBuffer = 0.18;
        break;
      case 'slide':
        if (this.mode === 'ground') {
          if (this.slideT <= 0) { this.slideT = 0.75; this.addStat('slides'); audio.play('slide'); }
        } else if (this.mode === 'air') { this.vy = Math.min(this.vy, -20); this.rollQueue = this.now; }
        else if (this.mode === 'wall') { this.lastWallId = this.curWall?.id ?? -1; this.curWall = null; this.mode = 'air'; this.vy = -2; this.rollQueue = this.now; }
        else if (this.mode === 'zip') { this.curZip = null; this.trolley.visible = false; this.mode = 'air'; this.vy = -3; this.jumps = 1; }
        break;
      case 'left': case 'right': {
        const d = i === 'right' ? 1 : -1;
        if (this.mode === 'wall' && this.curWall) {
          if (d === -this.curWall.side) this.input('jump');
          return;
        }
        if (this.mode === 'zip' || this.mode === 'swing' || this.mode === 'ledge') return;
        const nl = Math.max(-1, Math.min(1, this.lane + d));
        if (nl !== this.lane) { this.lane = nl; audio.play('tick'); }
        else if (this.mode === 'air') this.wallPush = 0.4 * d; // try wall even if already in lane
        break;
      }
      case 'tap': this.tapQueue = this.now; break;
      case 'dash':
        if (this.dashCd <= 0) {
          this.dashT = 0.42; this.dashCd = 1.1; this.fovKick = 1; this.shake = Math.max(this.shake, 0.25);
          if (this.mode === 'air') this.vy = Math.max(this.vy, 2);
          this.addStat('dashes'); audio.play('dash'); haptic(18);
        }
        break;
    }
  }
  private flip = 0;
  private wallPush = 0;

  // ------------------------------------------------ loop
  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const real = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (!this.paused) this.step(real);
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  };

  private step(real: number) {
    if (this.slowMoT > 0) this.slowMoT -= real;
    const dt = real * (this.slowMoT > 0 ? 0.35 : 1);
    this.now += dt;
    const c = this.course;

    if (this.mode === 'intro') {
      this.introT += real;
      if (this.introT > 1.2) { this.mode = 'ground'; audio.play('dash'); }
    } else if (this.mode !== 'dead' && this.mode !== 'finish') {
      this.time += dt;
      this.physics(dt);
    } else if (this.mode === 'dead') {
      this.deathT += real;
      if (this.deathKind === 'fall') { this.vy -= G * dt; this.py += this.vy * dt; this.pz += 3 * dt; }
      if (this.deathT > 1.0 && !this.deathReported) {
        this.deathReported = true;
        const tut = c.level === 0 && !c.endless;
        this.cb.onDeath(tut || !this.revived);
      }
    } else if (this.mode === 'finish') {
      this.finishT += real;
      this.pz += Math.max(0, 6 - this.finishT * 6) * dt;
      if (this.finishT > 0.1 && Math.random() < 0.6) this.particles.emit(this.px + (Math.random() - 0.5) * 6, this.py + 5, this.pz + 2, 3, '#fff', { hueShift: true, speed: 2, up: 0.5, grav: 3, life: 1.6, size: 0.3 });
      if (this.finishT > 2.4 && !this.ended) { this.ended = true; this.cb.onEnd(this.result(true)); }
    }

    // endless extension + pruning
    if (c.endless) {
      this.builder.extendTo(this.pz + VIEW + 40);
      if (Math.floor(this.now * 2) % 6 === 0) {
        const cut = this.pz - 40;
        c.plats = c.plats.filter((p) => p.z1 > cut); c.obst = c.obst.filter((p) => p.z > cut); c.walls = c.walls.filter((p) => p.z1 > cut);
        c.zips = c.zips.filter((p) => p.z1 > cut); c.swings = c.swings.filter((p) => p.z > cut); c.springs = c.springs.filter((p) => p.z > cut); c.picks = c.picks.filter((p) => p.z > cut);
      }
    }

    // timers
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    (Object.keys(this.powers) as PowerKind[]).forEach((k) => { if (this.powers[k] > 0) this.powers[k] = Math.max(0, this.powers[k] - dt); });

    this.syncObjects();
    this.updateRunnerVisual(dt, real);
    this.updateCamera(real);
    this.env.update(this.pz, this.mode === 'dead' ? this.lastGroundY : this.py, this.camera.position, real);
    this.particles.update(dt);
    this.speedLines.update(this.camera.position.x, this.camera.position.y - 2, this.camera.position.z, this.speedBase, this.dashT > 0 ? 0.7 : this.speedBase > 17 ? 0.25 : 0, real);

    this.hudT -= real;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.cb.onHud({
        coins: this.coins, gems: this.gems, distance: this.pz, progress: c.endless ? 0 : Math.min(1, this.pz / c.finishZ), combo: this.combo, comboT: this.comboT,
        time: this.time, tokens: [...this.tokens], powers: { ...this.powers }, score: this.score + Math.floor(this.pz) * 10, speed: this.speedBase,
      });
    }
  }

  private physics(dt: number) {
    const c = this.course;
    const speed = this.speedBase;
    const prevZ = this.pz;
    const prevY = this.py;
    // timers
    this.dashT -= dt; this.dashCd -= dt; this.slideT -= dt; this.rollT -= dt; this.vaultT -= dt; this.invulnT -= dt; this.stumbleT -= dt;
    this.jumpBuffer -= dt; this.coyote -= dt; this.swingBoost -= dt; this.springT -= dt; this.wallPush *= 0.9;
    if (Math.abs(this.wallPush) < 0.02) this.wallPush = 0;

    // lateral
    if (this.mode !== 'wall' && this.mode !== 'zip' && this.mode !== 'swing') {
      const tx = laneX(this.lane);
      const d = tx - this.px;
      const step = 16 * dt;
      this.px += Math.abs(d) < step ? d : Math.sign(d) * step;
    }

    switch (this.mode) {
      case 'ground': {
        this.pz += speed * dt;
        const g = this.groundAt(this.px, this.pz, this.py + 0.05);
        if (g && g.y >= this.py - 0.5) {
          this.py = g.y; this.groundPlat = g.p; this.lastGroundY = g.y;
          if (g.p.kind === 'crumble' && g.p.fallAt == null) { g.p.fallAt = this.now + 0.3; }
          if (g.p.kind === 'solid' && g.p.w >= FULL_W - 0.1 && this.nearestObstacleAhead() > 16) this.lastSafe = { z: this.pz, y: g.y };
          if (this.jumpBuffer > 0) { this.jumpBuffer = 0; this.input('jump'); }
          this.checkSprings();
          this.checkVault();
        } else {
          this.mode = 'air'; this.vy = 0; this.coyote = 0.12; this.jumps = 0; this.airTime = 0; this.groundPlat = null;
        }
        break;
      }
      case 'air': {
        this.pz += speed * dt;
        this.airTime += dt;
        this.vy -= G * dt;
        this.py += this.vy * dt;
        if (this.jumps === 2) this.flip = Math.min(1, this.flip + dt * 2.4);
        if (this.vy <= 0) {
          const g = this.groundAt(this.px, this.pz, prevY);
          if (g && this.py <= g.y) { this.land(g.y, g.p); break; }
        }
        this.checkWallAttach();
        this.checkSwingAttach();
        if (this.py < this.lastGroundY - 9) this.die('fall');
        break;
      }
      case 'wall': {
        const w = this.curWall!;
        this.pz += speed * 1.05 * dt;
        const wx = -w.side * (LW + 0.55);
        this.px += (wx - this.px) * Math.min(1, dt * 14);
        this.vy -= 7 * dt;
        this.py += this.vy * dt;
        this.py = Math.max(this.py, w.y0 + 1);
        if (Math.random() < 0.5) this.particles.emit(this.px - w.side * 0.4, this.py + 0.1, this.pz, 1, '#ffffff', { speed: 1, life: 0.3, size: 0.15, grav: 0 });
        if (this.pz > w.z1) { this.lastWallId = w.id; this.curWall = null; this.mode = 'air'; this.vy = 7; this.jumps = 1; this.lane = w.side; }
        else {
          const g = this.groundAt(this.px, this.pz, prevY);
          if (g && this.py <= g.y + 0.05 && this.vy <= 0) { this.curWall = null; this.land(g.y, g.p); }
        }
        break;
      }
      case 'zip': {
        const z = this.curZip!;
        this.pz += speed * 1.15 * dt;
        const t = Math.min(1, (this.pz - z.z0) / (z.z1 - z.z0));
        const cy = z.y0 + (z.y1 - z.y0) * t;
        this.px += (z.x - this.px) * Math.min(1, dt * 10);
        this.py += (cy - 2.05 - this.py) * Math.min(1, dt * 12);
        this.trolley.position.set(this.px, cy + 0.05, this.pz);
        if (Math.random() < 0.6) this.particles.emit(this.px, cy, this.pz, 1, '#ffd24a', { speed: 2, up: 0.5, life: 0.3, size: 0.12, grav: 10 });
        if (t >= 1) { this.curZip = null; this.trolley.visible = false; this.mode = 'air'; this.vy = 4; this.jumps = 1; this.lastGroundY = z.y1 - 3; }
        break;
      }
      case 'swing': {
        const s = this.curSwing!;
        this.swingT += dt;
        const a = this.swingA0 + this.swingT * 3.6;
        this.px += (0 - this.px) * Math.min(1, dt * 10);
        this.pz = Math.max(this.pz, s.z + 2.0 * Math.sin(a));
        this.py = s.y - 2.0 * Math.cos(a) - 0.05;
        if (a >= 1.35) this.releaseSwing();
        break;
      }
      case 'ledge': {
        this.ledgeT += dt;
        const k = Math.min(1, this.ledgeT / 0.3);
        this.py = this.ledgeFrom + (this.ledgeTo - this.ledgeFrom) * (1 - Math.pow(1 - k, 2));
        this.pz += speed * 0.35 * dt;
        if (k >= 1) { this.mode = 'ground'; this.py = this.ledgeTo; this.jumps = 0; }
        break;
      }
    }

    // front face collision (ledge grab / crash)
    if (this.mode === 'ground' || this.mode === 'air' || this.mode === 'wall') {
      const f0 = prevZ + 0.3, f1 = this.pz + 0.3;
      for (const p of this.near(c.plats, 1, 3)) {
        if (p.z0 <= f0 - 0.01 || p.z0 > f1) continue;
        const off = this.platOffset(p);
        if (Math.abs(this.px - (p.x + off.x)) > p.w / 2 + 0.1) continue;
        const top = p.y + off.y - (p.drop || 0);
        const diff = top - this.py;
        if (diff <= 0.4) continue;
        if (diff < 2.5) {
          this.mode = 'ledge'; this.ledgeT = 0; this.ledgeFrom = this.py; this.ledgeTo = top; this.vy = 0; this.curWall = null; this.pz = p.z0 + 0.05;
          this.addStat('ledgeGrabs'); this.trick('LEDGE CLIMB', '#2EE6A6'); audio.play('wall'); haptic(10);
        } else if (this.mode !== 'wall') {
          this.pz = p.z0 - 0.35; this.die('hit');
        }
        break;
      }
    }

    // zip attach (any lane)
    if (this.mode === 'ground' || this.mode === 'air') {
      for (const z of this.near(c.zips, 1, 1)) {
        if (this.pz < z.z0 || this.pz > z.z0 + 5) continue;
        const t = (this.pz - z.z0) / (z.z1 - z.z0);
        const cy = z.y0 + (z.y1 - z.y0) * t;
        if (Math.abs(this.py + 2.05 - cy) < 1.4) {
          this.mode = 'zip'; this.curZip = z; this.trolley.visible = true; this.slideT = 0;
          this.addStat('ziplines'); this.trick('ZIP LINE', '#FFB800'); audio.play('power'); haptic(10);
          break;
        }
      }
    }

    this.checkObstacles();
    this.checkPicks(dt);

    // checkpoints / hints / finish
    if (this.cpIdx < c.checkpoints.length && this.pz >= c.checkpoints[this.cpIdx]) {
      this.cpIdx++;
      this.cb.onPopup('CHECKPOINT', '#2EE6A6', true); audio.play('claim');
      this.cpObjs.forEach((o) => { if (Math.abs(o.position.z - c.checkpoints[this.cpIdx - 1]) < 1) ((o.userData.flag as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5; });
      this.particles.emit(0, this.py + 1, this.pz + 3, 40, this.world.accent, { speed: 5, up: 1.2, life: 1, size: 0.3 });
    }
    while (this.hintIdx < c.hints.length && this.pz >= c.hints[this.hintIdx].z) { this.cb.onHint(c.hints[this.hintIdx].text); this.hintIdx++; }
    if (!c.endless && this.pz >= c.finishZ && (this.mode === 'ground' || this.mode === 'air')) this.finish();
  }

  private nearestObstacleAhead() {
    let m = 999;
    for (const o of this.course.obst) { const d = o.z - this.pz; if (d > -2 && d < m) m = d; }
    return m;
  }

  private land(y: number, p: Plat) {
    const impact = -this.vy;
    this.py = y; this.vy = 0; this.mode = 'ground'; this.groundPlat = p; this.lastGroundY = y;
    const wasAir = this.airTime;
    this.jumps = 0; this.airTime = 0; this.flip = 0;
    const lc = LANDING_COLORS[this.landingStyle] || LANDING_COLORS.dust;
    const perfect = this.now - this.rollQueue < 0.4 && wasAir > 0.4;
    if (perfect) {
      this.rollT = 0.45; this.addStat('perfectRolls'); this.trick('PERFECT ROLL', '#FFB800', true); haptic([10, 20, 10]);
    } else if (impact > 18) {
      this.rollT = 0.45; this.stumbleT = 0.25; audio.play('land'); haptic(25);
    } else if (impact > 4) { audio.play('land'); haptic(8); }
    const n = impact > 12 ? 22 : 10;
    for (let i = 0; i < 2; i++) this.particles.emit(this.px, y + 0.1, this.pz, n / 2, lc[i % lc.length], { speed: this.landingStyle === 'shock' ? 7 : 3.5, up: 0.6, life: 0.6, size: 0.3, grav: this.landingStyle === 'petals' ? 1 : 6 });
    if (this.jumpBuffer > 0) { this.jumpBuffer = 0; this.input('jump'); }
  }

  private checkSprings() {
    for (const s of this.near(this.course.springs, 1, 1)) {
      if (Math.abs(this.pz - s.z) < 1.0 && Math.abs(this.px - s.x) < 1.2 && Math.abs(this.py - s.y) < 0.3) {
        this.vy = 21 * (this.powers.superjump > 0 ? 1.12 : 1); this.mode = 'air'; this.jumps = 1; this.airTime = 0; this.springT = 0.6;
        this.addStat('springs'); this.trick('SPRING LAUNCH', '#2EE6A6'); audio.play('spring'); haptic(15);
        const o = this.objs.get(s.id); if (o) o.userData.squash = 1;
        this.particles.emit(s.x, s.y + 0.3, s.z, 16, '#2ee6a6', { speed: 4, up: 1, life: 0.5, size: 0.25 });
        return;
      }
    }
  }

  private checkVault() {
    if (this.vaultT > 0 || this.slideT > 0) return;
    for (const o of this.near(this.course.obst, 0, 6)) {
      if (o.type !== 'wall' || o.dead) continue;
      if (Math.abs(this.px - o.x) > o.w / 2 + 0.2) continue;
      const d = o.z - this.pz;
      if (d > 0 && d < 3.2 && this.now - this.tapQueue < 0.6) {
        this.vaultT = 0.42; this.tapQueue = -9;
        o.dead = true; // passable
        this.addStat('vaults');
        this.trick(d < 1.8 ? 'PERFECT VAULT' : 'VAULT', '#00F0FF', d < 1.8);
        audio.play('wall'); haptic(10);
        return;
      }
    }
  }

  private checkWallAttach() {
    for (const w of this.near(this.course.walls, 1, 1)) {
      if (w.id === this.lastWallId) continue;
      if (this.pz < w.z0 || this.pz > w.z1 - 1.5) continue;
      const pushing = this.wallPush !== 0 && Math.sign(this.wallPush) === w.side;
      if (this.lane !== w.side && !pushing) continue;
      if (this.py < w.y0 - 1 || this.py > w.y1 - 1.2) continue;
      this.lane = w.side; this.mode = 'wall'; this.curWall = w; this.vy = Math.max(2.5, Math.min(this.vy, 4)); this.jumps = 1;
      this.addStat('wallRuns'); this.trick('WALL RUN', '#B45CFF'); audio.play('wall'); haptic(10);
      return;
    }
  }

  private checkSwingAttach() {
    for (const s of this.near(this.course.swings, 2, 2)) {
      if (Math.abs(this.pz - s.z) > 1.3) continue;
      if (Math.abs(this.py + 2 - s.y) > 1.5) continue;
      this.mode = 'swing'; this.curSwing = s; this.swingT = 0; this.vy = 0;
      this.swingA0 = Math.asin(Math.max(-0.9, Math.min(0.9, (this.pz - s.z) / 2)));
      this.addStat('swings'); this.trick('BAR SWING', '#FF2E9E'); audio.play('wall'); haptic(10);
      return;
    }
  }
  private releaseSwing() {
    this.curSwing = null; this.mode = 'air'; this.vy = 10; this.jumps = 1; this.swingBoost = 1.0; this.airTime = 0.5;
    audio.play('jump');
  }

  private playerBox() {
    const low = this.slideT > 0 || this.rollT > 0;
    const h = low ? 0.8 : this.mode === 'zip' || this.mode === 'swing' ? 2.3 : 1.7;
    return { y0: this.py + (this.vaultT > 0 ? 0.9 : 0), y1: this.py + h };
  }

  private checkObstacles() {
    const b = this.playerBox();
    for (const o of this.near(this.course.obst, 1, 2)) {
      if (o.dead) continue;
      let ox = o.x;
      if (o.mx) ox += o.mx * Math.sin(this.now * (o.ms || 1) + (o.mp || 0));
      const depth = o.type === 'wall' ? 0.35 : o.type === 'drone' ? 0.55 : 0.2;
      if (Math.abs(this.pz - o.z) > depth + 0.3) continue;
      const half = o.type === 'drone' ? 0.6 : o.w / 2;
      if (Math.abs(this.px - ox) > half + 0.35) continue;
      const [a0, a1] = o.type === 'wall' ? [0, 1.0] : o.type === 'bar' ? [1.05, 1.5] : o.type === 'laserLow' ? [0.2, 0.55] : o.type === 'laserHigh' ? [1.0, 1.35] : o.type === 'laserV' ? [0, 3.2] : [0.85, 1.65];
      if (b.y1 < o.y + a0 || b.y0 > o.y + a1) continue;
      this.hit(o);
      if (this.mode === 'dead') return;
    }
  }

  private hit(o: Obst) {
    if (this.invulnT > 0) return;
    if (o.type === 'drone' && this.dashT > 0) {
      o.dead = true; this.addStat('dronesSmashed'); this.trick('DRONE SMASH', '#FF4D4D', true);
      this.particles.emit(o.x, o.y + 1.2, o.z, 30, '#ff7a1a', { speed: 6, up: 1, life: 0.7, size: 0.35 });
      this.shake = 0.5; audio.play('hit'); haptic(30);
      return;
    }
    if (this.powers.shield > 0) {
      this.powers.shield = 0; o.dead = true; this.invulnT = 1.2;
      this.cb.onPopup('SHIELD SAVED YOU', '#3B9CFF', true); audio.play('power'); haptic(30); this.shake = 0.4;
      this.particles.emit(this.px, this.py + 1, this.pz, 30, '#3b9cff', { speed: 6, up: 0.8, life: 0.6, size: 0.3, grav: 0 });
      return;
    }
    this.die('hit');
  }

  private die(kind: 'fall' | 'hit') {
    if (this.mode === 'dead') return;
    this.mode = 'dead'; this.deathKind = kind; this.deathT = 0; this.deathReported = false; this.deaths++;
    this.breakCombo();
    this.curWall = null; this.curZip = null; this.curSwing = null; this.trolley.visible = false;
    if (kind === 'hit') { this.vy = 0; this.shake = 0.8; audio.play('hit'); haptic([60, 40, 90]); this.particles.emit(this.px, this.py + 1, this.pz, 30, '#ff4d6d', { speed: 5, up: 1, life: 0.6, size: 0.3 }); }
    else { audio.play('fail'); haptic([30, 30, 30]); }
    this.slowMoT = 0.6;
  }

  revive() {
    const safe = this.lastSafe;
    this.pz = safe.z; this.py = safe.y; this.lastGroundY = safe.y; this.vy = 0; this.mode = 'ground'; this.lane = 0; this.px = 0;
    this.invulnT = 2.5; this.slideT = 0; this.rollT = 0; this.dashT = 0; this.stumbleT = 0;
    const tut = this.course.level === 0 && !this.course.endless;
    if (!tut) this.revived = true;
    for (const o of this.course.obst) if (o.z > safe.z && o.z < safe.z + 22) o.dead = true;
    for (const p of this.course.plats) if (p.kind === 'crumble' && p.z0 > safe.z - 5 && p.z0 < safe.z + 80) { p.fallAt = undefined; p.drop = 0; }
    this.cb.onPopup('REVIVED', '#2EE6A6', true);
    audio.play('power');
    this.particles.emit(this.px, this.py + 1, this.pz, 40, '#2ee6a6', { speed: 5, up: 1, life: 0.8, size: 0.3 });
  }

  giveUp() { if (!this.ended) { this.ended = true; this.cb.onEnd(this.result(false)); } }

  private finish() {
    this.mode = 'finish'; this.finishT = 0; this.vy = 0;
    audio.play('win'); haptic([20, 40, 20, 40, 60]);
    this.slowMoT = 0.5;
    for (let i = 0; i < 4; i++) this.particles.emit(this.px + (i - 1.5) * 2, this.py + 4, this.pz + 2, 40, '#fff', { hueShift: true, speed: 6, up: 1.5, life: 1.8, size: 0.35, grav: 5 });
  }

  private result(completed: boolean): RunResult {
    const c = this.course;
    const tut = c.level === 0 && !c.endless;
    const timeOk = this.time <= c.par;
    const coinOk = c.coinTotal > 0 ? this.coins >= c.coinTotal * 0.55 : true;
    const noFall = this.deaths === 0;
    const flags: [boolean, boolean, boolean] = [completed && timeOk, completed && coinOk, completed && noFall];
    const stars = completed ? Math.max(1, flags.filter(Boolean).length) : 0;
    const distance = Math.floor(Math.min(this.pz, c.endless ? this.pz : c.finishZ));
    const stats = { ...this.stats, coins: this.coins, distance, bestCombo: this.bestCombo, tokens: this.tokens.filter(Boolean).length };
    const xp = Math.round(distance / 6 + stars * 60 + this.bestCombo * 6 + (completed ? 80 : 0));
    return {
      mode: tut ? 'tutorial' : c.endless ? 'endless' : 'level', level: c.level, completed, stars, starFlags: flags, time: this.time, par: c.par,
      coins: this.coins, coinTotal: c.coinTotal, gems: this.gems, tokens: [...this.tokens], distance, bestCombo: this.bestCombo,
      score: this.score + distance * 10, deaths: this.deaths, stats, xp,
    };
  }

  // ------------------------------------------------ pickups
  private checkPicks(dt: number) {
    const cx = this.px, cy = this.py + 0.9, cz = this.pz;
    const mag = this.powers.magnet > 0;
    for (const p of this.near(this.course.picks, 2, mag ? 10 : 2)) {
      if (p.taken) continue;
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (mag && p.type === 'coin' && d2 < 64) {
        const k = Math.min(1, dt * 14);
        p.x -= dx * k; p.y -= dy * k; p.z -= dz * k * 0.5;
      }
      if (d2 < 1.4) this.collect(p);
    }
  }
  private collect(p: Pick) {
    p.taken = true;
    const obj = this.objs.get(p.id); if (obj) { obj.removeFromParent(); this.objs.delete(p.id); }
    switch (p.type) {
      case 'coin': {
        const v = this.powers.double > 0 ? 2 : 1;
        this.coins += v; this.score += 10 * v; audio.play('coin');
        if (this.coins % 10 === 0) haptic(5);
        this.particles.emit(p.x, p.y, p.z, 5, '#ffd24a', { speed: 2, up: 1, life: 0.35, size: 0.18, grav: 0 });
        break;
      }
      case 'gem': this.gems += 1; this.score += 250; audio.play('gem'); haptic(12); this.cb.onPopup('+1 GEM', '#FF2E9E'); this.particles.emit(p.x, p.y, p.z, 16, '#ff2e9e', { speed: 3, life: 0.5, size: 0.25, grav: 0 }); break;
      case 'token':
        this.tokens[p.token ?? 0] = true; this.score += 1000; audio.play('token'); haptic([15, 30, 15]);
        this.cb.onPopup('GOLDEN TOKEN', '#FFB800', true); this.slowMoT = 0.3;
        this.particles.emit(p.x, p.y, p.z, 40, '#ffd84a', { speed: 5, up: 1, life: 0.9, size: 0.3 });
        break;
      default: {
        const k = p.type as PowerKind;
        this.powers[k] = POWER_DUR[k]; this.addStat('powerups'); audio.play('power'); haptic(15);
        const names: Record<PowerKind, string> = { magnet: 'MAGNET', shield: 'SHIELD', slowmo: 'SLOW-MO', double: 'DOUBLE COINS', superjump: 'SUPER JUMP' };
        this.cb.onPopup(names[k], POWER_COLOR[k], true);
        this.particles.emit(p.x, p.y, p.z, 30, POWER_COLOR[k], { speed: 4, life: 0.7, size: 0.3, grav: 0 });
      }
    }
  }

  // ------------------------------------------------ course objects
  private syncObjects() {
    const c = this.course;
    const z0 = this.pz - 25, z1 = this.pz + VIEW;
    const want = new Set<number>();
    const consider = (id: number, a: number, b: number, make: () => THREE.Object3D | null) => {
      if (b < z0 || a > z1) return;
      want.add(id);
      if (!this.objs.has(id)) { const o = make(); if (o) { this.scene.add(o); this.objs.set(id, o); } }
    };
    for (const p of c.plats) consider(p.id, p.z0, p.z1, () => this.makePlat(p));
    for (const o of c.obst) if (!o.dead || o.type === 'wall') consider(o.id, o.z, o.z, () => this.makeObst(o));
    for (const w of c.walls) consider(w.id, w.z0, w.z1, () => this.makeWall(w));
    for (const z of c.zips) consider(z.id, z.z0, z.z1, () => this.makeZip(z));
    for (const s of c.swings) consider(s.id, s.z, s.z, () => this.makeSwing(s));
    for (const s of c.springs) consider(s.id, s.z, s.z, () => this.makeSpring(s));
    for (const p of c.picks) if (!p.taken && p.type !== 'coin') consider(p.id, p.z, p.z, () => this.makePick(p));
    for (const [id, o] of this.objs) if (!want.has(id)) {
      o.removeFromParent();
      o.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh && mm.userData.ownGeo) mm.geometry.dispose(); });
      this.objs.delete(id);
    }
    // animate
    const t = this.now;
    for (const p of c.plats) {
      const o = this.objs.get(p.id); if (!o) continue;
      if (p.kind === 'moving') { const off = this.platOffset(p); o.position.set(p.x + off.x, p.y + off.y, 0); }
      if (p.kind === 'crumble' && p.fallAt != null) {
        const since = this.now - p.fallAt;
        if (since > 0) { p.drop = since * since * 12; }
        o.position.set(p.x + (since < 0 ? Math.sin(t * 60) * 0.05 : 0), p.y - (p.drop || 0), 0);
        if (since > 3) o.visible = false;
      }
    }
    for (const ob of c.obst) {
      const o = this.objs.get(ob.id); if (!o) continue;
      if (ob.type === 'drone') {
        if (ob.dead) { o.visible = false; continue; }
        const ox = ob.x + (ob.mx ? ob.mx * Math.sin(t * (ob.ms || 1) + (ob.mp || 0)) : 0);
        o.position.set(ox, ob.y + 1.25 + Math.sin(t * 4 + ob.id) * 0.1, ob.z);
        o.children.forEach((ch) => { if (ch.userData.rotor) ch.rotation.y += 0.9; });
      }
      if (ob.type.startsWith('laser')) {
        o.children.forEach((ch) => { if (ch.userData.beam) ((ch as THREE.Mesh).scale.x = (ch as THREE.Mesh).scale.z = 0.8 + Math.sin(t * 40 + ob.id) * 0.2); });
      }
    }
    for (const s of c.springs) {
      const o = this.objs.get(s.id); if (!o) continue;
      const sq = (o.userData.squash || 0) as number;
      const top = o.children[1];
      if (top) top.position.y = 0.35 - Math.sin(sq * Math.PI) * 0.2;
      o.userData.squash = Math.max(0, sq - 0.05);
    }
    for (const p of c.picks) {
      if (p.taken || p.type === 'coin') continue;
      const o = this.objs.get(p.id); if (!o) continue;
      o.rotation.y = t * 2.5; o.position.y = p.y + Math.sin(t * 3 + p.id) * 0.15;
    }
    if (this.mats.conveyor) { const m = (this.mats.conveyor as THREE.MeshStandardMaterial).map!; m.offset.y -= 0.02; }
    // coins
    let n = 0;
    const d = this.dummy;
    for (const p of c.picks) {
      if (p.type !== 'coin' || p.taken || p.z < z0 || p.z > z1) continue;
      if (n >= 320) break;
      d.position.set(p.x, p.y + Math.sin(t * 4 + p.z) * 0.08, p.z);
      d.rotation.set(0, t * 3 + p.z * 0.3, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.coinMesh.setMatrixAt(n++, d.matrix);
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  private boxUV(w: number, h: number, l: number, sideScale = 4) {
    const g = new THREE.BoxGeometry(w, h, l);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const faces: [number, number][] = [[l / sideScale, h / sideScale], [l / sideScale, h / sideScale], [w / 2, l / 2], [w / 2, l / 2], [w / sideScale, h / sideScale], [w / sideScale, h / sideScale]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * faces[f][0], uv.getY(i) * faces[f][1]); }
    return g;
  }

  private makePlat(p: Plat): THREE.Object3D {
    const g = new THREE.Group();
    const len = p.z1 - p.z0;
    const q = this.quality;
    const shadows = q !== 'low';
    if (p.kind === 'solid' || p.kind === 'conveyor') {
      const H = 34;
      const geo = this.boxUV(p.w, H, len);
      const topMat = p.kind === 'conveyor' ? this.mats.conveyor : this.mats.top;
      const m = new THREE.Mesh(geo, [this.mats.side, this.mats.side, topMat, this.mats.side, this.mats.side, this.mats.side]);
      m.userData.ownGeo = true;
      m.position.set(0, -H / 2, (p.z0 + p.z1) / 2);
      m.receiveShadow = shadows;
      g.add(m);
      const eg = new THREE.BoxGeometry(0.1, 0.1, len);
      [-1, 1].forEach((s) => { const e = new THREE.Mesh(eg, this.mats.edge); e.userData.ownGeo = true; e.position.set(s * (p.w / 2 - 0.02), 0.03, (p.z0 + p.z1) / 2); g.add(e); });
      if (p.kind === 'conveyor') [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, len), this.mats.metal); r.userData.ownGeo = true; r.position.set(s * (p.w / 2 + 0.1), 0.1, (p.z0 + p.z1) / 2); g.add(r); });
      if (len > 18 && q === 'high' && this.world.decor !== 'ice') {
        // rooftop details: vents & AC boxes along the edges
        for (let z = p.z0 + 4; z < p.z1 - 4; z += 9) {
          const vent = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.2), this.mats.dark); vent.userData.ownGeo = true;
          vent.position.set((p.w / 2 - 0.1) * (Math.floor(z) % 2 ? 1 : -1) * 1.08, 0.25, z); vent.castShadow = true; g.add(vent);
        }
      }
    } else if (p.kind === 'crumble') {
      const m = new THREE.Mesh(this.boxUV(p.w - 0.1, 0.5, len - 0.15), this.mats.crumble);
      m.userData.ownGeo = true; m.position.set(0, -0.25, (p.z0 + p.z1) / 2); m.receiveShadow = shadows; m.castShadow = shadows; g.add(m);
      const crack = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.7, 0.02, 0.06), this.mats.dark); crack.userData.ownGeo = true; crack.position.set(0, 0.01, (p.z0 + p.z1) / 2); crack.rotation.y = 0.5; g.add(crack);
      g.position.set(p.x, p.y, 0);
      return g;
    } else if (p.kind === 'moving') {
      const m = new THREE.Mesh(this.boxUV(p.w, 0.6, len), [this.mats.moving, this.mats.moving, this.mats.top, this.mats.moving, this.mats.moving, this.mats.moving]);
      m.userData.ownGeo = true; m.position.set(0, -0.3, (p.z0 + p.z1) / 2); m.receiveShadow = shadows; m.castShadow = shadows; g.add(m);
      const u = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.8, 0.08, len * 0.8), this.mats.under); u.userData.ownGeo = true; u.position.set(0, -0.62, (p.z0 + p.z1) / 2); g.add(u);
      [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, len), this.mats.edge); e.userData.ownGeo = true; e.position.set(s * (p.w / 2), 0.02, (p.z0 + p.z1) / 2); g.add(e); });
    }
    g.position.set(p.x, p.y, 0);
    return g;
  }

  private makeObst(o: Obst): THREE.Object3D {
    const g = new THREE.Group();
    const sh = this.quality !== 'low';
    if (o.type === 'wall') {
      const w = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.1, 1.0, 0.6), this.mats.hazard); w.userData.ownGeo = true; w.position.y = 0.5; w.castShadow = sh; g.add(w);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(o.w, 0.08, 0.7), this.mats.accent); cap.userData.ownGeo = true; cap.position.y = 1.02; g.add(cap);
      g.position.set(o.x, o.y, o.z);
    } else if (o.type === 'bar') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(o.w, 0.45, 0.3), this.mats.hazard); bar.userData.ownGeo = true; bar.position.y = 1.3; bar.castShadow = sh; g.add(bar);
      [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.55, 0.12), this.mats.metal); p.userData.ownGeo = true; p.position.set(s * (o.w / 2 - 0.1), 0.78, 0); g.add(p); });
      g.position.set(o.x, o.y, o.z);
    } else if (o.type === 'laserLow' || o.type === 'laserHigh' || o.type === 'laserV') {
      const vertical = o.type === 'laserV';
      const h = o.type === 'laserLow' ? 0.38 : 1.18;
      const len = vertical ? 3.2 : o.w;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 6), this.mats.laser); beam.userData.ownGeo = true; beam.userData.beam = true;
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 8), this.mats.laserGlow); glow.userData.ownGeo = true; glow.userData.beam = true;
      if (!vertical) { beam.rotation.z = Math.PI / 2; glow.rotation.z = Math.PI / 2; beam.position.y = h; glow.position.y = h; }
      else { beam.position.y = len / 2; glow.position.y = len / 2; }
      g.add(beam, glow);
      if (!vertical) [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, h + 0.4, 0.25), this.mats.dark); p.userData.ownGeo = true; p.position.set(s * (o.w / 2 + 0.15), (h + 0.4) / 2, 0); g.add(p); });
      else [0, 3.3].forEach((y) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 8), this.mats.dark); p.userData.ownGeo = true; p.position.y = y; g.add(p); });
      g.position.set(o.x, o.y, o.z);
    } else if (o.type === 'drone') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), this.mats.dark); body.userData.ownGeo = true; body.scale.y = 0.6; body.castShadow = sh; g.add(body);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.mats.droneEye); eye.userData.ownGeo = true; eye.position.set(0, -0.02, -0.36); g.add(eye);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), this.mats.metal); arm.userData.ownGeo = true; arm.position.set(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4); arm.rotation.y = -a; g.add(arm);
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.07), this.mats.accent2); rotor.userData.ownGeo = true; rotor.userData.rotor = true; rotor.position.set(Math.cos(a) * 0.62, 0.16, Math.sin(a) * 0.62); g.add(rotor);
      }
      g.position.set(o.x, o.y + 1.25, o.z);
    }
    return g;
  }

  private makeWall(w: WallS): THREE.Object3D {
    const len = w.z1 - w.z0, h = w.y1 - w.y0;
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.boxUV(0.4, h, len, 3), this.mats.wallrun); m.userData.ownGeo = true; m.receiveShadow = this.quality !== 'low'; g.add(m);
    [h / 2, -h / 2].forEach((y) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, len), this.mats.accent); e.userData.ownGeo = true; e.position.y = y; g.add(e); });
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, len * 0.9), this.mats.accent2); arrow.userData.ownGeo = true; arrow.position.set(0, 0.8 - h / 2 + 2, 0); g.add(arrow);
    g.position.set(-w.side * (LW + 1.2), (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2);
    return g;
  }

  private makeZip(z: Zip): THREE.Object3D {
    const g = new THREE.Group();
    const a = new THREE.Vector3(z.x, z.y0, z.z0), b = new THREE.Vector3(z.x, z.y1, z.z1);
    const len = a.distanceTo(b);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 5), this.mats.metal); cable.userData.ownGeo = true;
    cable.position.copy(a).add(b).multiplyScalar(0.5);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(cable);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 5), this.mats.accent); glow.userData.ownGeo = true; glow.position.copy(cable.position); glow.quaternion.copy(cable.quaternion); glow.scale.set(0.6, 1, 0.6); g.add(glow);
    [[a, z.y0], [b, z.y1]].forEach(([p, y]) => {
      const v = p as THREE.Vector3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.4, 6), this.mats.dark); pole.userData.ownGeo = true; pole.position.set(v.x + 1.2, (y as number) - 1.4, v.z); g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.12), this.mats.dark); arm.userData.ownGeo = true; arm.position.set(v.x + 0.6, (y as number) + 0.2, v.z); g.add(arm);
    });
    return g;
  }

  private makeSwing(s: Swing): THREE.Object3D {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, FULL_W + 1, 8), this.mats.metal); bar.userData.ownGeo = true; bar.rotation.z = Math.PI / 2; g.add(bar);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), this.mats.accent2); grip.userData.ownGeo = true; grip.rotation.z = Math.PI / 2; g.add(grip);
    [-1, 1].forEach((sd) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 30, 0.2), this.mats.dark); p.userData.ownGeo = true; p.position.set(sd * (FULL_W / 2 + 0.5), -15, 0); g.add(p); });
    g.position.set(s.x, s.y, s.z);
    return g;
  }

  private makeSpring(s: Spring): THREE.Object3D {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.2, 12), this.mats.dark); base.userData.ownGeo = true; base.position.y = 0.1; g.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12), this.mats.spring); top.userData.ownGeo = true; top.position.y = 0.35; g.add(top);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 16), this.mats.metal); coil.userData.ownGeo = true; coil.rotation.x = Math.PI / 2; coil.position.y = 0.24; g.add(coil);
    g.position.set(s.x, s.y, s.z);
    return g;
  }

  private makePick(p: Pick): THREE.Object3D {
    const g = new THREE.Group();
    if (p.type === 'gem') {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), this.mats.gem); m.userData.ownGeo = true; m.scale.y = 1.3; g.add(m);
    } else if (p.type === 'token') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), this.mats.token); m.userData.ownGeo = true; m.rotation.x = Math.PI / 2; g.add(m);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), this.mats.accent); star.userData.ownGeo = true; star.scale.z = 0.3; star.position.z = 0.08; g.add(star);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 24), this.mats.token); halo.userData.ownGeo = true; g.add(halo);
    } else {
      const color = POWER_COLOR[p.type as PowerKind];
      const inner = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 1.8, flatShading: true });
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), this.mats.bubble); bubble.userData.ownGeo = true; g.add(bubble);
      let shape: THREE.BufferGeometry;
      const t = p.type as PickType;
      if (t === 'magnet') shape = new THREE.TorusGeometry(0.22, 0.08, 6, 12, Math.PI);
      else if (t === 'shield') shape = new THREE.CylinderGeometry(0.28, 0.1, 0.4, 6);
      else if (t === 'slowmo') shape = new THREE.TorusGeometry(0.22, 0.06, 6, 16);
      else if (t === 'double') shape = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12).rotateX(Math.PI / 2);
      else shape = new THREE.ConeGeometry(0.25, 0.45, 4);
      const s = new THREE.Mesh(shape, inner); s.userData.ownGeo = true; g.add(s);
    }
    g.position.set(p.x, p.y, p.z);
    return g;
  }

  // ------------------------------------------------ visuals
  private updateRunnerVisual(dt: number, real: number) {
    let anim: Anim = 'run';
    let extra = 0;
    switch (this.mode) {
      case 'intro': anim = this.introT < 0.7 ? 'idle' : 'run'; break;
      case 'ground':
        if (this.vaultT > 0) anim = 'vault';
        else if (this.rollT > 0) { anim = 'roll'; extra = 1 - this.rollT / 0.45; }
        else if (this.slideT > 0) anim = 'slide';
        else if (this.dashT > 0) anim = 'dash';
        break;
      case 'air':
        if (this.springT > 0) anim = 'spring';
        else if (this.jumps === 2) { anim = 'double'; extra = this.flip; }
        else anim = this.vy > 1 ? 'jump' : 'fall';
        if (this.dashT > 0) anim = 'dash';
        break;
      case 'wall': anim = this.curWall && this.curWall.side < 0 ? 'wallL' : 'wallR'; break;
      case 'zip': anim = 'zip'; break;
      case 'swing': anim = 'swing'; extra = Math.sin(this.swingA0 + this.swingT * 3.6); break;
      case 'ledge': anim = 'ledge'; extra = Math.min(1, this.ledgeT / 0.3); break;
      case 'dead': anim = this.deathKind === 'hit' ? 'dead' : 'fall'; break;
      case 'finish': anim = this.finishT < 0.6 ? 'run' : 'victory'; break;
    }
    const r = this.runner;
    r.animate(anim, dt, this.mode === 'intro' ? 1 : this.speedBase / 13, extra);
    const bob = this.vaultT > 0 ? Math.sin((1 - this.vaultT / 0.42) * Math.PI) * 0.9 : 0;
    r.root.position.set(this.px, this.py + bob, this.pz);
    const lean = (laneX(this.lane) - this.px) * 0.12;
    r.root.rotation.set(0, this.mode === 'finish' && this.finishT > 0.6 ? Math.min(Math.PI, (this.finishT - 0.6) * 5) : 0, this.mode === 'ground' || this.mode === 'air' ? lean : 0);
    // blink when invulnerable
    r.root.visible = !(this.invulnT > 0 && Math.floor(this.invulnT * 12) % 2 === 0);
    this.shieldMesh.visible = this.powers.shield > 0 && this.mode !== 'dead';
    if (this.shieldMesh.visible) { this.shieldMesh.position.set(this.px, this.py + 1, this.pz); this.shieldMesh.rotation.y += real * 2; }
    // trail
    const moving = this.mode !== 'dead' && this.mode !== 'finish' && this.mode !== 'intro';
    if (moving && this.trailStyle !== 'none') {
      const cols = TRAIL_COLORS[this.trailStyle] || ['#ffffff'];
      const n = this.quality === 'low' ? 1 : 2;
      for (let i = 0; i < n; i++) {
        this.particles.emit(this.px, this.py + 0.9 + (Math.random() - 0.5) * 0.6, this.pz - 0.3, 1, cols.length ? cols[Math.floor(Math.random() * cols.length)] : '#fff', {
          speed: this.trailStyle === 'smoke' ? 0.6 : 0.3, up: this.trailStyle === 'fire' ? 1.5 : 0.3, life: this.trailStyle === 'smoke' ? 0.9 : 0.5,
          size: this.trailStyle === 'smoke' ? 0.55 : 0.28, grav: this.trailStyle === 'fire' ? -3 : 0, hueShift: this.trailStyle === 'rainbow', spread: 0.25,
        });
      }
    }
    if (this.dashT > 0 && moving) this.particles.emit(this.px, this.py + 1, this.pz - 0.5, 3, this.world.accent, { speed: 0.5, life: 0.3, size: 0.4, grav: 0, spread: 0.8 });
    if (this.mode === 'ground' && this.slideT > 0 && Math.random() < 0.7) this.particles.emit(this.px, this.py + 0.05, this.pz, 1, '#ffd08a', { speed: 1.5, up: 0.8, life: 0.3, size: 0.15 });
  }

  private updateCamera(real: number) {
    const cam = this.camera;
    const portrait = cam.aspect < 0.85;
    const baseFov = portrait ? 74 : 62;
    this.fovKick = Math.max(0, this.fovKick - real * 2);
    const targetFov = baseFov + this.fovKick * 12 + (this.speedBase - 12) * 0.4;
    cam.fov += (targetFov - cam.fov) * Math.min(1, real * 6);
    cam.updateProjectionMatrix();
    let tx: number, ty: number, tz: number, lx: number, ly: number, lz: number;
    const followY = this.mode === 'dead' && this.deathKind === 'fall' ? this.lastGroundY : this.mode === 'zip' ? this.py + 0.5 : this.py;
    if (this.mode === 'intro') {
      const k = Math.min(1, this.introT / 1.2);
      const a = (1 - k) * 2.6;
      tx = Math.sin(a) * 6; ty = this.py + 2.2 + k * 1.1; tz = this.pz - Math.cos(a) * 6 - k * 0.4;
      lx = 0; ly = this.py + 1.2; lz = this.pz + k * 7;
    } else if (this.mode === 'finish' && this.finishT > 0.6) {
      const a = Math.min(1, (this.finishT - 0.6) / 1.2);
      tx = this.px + Math.sin(a * 2.4) * 4.5; ty = this.py + 1.8; tz = this.pz + Math.cos(a * 2.4) * -4.5 + a * 8;
      lx = this.px; ly = this.py + 1.1; lz = this.pz;
    } else {
      tx = this.px * 0.55; ty = followY + (portrait ? 3.6 : 3.1); tz = this.pz - (portrait ? 6.8 : 6.2);
      lx = this.px * 0.75; ly = followY + 1.1; lz = this.pz + 8;
      if (this.mode === 'wall' && this.curWall) tx += this.curWall.side * 0.8;
    }
    const k = this.mode === 'intro' ? 1 : Math.min(1, real * 8);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * Math.min(1, real * 5);
    this.camPos.z += (tz - this.camPos.z) * (this.mode === 'finish' ? Math.min(1, real * 3) : 1);
    this.camLook.set(lx, ly, lz);
    this.shake = Math.max(0, this.shake - real * 1.6);
    const s = this.shake * this.shake * 0.6;
    cam.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z);
    if (this.mode === 'wall' && this.curWall) cam.up.set(this.curWall.side * 0.08, 1, 0).normalize(); else cam.up.set(0, 1, 0);
    cam.lookAt(this.camLook);
  }
}
