import { selectCapabilityProfile } from './capability-profile';
import { createCommandPalette, type Destination } from './command-palette';
import { createLiteConstellation } from './constellation-lite';
import { enhanceContact } from './contact';
import { createEvidenceMode } from './evidence-mode';
import { createMotionController } from './motion-controller';
import { createNavigationController } from './navigation';
import { createProductWorlds } from './product-worlds';

export function bootstrapPortfolio(document: Document, window: Window) {
  const root = document.documentElement;
  root.classList.add('js');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const preciseQuery = window.matchMedia('(pointer: fine)');
  const canvas = document.createElement('canvas');
  const webgl = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  const memory = (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  let tier = selectCapabilityProfile({ reducedMotion: reducedQuery.matches, webgl, precisePointer: preciseQuery.matches, viewportWidth: window.innerWidth, deviceMemoryGB: memory });
  root.dataset.capabilityTier = tier;

  const motion = createMotionController(window.localStorage, {
    reduced: reducedQuery.matches,
    isDocumentHidden: () => document.hidden,
    onVisibilityChange: (listener) => { document.addEventListener('visibilitychange', listener); return () => document.removeEventListener('visibilitychange', listener); },
  });
  root.dataset.motion = motion.getPreference();
  const motionButton = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  const updateMotionLabel = () => {
    const current = motion.getPreference();
    root.dataset.motion = current;
    if (motionButton) {
      motionButton.textContent = current === 'full' ? 'Reduce motion' : 'Enable motion';
      motionButton.setAttribute('aria-pressed', String(current === 'reduced'));
    }
  };
  const toggleMotion = () => { motion.setPreference(motion.getPreference() === 'full' ? 'reduced' : 'full'); updateMotionLabel(); };
  motionButton?.addEventListener('click', toggleMotion);
  updateMotionLabel();

  const destinations: Destination[] = [
    ...[...document.querySelectorAll<HTMLElement>('main > section[id]')].map((section) => ({ id: section.id, label: section.querySelector('h1,h2')?.textContent?.trim() ?? section.id, kind: 'section' as const })),
    ...[...document.querySelectorAll<HTMLElement>('[data-product][id]')].map((product) => ({ id: product.id, label: product.querySelector('h3')?.textContent?.trim() ?? product.id, kind: 'product' as const })),
  ];
  const navigation = createNavigationController(document);
  const palette = createCommandPalette(document, destinations);
  const contact = enhanceContact(document, window.navigator);
  const evidenceMode = createEvidenceMode(document, window.localStorage);
  const productWorlds = createProductWorlds(document, motion);
  let constellation: ReturnType<typeof createLiteConstellation> | null = null;
  let unregisterConstellation: (() => void) | null = null;
  let destroyed = false;
  let downgraded = false;
  const productIds = [...document.querySelectorAll<HTMLElement>('[data-constellation] [data-product]')].map((node) => node.dataset.product ?? '').filter(Boolean);
  const registerConstellation = (controller: ReturnType<typeof createLiteConstellation>) => {
    if (destroyed) { controller.destroy(); return; }
    constellation = controller;
    unregisterConstellation = motion.register({ start: controller.resume, pause: controller.pause, destroy: controller.destroy });
  };
  const activateLite = () => {
    if (destroyed || constellation) return;
    try {
      tier = 'tier-b';
      root.dataset.capabilityTier = tier;
      registerConstellation(createLiteConstellation(document, productIds, motion));
    } catch { /* Tier C semantics remain intact. */ }
  };
  if (motion.getPreference() === 'full' && tier === 'tier-b') activateLite();
  if (motion.getPreference() === 'full' && tier === 'tier-a') {
    import('./constellation-webgl')
      .then(({ default: createWebGLConstellation }) => createWebGLConstellation({
        root: document,
        productIds,
        onUnstable() {
          if (downgraded) return;
          downgraded = true;
          unregisterConstellation?.();
          unregisterConstellation = null;
          constellation = null;
          activateLite();
        },
      }))
      .then(registerConstellation)
      .catch(() => { if (!downgraded) { downgraded = true; activateLite(); } });
  }
  return () => { destroyed = true; motionButton?.removeEventListener('click', toggleMotion); navigation.destroy(); palette.destroy(); contact.destroy(); evidenceMode.destroy(); productWorlds.destroy(); unregisterConstellation?.(); if (!unregisterConstellation) constellation?.destroy(); motion.destroy(); };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') bootstrapPortfolio(document, window);
