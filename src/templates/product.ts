import type { ExternalLink, Product } from '../content/schema.ts';

export function escapeHtml(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function renderLink(link: ExternalLink, className = ''): string {
  const attributes = /^https?:/.test(link.url) ? ' target="_blank" rel="noreferrer noopener"' : '';
  const cssClass = className ? ` class="${escapeHtml(className)}"` : '';
  return `<a${cssClass} href="${escapeHtml(link.url)}"${attributes}>${escapeHtml(link.label)}</a>`;
}

export function renderProduct(product: Product): string {
  const media = product.image && product.imageAlt
    ? `<figure class="product-world__media"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt)}" width="1920" height="1200" loading="lazy"></figure>`
    : `<div class="product-world__placeholder" aria-hidden="true"><span>${escapeHtml(product.name.slice(0, 1))}</span></div>`;
  const evidence = product.evidence?.length
    ? `<dl class="evidence-list" data-evidence-list>${product.evidence.map((item) => `
        <div class="evidence-item"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}${item.source ? ` ${renderLink(item.source, 'evidence-source')}` : ''}</dd></div>`).join('')}
      </dl>`
    : '';

  const hasEvidence = Boolean(evidence || product.links.length);
  return `
    <article class="product-world" id="product-${escapeHtml(product.id)}" tabindex="-1" data-product="${escapeHtml(product.id)}" data-has-evidence="${hasEvidence}" style="--product-primary:${escapeHtml(product.visual.primary)};--product-secondary:${escapeHtml(product.visual.secondary)};--product-glow:${escapeHtml(product.visual.glow)}">
      <button class="product-world__close" type="button" data-product-close aria-label="Close ${escapeHtml(product.name)} product world">Back to constellation</button>
      <header class="product-world__header"><p class="eyebrow">${escapeHtml(product.eyebrow)}</p><h3>${escapeHtml(product.name)}</h3><p class="product-world__summary">${escapeHtml(product.summary)}</p><div class="product-tags"><span>${escapeHtml(product.status)}</span>${product.domains.map((domain) => `<span>${escapeHtml(domain)}</span>`).join('')}</div></header>
      ${media}
      <div class="product-world__story" data-mode-content="story">
        <div><span class="detail-label">The problem</span><p>${escapeHtml(product.problem)}</p></div>
        <div><span class="detail-label">The response</span><p>${escapeHtml(product.response)}</p></div>
        <div><span class="detail-label">The difference</span><p>${escapeHtml(product.differentiator)}</p></div>
      </div>
      ${hasEvidence ? `<div class="product-world__evidence" data-mode-content="evidence">${evidence}${product.links.length ? `<div class="product-links">${product.links.map((link) => renderLink(link)).join('')}</div>` : ''}</div>` : ''}
    </article>`;
}
