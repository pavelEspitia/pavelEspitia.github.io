import { describe, expect, test } from 'vitest';

import { siteContent } from '../../src/content/portfolio';
import { renderHomePage } from '../../src/templates/page';

describe('semantic portfolio page', () => {
  test('renders_one_complete_semantic_main', () => {
    const html = renderHomePage(siteContent);

    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<\/main>/g)).toHaveLength(1);
    expect(html).toContain('Pavel builds extraordinary products at the intersection of AI, security, and Web3.');
  });

  test('renders_navigation_and_sections_in_narrative_order', () => {
    const html = renderHomePage(siteContent);
    const labels = ['Universe', 'Products', 'Proof', 'Writing', 'About', 'Contact'];
    const sectionIds = ['universe', 'products', 'proof', 'writing', 'about', 'contact'];

    for (const label of labels) expect(html).toContain(`>${label}</a>`);
    const positions = sectionIds.map((id) => html.indexOf(`id="${id}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  test('renders_all_products_and_story_evidence_controls', () => {
    const html = renderHomePage(siteContent);

    for (const id of ['spectr-ai', 'argus', 'argus-lens', 'scry']) {
      expect(html).toContain(`data-product="${id}"`);
    }
    expect(html).not.toContain('data-product="folio"');
    expect(html.match(/class="product-world"/g)).toHaveLength(4);
    expect(html).toContain('data-presentation-mode="story"');
    expect(html).toContain('data-presentation-mode="evidence"');
  });

  test('puts_an_animated_reactor_in_the_arrival_view', () => {
    const html = renderHomePage(siteContent);

    expect(html).toContain('data-hero-reactor');
    expect(html).toContain('Four products. One connected practice.');
  });

  test('renders_accessible_fallback_destinations', () => {
    const html = renderHomePage(siteContent);

    expect(html).toContain('class="skip-link" href="#main"');
    expect(html).toContain('href="/cv/cv.html"');
    expect(html).toContain('href="/cv/pavel-espitia-cv.pdf"');
    expect(html).toContain('href="mailto:pavel@noctis.biz"');
    expect(html).not.toContain('<div data-evidence-list></div>');
  });
});
