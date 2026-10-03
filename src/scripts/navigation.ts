export function createNavigationController(document: Document) {
  const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const nav = document.querySelector<HTMLElement>('[data-primary-nav]');
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-primary-nav] a')];
  const markActive = () => {
    const active = location.hash.slice(1) || 'universe';
    links.forEach((link) => link.toggleAttribute('aria-current', link.hash === `#${active}`));
  };
  const close = () => { menuButton?.setAttribute('aria-expanded', 'false'); nav?.removeAttribute('data-open'); };
  const toggle = () => {
    const open = menuButton?.getAttribute('aria-expanded') !== 'true';
    menuButton?.setAttribute('aria-expanded', String(open));
    nav?.toggleAttribute('data-open', open);
    if (open) links[0]?.focus();
  };
  menuButton?.addEventListener('click', toggle);
  links.forEach((link) => link.addEventListener('click', close));
  window.addEventListener('hashchange', markActive);
  markActive();
  return { destroy() { menuButton?.removeEventListener('click', toggle); links.forEach((link) => link.removeEventListener('click', close)); window.removeEventListener('hashchange', markActive); } };
}
