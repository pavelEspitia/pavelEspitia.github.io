export function enhanceContact(document: Document, navigatorLike: Pick<Navigator, 'clipboard'>) {
  const button = document.querySelector<HTMLButtonElement>('[data-copy-email]');
  const status = document.querySelector<HTMLElement>('[data-live-status]');
  if (!button || !status) return { destroy() {} };
  const copy = async () => {
    const email = button.dataset.copyEmail ?? '';
    try {
      await navigatorLike.clipboard.writeText(email);
      status.textContent = `${email} copied to clipboard.`;
    } catch {
      status.textContent = 'Copy was unavailable. Open your mail app instead.';
    }
  };
  button.addEventListener('click', copy);
  return { destroy() { button.removeEventListener('click', copy); } };
}
