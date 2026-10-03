import type { MotionController } from './motion-controller';

export function createProductWorlds(root: Document, motion: MotionController) {
  let previousFocus: HTMLElement | null = null;
  let active: HTMLElement | null = null;
  const products = [...root.querySelectorAll<HTMLElement>('.product-world[data-product]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-constellation] a[href^="#product-"]')];

  const open = (productId: string) => {
    const product = root.querySelector<HTMLElement>(`#product-${CSS.escape(productId)}`);
    if (!product) return;
    active?.removeAttribute('data-active');
    active = product;
    active.setAttribute('data-active', '');
    root.documentElement.dataset.activeProduct = productId;
    if (location.hash !== `#product-${productId}`) history.pushState(null, '', `#product-${productId}`);
    active.focus({ preventScroll: true });
    active.scrollIntoView({ behavior: motion.getPreference() === 'reduced' ? 'auto' : 'smooth', block: 'start' });
  };
  const close = () => {
    active?.removeAttribute('data-active');
    active = null;
    delete root.documentElement.dataset.activeProduct;
    history.pushState(null, '', '#products');
    previousFocus?.focus();
  };
  const linkHandlers = links.map((link) => {
    const handler = (event: Event) => { event.preventDefault(); previousFocus = link; open(link.hash.replace('#product-', '')); };
    link.addEventListener('click', handler);
    return [link, handler] as const;
  });
  const closeHandlers = products.map((product) => {
    const button = product.querySelector<HTMLButtonElement>('[data-product-close]');
    const handler = () => close();
    button?.addEventListener('click', handler);
    return [button, handler] as const;
  });
  const initial = location.hash.match(/^#product-(.+)$/)?.[1];
  if (initial) open(initial);
  return { open, close, destroy() { linkHandlers.forEach(([link, handler]) => link.removeEventListener('click', handler)); closeHandlers.forEach(([button, handler]) => button?.removeEventListener('click', handler)); } };
}
