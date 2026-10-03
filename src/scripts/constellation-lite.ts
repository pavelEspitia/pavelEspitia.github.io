import type { MotionController } from './motion-controller';

export interface Bounds { width: number; height: number }
export interface Anchor { id: string; x: number; y: number }

export function createConstellationLayout(ids: string[], bounds: Bounds): Anchor[] {
  const width = bounds.width > 0 ? bounds.width : 800;
  const height = bounds.height > 0 ? bounds.height : 480;
  const compact = width < 640;
  return ids.map((id, index) => {
    if (compact) return { id, x: width * 0.5, y: ((index + 1) / (ids.length + 1)) * height };
    const angle = -Math.PI / 2 + (index / ids.length) * Math.PI * 2;
    return { id, x: width * 0.5 + Math.cos(angle) * width * 0.34, y: height * 0.5 + Math.sin(angle) * height * 0.34 };
  });
}

export function createLiteConstellation(root: Document, productIds: string[], _motion: MotionController) {
  const shell = root.querySelector<HTMLElement>('.constellation-shell');
  if (!shell) throw new Error('Constellation shell is unavailable.');
  const canvas = root.createElement('canvas');
  canvas.dataset.constellationCanvas = '';
  canvas.setAttribute('aria-hidden', 'true');
  shell.prepend(canvas);
  const context = canvas.getContext('2d');
  let paused = false;

  const draw = () => {
    if (!context || paused) return;
    const bounds = shell.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    const anchors = createConstellationLayout(productIds, bounds);
    context.strokeStyle = 'rgba(87, 230, 255, .18)';
    context.lineWidth = 1;
    context.beginPath();
    anchors.forEach((point, index) => {
      const next = anchors[(index + 2) % anchors.length]!;
      context.moveTo(point.x, point.y);
      context.lineTo(next.x, next.y);
    });
    context.stroke();
  };
  const focusProduct = (id: string) => { shell.dataset.focusProduct = id; };
  const pause = () => { paused = true; };
  const resume = () => { paused = false; draw(); };
  const observer = new ResizeObserver(draw);
  observer.observe(shell);
  const intersection = new IntersectionObserver(([entry]) => entry?.isIntersecting ? resume() : pause());
  intersection.observe(shell);
  const focusHandlers = [...shell.querySelectorAll<HTMLElement>('[data-product]')].map((node) => {
    const handler = () => focusProduct(node.dataset.product ?? '');
    node.addEventListener('focusin', handler);
    node.addEventListener('pointerenter', handler);
    return [node, handler] as const;
  });
  draw();
  return {
    focusProduct,
    resize: (_bounds?: Bounds) => draw(),
    pause,
    resume,
    destroy() {
      observer.disconnect();
      intersection.disconnect();
      focusHandlers.forEach(([node, handler]) => { node.removeEventListener('focusin', handler); node.removeEventListener('pointerenter', handler); });
      canvas.remove();
    },
  };
}
