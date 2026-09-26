// Lightweight 3D scene for menus: runner idling on a rooftop ledge with orbiting camera + neon skyline.
import * as THREE from 'three';
import { Runner, Look, Anim } from './runner';
import { Environment, QualityLevel, getTileTexture } from './env';
import { WORLDS } from './data';
import { Particles } from './fx';

export class Preview {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
  runner: Runner;
  env: Environment | null = null;
  private raf = 0;
  private last = performance.now();
  private t = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private particles: Particles;
  anim: Anim = 'idle';
  orbit = true;
  dragYaw = 0;
  mode: 'menu' | 'locker';

  constructor(canvas: HTMLCanvasElement, look: Look, mode: 'menu' | 'locker', quality: QualityLevel) {
    this.mode = mode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', alpha: mode === 'locker' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.runner = new Runner(look);
    this.runner.root.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true; });
    this.scene.add(this.runner.root);
    this.particles = new Particles(200);
    this.scene.add(this.particles.points);

    if (mode === 'menu') {
      this.env = new Environment(this.scene, WORLDS[1], quality, 42, 0.85);
      (this.scene.fog as THREE.Fog).near = 40; (this.scene.fog as THREE.Fog).far = 220;
      const roofMat = new THREE.MeshStandardMaterial({ color: '#2a2f4a', map: getTileTexture(), roughness: 0.8, flatShading: true });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 8), roofMat);
      roof.position.set(0, -15, 1); roof.receiveShadow = true; this.scene.add(roof);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: '#00F0FF', emissive: '#00F0FF', emissiveIntensity: 2.4 }));
      edge.position.set(0, 0.17, 5); this.scene.add(edge);
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.2), new THREE.MeshStandardMaterial({ color: '#4a5070', flatShading: true }));
      ac.position.set(-2.4, 0.5, -1.5); ac.castShadow = true; this.scene.add(ac);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.15), new THREE.MeshStandardMaterial({ color: '#FF2E9E', emissive: '#FF2E9E', emissiveIntensity: 2.5 }));
      sign.position.set(2.6, 2.6, -2.5); this.scene.add(sign);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), new THREE.MeshStandardMaterial({ color: '#888' }));
      post.position.set(2.6, 1.2, -2.5); this.scene.add(post);
      const pl = new THREE.PointLight('#FF2E9E', 8, 10); pl.position.set(2.6, 2.4, -1.8); this.scene.add(pl);
      const pl2 = new THREE.PointLight('#00F0FF', 6, 8); pl2.position.set(-1, 1, 4); this.scene.add(pl2);
    } else {
      this.scene.add(new THREE.HemisphereLight('#ffffff', '#303060', 1.2));
      const key = new THREE.DirectionalLight('#ffffff', 2); key.position.set(3, 5, 4); key.castShadow = true; this.scene.add(key);
      const rim = new THREE.DirectionalLight('#00F0FF', 1.5); rim.position.set(-4, 3, -4); this.scene.add(rim);
      const rim2 = new THREE.DirectionalLight('#FF2E9E', 1.2); rim2.position.set(4, 2, -3); this.scene.add(rim2);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.18, 40), new THREE.MeshStandardMaterial({ color: '#1a1f3d', metalness: 0.6, roughness: 0.3 }));
      disc.position.y = -0.09; disc.receiveShadow = true; this.scene.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.035, 8, 60), new THREE.MeshStandardMaterial({ color: '#00F0FF', emissive: '#00F0FF', emissiveIntensity: 2.5 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement || canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  setLook(look: Look) {
    this.runner.build(look);
    this.runner.root.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true; });
    this.particles.emit(0, 1, 0, 30, '#00F0FF', { speed: 2.5, up: 1, life: 0.7, size: 0.12, grav: 0, spread: 0.6 });
  }

  playEmote() { this.anim = 'victory'; window.setTimeout(() => { this.anim = 'idle'; }, 2600); }

  resize() {
    const el = this.renderer.domElement.parentElement || this.renderer.domElement;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.runner.animate(this.anim, dt, 0.6);
    const portrait = this.camera.aspect < 0.9;
    if (this.mode === 'menu') {
      const a = this.t * 0.15;
      const r = portrait ? 7.5 : 6.2;
      const k = portrait ? 1.55 : 1;
      this.camera.position.set((3.0 + Math.sin(a) * 0.8) * k, 1.7 + Math.sin(this.t * 0.3) * 0.15 + (portrait ? 0.4 : 0), 4.2 - (2.0 + Math.cos(a) * 0.5) * k);
      this.runner.root.position.set(0, 0, 4.2);
      this.runner.root.rotation.y = 0.9;
      this.camera.lookAt(portrait ? 0 : -1.0, portrait ? 1.3 : 1.2, 5.6);
      this.env?.update(20, 0, this.camera.position, dt);
      if (Math.random() < 0.3) this.particles.emit((Math.random() - 0.5) * 10, 3 + Math.random() * 3, 3 + Math.random() * 4, 1, Math.random() < 0.5 ? '#00F0FF' : '#FF2E9E', { speed: 0.2, up: 0.2, life: 3, size: 0.08, grav: -0.1 });
    } else {
      const d = portrait ? 5.8 : 4.4;
      this.camera.fov = 36;
      this.camera.position.set(0, 1.3, d);
      this.camera.lookAt(0, 0.95, 0);
      this.camera.updateProjectionMatrix();
      if (this.orbit) this.dragYaw += dt * 0.5;
      this.runner.root.rotation.y = this.dragYaw;
    }
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
  }
}
