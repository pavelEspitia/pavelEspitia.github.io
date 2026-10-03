export type MotionPreference = 'full' | 'reduced';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MotionMedia {
  reduced: boolean;
  isDocumentHidden?(): boolean;
  onVisibilityChange?(listener: () => void): () => void;
}

export interface MotionEffect {
  start(): void;
  pause(): void;
  destroy(): void;
  eligible?(): boolean;
}

export interface MotionController {
  getPreference(): MotionPreference;
  setPreference(value: MotionPreference): void;
  register(effect: MotionEffect): () => void;
  pauseAll(): void;
  resumeEligible(): void;
  destroy(): void;
}

const STORAGE_KEY = 'portfolio:motion';

export function createMotionController(storage: StorageLike, media: MotionMedia): MotionController {
  const saved = storage.getItem(STORAGE_KEY);
  let preference: MotionPreference = saved === 'full' || saved === 'reduced'
    ? saved
    : media.reduced ? 'reduced' : 'full';
  const effects = new Set<MotionEffect>();

  const pauseAll = () => effects.forEach((effect) => effect.pause());
  const resumeEligible = () => {
    if (preference === 'reduced') return;
    effects.forEach((effect) => {
      if (effect.eligible?.() !== false) effect.start();
    });
  };

  const onVisibilityChange = () => {
    if (media.isDocumentHidden?.()) pauseAll();
    else resumeEligible();
  };
  const unsubscribeVisibility = media.onVisibilityChange?.(onVisibilityChange);

  return {
    getPreference: () => preference,
    setPreference(value) {
      preference = value;
      storage.setItem(STORAGE_KEY, value);
      if (value === 'reduced') pauseAll();
      else resumeEligible();
    },
    register(effect) {
      effects.add(effect);
      return () => {
        effect.destroy();
        effects.delete(effect);
      };
    },
    pauseAll,
    resumeEligible,
    destroy() {
      unsubscribeVisibility?.();
      effects.forEach((effect) => effect.destroy());
      effects.clear();
    },
  };
}
