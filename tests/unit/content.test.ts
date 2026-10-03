import { describe, expect, test } from 'vitest';

import { siteContent } from '../../src/content/portfolio';
import { validateSiteContent, type SiteContent } from '../../src/content/schema';
import { renderProduct } from '../../src/templates/product';

function cloneContent(): SiteContent {
  return structuredClone(siteContent);
}

describe('portfolio content validation', () => {
  test('accepts_complete_verified_content', () => {
    const result = validateSiteContent(cloneContent());

    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('rejects_duplicate_product_ids', () => {
    const content = cloneContent();
    content.products[1].id = content.products[0].id;

    const result = validateSiteContent(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Product identifiers must be unique.');
  });

  test.each(['javascript:alert(1)', '//tracker.example/collect'])('rejects_non_http_external_urls: %s', (url) => {
    const content = cloneContent();
    content.products[0].links = [{ label: 'Unsafe', url }];

    const result = validateSiteContent(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('External links must use http:, https:, or mailto:.');
    expect(result.errors.join('\n')).not.toContain(url);
  });

  test('omits_missing_optional_evidence', () => {
    const content = cloneContent();
    const product = { ...content.products[0], evidence: undefined };

    const html = renderProduct(product);

    expect(html).not.toContain('data-evidence-list');
    expect(html).not.toContain('No evidence available');
  });

  test('requires_capability_product_relationships', () => {
    const content = cloneContent();
    content.capabilities[0].references = ['missing-product'];

    const result = validateSiteContent(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Capability references must resolve to a product or writing entry.');
  });
});
