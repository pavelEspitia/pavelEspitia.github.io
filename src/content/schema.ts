export interface ExternalLink { label: string; url: string }
export interface EvidenceItem { label: string; value: string; source?: ExternalLink; verifiedOn?: string }
export interface VisualSignature { primary: string; secondary: string; glow: string }
export interface Product {
  id: string; name: string; eyebrow: string; summary: string; problem: string; response: string;
  differentiator: string; domains: string[]; status: string; visual: VisualSignature;
  image?: string; imageAlt?: string; links: ExternalLink[]; evidence?: EvidenceItem[];
}
export interface WritingEntry { id: string; title: string; url: string; topic: string; year: string; relevance: string }
export interface Capability { id: string; title: string; description: string; references: string[] }
export interface ProofCase { id: string; title: string; date: string; auditor: string; summary: string; links: ExternalLink[] }
export interface ExperienceEntry { years: string; role: string; organization: string }
export interface SiteContent {
  person: { name: string; positioning: string; introduction: string; location: string; timezone: string };
  navigation: Array<{ label: string; target: string }>;
  products: Product[]; proof: ProofCase[]; capabilities: Capability[]; writing: WritingEntry[];
  about: { paragraphs: string[]; experience: ExperienceEntry[]; clients: string[]; networks: string[] };
  contact: { email: string; pitch: string; links: ExternalLink[] };
  linkVerifiedOn: string;
}
export interface ValidationResult { valid: boolean; errors: string[] }

function hasDuplicates(values: string[]): boolean { return new Set(values).size !== values.length }
function isSafeLink(url: string): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol); } catch { return false; }
}

export function validateSiteContent(content: SiteContent): ValidationResult {
  const errors: string[] = [];
  const productIds = content.products.map(({ id }) => id);
  const writingIds = content.writing.map(({ id }) => id);
  if (hasDuplicates(productIds)) errors.push('Product identifiers must be unique.');
  if (hasDuplicates(writingIds)) errors.push('Writing identifiers must be unique.');

  const links: ExternalLink[] = [
    ...content.products.flatMap(({ links: productLinks, evidence = [] }) => [
      ...productLinks,
      ...evidence.flatMap(({ source }) => source ? [source] : []),
    ]),
    ...content.proof.flatMap(({ links: proofLinks }) => proofLinks),
    ...content.writing.map(({ title, url }) => ({ label: title, url })),
    ...content.contact.links,
    { label: 'Email', url: `mailto:${content.contact.email}` },
  ];
  if (links.some(({ url }) => !isSafeLink(url))) errors.push('External links must use http:, https:, or mailto:.');

  const references = new Set([...productIds, ...writingIds]);
  if (content.capabilities.some((item) => item.references.length === 0 || item.references.some((id) => !references.has(id)))) {
    errors.push('Capability references must resolve to a product or writing entry.');
  }
  if (content.products.some(({ id, name, summary, problem, response }) => !id || !name || !summary || !problem || !response)) {
    errors.push('Products require an identifier, name, summary, problem, and response.');
  }
  return { valid: errors.length === 0, errors };
}
