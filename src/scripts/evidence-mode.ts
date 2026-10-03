type PresentationMode = 'story' | 'evidence';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function createEvidenceMode(root: ParentNode, storage: StorageLike) {
  const stored = storage.getItem('portfolio:presentation');
  let mode: PresentationMode = stored === 'evidence' ? 'evidence' : 'story';
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-presentation-mode]')];
  const status = root.querySelector<HTMLElement>('[data-live-status]');

  const project = () => {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.presentationMode === mode)));
    root.querySelectorAll<HTMLElement>('[data-product]').forEach((product) => {
      const hasEvidence = product.dataset.hasEvidence === 'true';
      product.querySelector<HTMLElement>('[data-mode-content="story"]')?.toggleAttribute('hidden', mode === 'evidence' && hasEvidence);
      product.querySelector<HTMLElement>('[data-mode-content="evidence"]')?.toggleAttribute('hidden', mode !== 'evidence');
    });
  };
  const setMode = (next: PresentationMode) => {
    mode = next;
    storage.setItem('portfolio:presentation', next);
    project();
    if (status) status.textContent = `${next === 'story' ? 'Story' : 'Evidence'} view active.`;
  };
  const handlers = buttons.map((button) => {
    const handler = () => setMode(button.dataset.presentationMode === 'evidence' ? 'evidence' : 'story');
    button.addEventListener('click', handler);
    return [button, handler] as const;
  });
  project();
  return { getMode: () => mode, setMode, destroy() { handlers.forEach(([button, handler]) => button.removeEventListener('click', handler)); } };
}
