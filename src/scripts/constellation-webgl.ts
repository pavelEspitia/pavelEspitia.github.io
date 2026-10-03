import * as THREE from 'three';

interface StabilityOptions { warmupMs: number; windowMs: number; minimumFps: number; failedWindows: number }

export function createFrameStabilityMonitor(onUnstable: () => void, options: StabilityOptions) {
  let startedAt: number | null = null;
  let windowStartedAt: number | null = null;
  let frames = 0;
  let failures = 0;
  let reported = false;
  return {
    frame(time: number) {
      startedAt ??= time;
      if (time - startedAt < options.warmupMs || reported) return;
      windowStartedAt ??= time;
      frames += 1;
      const elapsed = time - windowStartedAt;
      if (elapsed < options.windowMs) return;
      const fps = frames / (elapsed / 1_000);
      failures = fps < options.minimumFps ? failures + 1 : 0;
      frames = 0;
      windowStartedAt = time;
      if (failures >= options.failedWindows) {
        reported = true;
        onUnstable();
      }
    },
  };
}

export interface WebGLConstellationOptions {
  root: Document;
  productIds: string[];
  onUnstable(): void;
}

export default async function createWebGLConstellation(options: WebGLConstellationOptions) {
  const shell = options.root.querySelector<HTMLElement>('.constellation-shell');
  if (!shell) throw new Error('Constellation shell is unavailable.');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.domElement.dataset.constellationWebgl = '';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  shell.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 8;
  const group = new THREE.Group();
  scene.add(group);
  const geometry = new THREE.IcosahedronGeometry(0.34, 2);
  const materials: THREE.MeshBasicMaterial[] = [];
  options.productIds.forEach((id, index) => {
    const material = new THREE.MeshBasicMaterial({ color: [0x57e6ff, 0xff6577, 0x9173ff, 0xffbe55, 0x5bf0a5][index % 5], wireframe: true, transparent: true, opacity: 0.72 });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    const angle = (index / options.productIds.length) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * 2.25, Math.sin(angle) * 1.25, 0);
    mesh.userData.productId = id;
    group.add(mesh);
  });
  let frame = 0;
  let paused = false;
  let destroyed = false;
  const stability = createFrameStabilityMonitor(options.onUnstable, { warmupMs: 2_000, windowMs: 2_000, minimumFps: 45, failedWindows: 3 });
  const render = (time: number) => {
    if (paused || destroyed) return;
    group.rotation.z += 0.0008;
    renderer.render(scene, camera);
    stability.frame(time);
    if (destroyed) return;
    frame = requestAnimationFrame(render);
  };
  const resize = () => {
    const bounds = shell.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(bounds.width, bounds.height, false);
    camera.aspect = bounds.width / Math.max(bounds.height, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(shell);
  resize();
  frame = requestAnimationFrame(render);
  return {
    focusProduct(id: string) { shell.dataset.focusProduct = id; },
    resize: (_bounds?: { width: number; height: number }) => resize(),
    pause() { paused = true; cancelAnimationFrame(frame); },
    resume() { if (!paused) return; paused = false; frame = requestAnimationFrame(render); },
    destroy() {
      destroyed = true;
      paused = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
    },
  };
}
