import type { SiteContent } from '../content/schema.ts';
import { escapeHtml, renderLink, renderProduct } from './product.ts';

export function renderHomePage(content: SiteContent): string {
  const productNames = new Map(content.products.map(({ id, name }) => [id, name]));
  const writingNames = new Map(content.writing.map(({ id, title }) => [id, title]));
  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="site-atmosphere" aria-hidden="true"><div class="aurora"></div><div class="grain"></div></div>
  <header class="site-header" data-site-header>
    <a class="wordmark" href="#universe" aria-label="${escapeHtml(content.person.name)} — home"><span>P</span><span class="wordmark__full">${escapeHtml(content.person.name)}</span></a>
    <button class="header-control menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-toggle>Menu</button>
    <nav class="primary-nav" aria-label="Primary navigation" data-primary-nav>${content.navigation.map(({ label, target }) => `<a href="#${escapeHtml(target)}">${escapeHtml(label)}</a>`).join('')}</nav>
    <div class="header-tools"><button class="header-control" type="button" data-motion-toggle aria-pressed="false">Reduce motion</button><button class="header-control" type="button" data-command-trigger aria-label="Open command palette">Command <kbd>⌘K</kbd></button></div>
    <a class="header-contact" href="#contact">Start a conversation</a>
  </header>
  <main id="main" tabindex="-1">
    <section class="arrival" id="universe" aria-labelledby="universe-title">
      <div class="arrival__signal" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="eyebrow">Independent product engineer · Medellín</p><h1 id="universe-title">${escapeHtml(content.person.positioning)}</h1><p class="arrival__intro">${escapeHtml(content.person.introduction)}</p>
      <div class="arrival__actions"><a class="button button--primary" href="#products">Explore the product universe</a><a class="button button--quiet" href="#contact">Contact Pavel</a></div>
      <div class="constellation-shell" aria-labelledby="constellation-title"><div class="constellation-heading"><p class="eyebrow">Live system map</p><h2 id="constellation-title">Five products. One connected practice.</h2></div>
        <ol class="constellation" data-constellation>${content.products.map((product, index) => `<li class="constellation-node constellation-node--${index + 1}" data-product="${escapeHtml(product.id)}"><a href="#product-${escapeHtml(product.id)}" aria-label="Explore ${escapeHtml(product.name)}"><span class="constellation-node__orbit" aria-hidden="true"></span><span class="constellation-node__name">${escapeHtml(product.name)}</span><span class="constellation-node__domain">${escapeHtml(product.domains.join(' · '))}</span></a></li>`).join('')}</ol>
      </div>
    </section>
    <section class="section section--products" id="products" aria-labelledby="products-title"><div class="section-heading"><p class="eyebrow">Product worlds</p><h2 id="products-title">Built where complexity becomes useful.</h2><p>Each product begins with a difficult system and ends with a decision people can understand.</p></div><div class="product-worlds">${content.products.map(renderProduct).join('')}</div></section>
    <section class="section section--proof" id="proof" aria-labelledby="proof-title">
      <div class="section-heading"><p class="eyebrow">Proof layer</p><h2 id="proof-title">Story when you want context. Evidence when you want receipts.</h2></div>
      <div class="mode-switch" role="group" aria-label="Product presentation"><button type="button" data-presentation-mode="story" aria-pressed="true">Story</button><button type="button" data-presentation-mode="evidence" aria-pressed="false">Evidence</button></div>
      <div class="proof-ledger">${content.proof.map((proof) => `<article class="proof-entry" id="proof-${escapeHtml(proof.id)}"><div class="proof-entry__meta"><time>${escapeHtml(proof.date)}</time><span>${escapeHtml(proof.auditor)}</span></div><div><h3>${escapeHtml(proof.title)}</h3><p>${escapeHtml(proof.summary)}</p><div class="proof-links">${proof.links.map((link) => renderLink(link)).join('')}</div></div></article>`).join('')}</div>
      <div class="capability-matrix" aria-labelledby="capabilities-title"><h3 id="capabilities-title">Capabilities, connected to shipped work</h3>${content.capabilities.map((capability) => `<article class="capability-card"><h4>${escapeHtml(capability.title)}</h4><p>${escapeHtml(capability.description)}</p><ul>${capability.references.map((reference) => `<li>${escapeHtml(productNames.get(reference) ?? writingNames.get(reference) ?? reference)}</li>`).join('')}</ul></article>`).join('')}</div>
    </section>
    <section class="section section--writing" id="writing" aria-labelledby="writing-title"><div class="section-heading"><p class="eyebrow">Writing as signal</p><h2 id="writing-title">Field notes from systems under pressure.</h2></div><ol class="writing-stream">${content.writing.map((entry, index) => `<li><a href="${escapeHtml(entry.url)}" target="_blank" rel="noreferrer noopener"><span class="writing-index">0${index + 1}</span><span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.relevance)}</small></span><span class="writing-meta">${escapeHtml(entry.topic)} · ${escapeHtml(entry.year)}</span></a></li>`).join('')}</ol><a class="text-link" href="/blog/">Explore the complete archive</a></section>
    <section class="section section--about" id="about" aria-labelledby="about-title"><div class="section-heading"><p class="eyebrow">About</p><h2 id="about-title">Engineering judgment built across expensive failure modes.</h2></div><div class="about-copy">${content.about.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div><ol class="experience-list">${content.about.experience.map((entry) => `<li><span>${escapeHtml(entry.years)}</span><strong>${escapeHtml(entry.role)}</strong><small>${escapeHtml(entry.organization)}</small></li>`).join('')}</ol><div class="about-signals"><div><h3>Selected clients</h3><p>${content.about.clients.map(escapeHtml).join(' · ')}</p></div><div><h3>Networks</h3><p>${content.about.networks.map(escapeHtml).join(' · ')}</p></div></div></section>
    <section class="section section--contact" id="contact" aria-labelledby="contact-title"><p class="eyebrow">Open channel</p><h2 id="contact-title">Building something difficult? Good.</h2><p>${escapeHtml(content.contact.pitch)}</p><div class="contact-actions"><button class="button button--primary" type="button" data-copy-email="${escapeHtml(content.contact.email)}">Copy ${escapeHtml(content.contact.email)}</button><a class="button button--quiet" href="mailto:${escapeHtml(content.contact.email)}">Open your mail app</a></div><nav class="contact-links" aria-label="Profile and CV links">${content.contact.links.map((link) => renderLink(link)).join('')}</nav></section>
  </main>
  <footer class="site-footer"><span>${escapeHtml(content.person.location)}</span><span>${escapeHtml(content.person.timezone)}</span><span>Links verified ${escapeHtml(content.linkVerifiedOn)}</span><span class="shipping-status"><i aria-hidden="true"></i>Shipping</span></footer>
  <dialog class="command-dialog" aria-labelledby="command-title" data-command-dialog><form method="dialog"><button class="command-close" aria-label="Close command palette">Close</button></form><p class="eyebrow">Quick navigation</p><h2 id="command-title">Navigate the portfolio</h2><label for="command-search">Search</label><input id="command-search" type="search" placeholder="Search products and sections" autocomplete="off"><div class="command-results" role="listbox" data-command-results></div></dialog>
  <div class="visually-hidden" role="status" aria-live="polite" data-live-status></div>`;
}
