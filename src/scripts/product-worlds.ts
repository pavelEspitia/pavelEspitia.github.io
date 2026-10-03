import type { MotionController } from './motion-controller';

export function createProductWorlds(root: Document, motion: MotionController) {
  let previousFocus: HTMLElement | null = null;
  let active: HTMLElement | null = null;
  const view = root.defaultView;
  const products = [...root.querySelectorAll<HTMLElement>('.product-world[data-product]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-constellation] a[href^="#product-"]')];

  const show = (productId: string, moveFocus = true) => {
    const product = root.querySelector<HTMLElement>(`#product-${CSS.escape(productId)}`);
    if (!product) return false;
    active?.removeAttribute('data-active');
    active = product;
    active.setAttribute('data-active', '');
    root.documentElement.dataset.activeProduct = productId;
    if (moveFocus) active.focus({ preventScroll: true });
    active.scrollIntoView({ behavior: motion.getPreference() === 'reduced' ? 'auto' : 'smooth', block: 'start' });
    return true;
  };
  const hide = (restoreFocus = true) => {
    active?.removeAttribute('data-active');
    active = null;
    delete root.documentElement.dataset.activeProduct;
    if (restoreFocus) previousFocus?.focus();
  };
  const syncFromLocation = () => {
    const productId = view?.location.hash.match(/^#product-(.+)$/)?.[1];
    if (!productId || !show(productId)) hide();
  };
  const open = (productId: string) => {
    if (!root.querySelector(`#product-${CSS.escape(productId)}`)) return;
    if (view?.location.hash !== `#product-${productId}`) view?.history.pushState(null, '', `#product-${productId}`);
    show(productId);
  };
  const close = () => {
    if (view?.location.hash !== '#products') view?.history.pushState(null, '', '#products');
    hide();
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
  view?.addEventListener('popstate', syncFromLocation);
  view?.addEventListener('hashchange', syncFromLocation);
  syncFromLocation();
  return { open, close, destroy() { linkHandlers.forEach(([link, handler]) => link.removeEventListener('click', handler)); closeHandlers.forEach(([button, handler]) => button?.removeEventListener('click', handler)); view?.removeEventListener('popstate', syncFromLocation); view?.removeEventListener('hashchange', syncFromLocation); } };
}
