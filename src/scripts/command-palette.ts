export interface Destination {
  id: string;
  label: string;
  kind: 'section' | 'product' | 'writing';
}

export function rankDestinations(destinations: Destination[], query: string): Destination[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...destinations];
  return destinations
    .map((destination, order) => {
      const label = destination.label.toLocaleLowerCase();
      const exact = label === needle;
      const starts = label.startsWith(needle);
      const kind = destination.kind === 'product' ? 2 : destination.kind === 'section' ? 1 : 0;
      return { destination, order, score: exact ? 100 + kind : starts ? 50 + kind : label.includes(needle) ? 10 + kind : -1 };
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ destination }) => destination);
}

export function createCommandPalette(document: Document, destinations: Destination[]) {
  const dialog = document.querySelector<HTMLDialogElement>('[data-command-dialog]');
  const trigger = document.querySelector<HTMLButtonElement>('[data-command-trigger]');
  const input = dialog?.querySelector<HTMLInputElement>('input');
  const results = dialog?.querySelector<HTMLElement>('[data-command-results]');
  if (!dialog || !trigger || !input || !results) return { destroy() {} };

  let previousFocus: HTMLElement | null = null;
  const render = () => {
    results.replaceChildren(...rankDestinations(destinations, input.value).map((destination) => {
      const link = document.createElement('a');
      link.href = `#${destination.id}`;
      link.role = 'option';
      link.textContent = `${destination.label} ${destination.kind[0]!.toUpperCase()}${destination.kind.slice(1)}`;
      link.addEventListener('click', () => dialog.close());
      return link;
    }));
  };
  const open = () => {
    previousFocus = document.activeElement as HTMLElement;
    render();
    dialog.showModal();
    input.focus();
  };
  const close = () => dialog.close();
  const onKeydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.open ? close() : open();
    } else if (dialog.open && event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  const restore = () => previousFocus?.focus();
  trigger.addEventListener('click', open);
  input.addEventListener('input', render);
  dialog.addEventListener('close', restore);
  document.addEventListener('keydown', onKeydown);
  render();
  return { destroy() { trigger.removeEventListener('click', open); input.removeEventListener('input', render); dialog.removeEventListener('close', restore); document.removeEventListener('keydown', onKeydown); } };
}
