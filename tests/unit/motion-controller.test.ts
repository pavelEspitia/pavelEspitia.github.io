import { describe, expect, it, vi } from 'vitest';

import { createMotionController } from '../../src/scripts/motion-controller';

const storage = (initial?: string) => {
  let value = initial ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
  };
};

describe('createMotionController', () => {
  it('follows media by default and persists explicit choices', () => {
    const store = storage();
    const controller = createMotionController(store, { reduced: true });
    expect(controller.getPreference()).toBe('reduced');
    controller.setPreference('full');
    expect(store.setItem).toHaveBeenCalledWith('portfolio:motion', 'full');
    expect(createMotionController(store, { reduced: true }).getPreference()).toBe('full');
  });

  it('keeps an explicit reduced preference across reloads', () => {
    const store = storage('reduced');
    expect(createMotionController(store, { reduced: false }).getPreference()).toBe('reduced');
  });

  it('pauses every effect and resumes only eligible effects', () => {
    const controller = createMotionController(storage(), { reduced: false });
    const eligible = { start: vi.fn(), pause: vi.fn(), destroy: vi.fn(), eligible: () => true };
    const blocked = { start: vi.fn(), pause: vi.fn(), destroy: vi.fn(), eligible: () => false };
    controller.register(eligible);
    controller.register(blocked);
    controller.pauseAll();
    controller.resumeEligible();
    expect(eligible.pause).toHaveBeenCalledOnce();
    expect(blocked.pause).toHaveBeenCalledOnce();
    expect(eligible.start).toHaveBeenCalledOnce();
    expect(blocked.start).not.toHaveBeenCalled();
  });

  it('pauses registered effects when the document becomes hidden', () => {
    let listener = () => {};
    let hidden = false;
    const controller = createMotionController(storage(), {
      reduced: false,
      isDocumentHidden: () => hidden,
      onVisibilityChange: (next) => { listener = next; return vi.fn(); },
    });
    const effect = { start: vi.fn(), pause: vi.fn(), destroy: vi.fn() };
    controller.register(effect);
    hidden = true;
    listener();
    expect(effect.pause).toHaveBeenCalledOnce();
  });
});
