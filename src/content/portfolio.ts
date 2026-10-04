import linkVerification from './link-verification.json' with { type: 'json' };
import type { SiteContent } from './schema.ts';
import { writingEntries } from './writing.ts';

export const siteContent: SiteContent = {
  person: {
    name: 'Pavel Espitia',
    positioning: 'Pavel builds extraordinary products at the intersection of AI, security, and Web3.',
    introduction: 'Senior product engineer turning adversarial systems, agentic software, and cryptographic infrastructure into products people can actually use.',
    location: 'Medellín, Colombia',
    timezone: 'GMT-5 · Full US overlap',
  },
  navigation: [
    { label: 'Universe', target: 'universe' }, { label: 'Products', target: 'products' },
    { label: 'Proof', target: 'proof' }, { label: 'Writing', target: 'writing' },
    { label: 'About', target: 'about' }, { label: 'Contact', target: 'contact' },
  ],
  products: [
    {
      id: 'spectr-ai', name: 'spectr-ai', eyebrow: 'AI security intelligence',
      summary: 'An AI smart-contract auditor for Solidity and Vyper.',
      problem: 'Security teams need fast, structured analysis without losing outputs inside an opaque chat transcript.',
      response: 'spectr-ai audits deployed contracts or source files and produces JSON, SARIF, and styled HTML reports.',
      differentiator: 'Runs with Claude or local Ollama models and turns findings into artifacts that fit engineering workflows.',
      domains: ['AI', 'Security', 'Web3'], status: 'Open source',
      visual: { primary: '#FFBE55', secondary: '#9173FF', glow: '255 190 85' },
      image: '/assets/spectr-ai.png', imageAlt: 'spectr-ai auditing a smart contract and presenting a structured security report.',
      links: [{ label: 'Source', url: 'https://github.com/pavelEspitia/spectr-ai' }],
      evidence: [
        { label: 'Inputs', value: 'Deployed addresses, Solidity, and Vyper source' },
        { label: 'Outputs', value: 'JSON, SARIF, and styled HTML' },
        { label: 'Model options', value: 'Claude or local Ollama models' },
      ],
    },
    {
      id: 'argus', name: 'Argus', eyebrow: 'Transaction defense',
      summary: 'An AI transaction firewall for crypto wallets.',
      problem: 'Wallet confirmations hide dangerous approvals and contract behavior behind raw transaction data.',
      response: 'Argus intercepts a signing request, decodes its behavior, and explains the risk before approval.',
      differentiator: 'Deterministic heuristics answer immediately while an LLM explains the stakes in plain language.',
      domains: ['AI', 'Security', 'Web3'], status: 'Chrome Web Store',
      visual: { primary: '#FF6577', secondary: '#FFBE55', glow: '255 101 119' },
      image: '/assets/argus.png', imageAlt: 'Argus flagging an unlimited token approval as critical before wallet signing.',
      links: [{ label: 'Chrome Web Store', url: 'https://chromewebstore.google.com/detail/argus/dbenlofanjfhpajaadgecbhgaaflccpg' }],
      evidence: [
        { label: 'Decision point', value: 'Before wallet approval' },
        { label: 'Analysis', value: 'Decoded intent, heuristics, and plain-language risk' },
      ],
    },
    {
      id: 'argus-lens', name: 'Argus Lens', eyebrow: 'Supply-chain defense',
      summary: 'A static malware scanner for repositories you are asked to run.',
      problem: 'A repository can execute hostile code during install or build before a developer reviews what it contains.',
      response: 'Argus Lens inspects repository signals such as build-time execution, lockfile evasion, and hostile git hooks without running the target.',
      differentiator: 'The detectors grew from two real supply-chain attacks and keep analysis static: nothing is cloned, installed, or executed by the scanner.',
      domains: ['Security', 'Developer tools'], status: 'Live',
      visual: { primary: '#9173FF', secondary: '#F4F7F5', glow: '145 115 255' },
      image: '/assets/argus-lens.png', imageAlt: 'Argus Lens accepting a repository URL and returning a static malware verdict.',
      links: [{ label: 'Open Argus Lens', url: 'https://lens.noctis.biz' }],
      evidence: [
        { label: 'Execution model', value: 'Static inspection; target code is not executed' },
        { label: 'Surfaces', value: 'Web, VS Code, and Chrome' },
      ],
    },
    {
      id: 'scry', name: 'Scry', eyebrow: 'Contract intelligence',
      summary: 'A conversational interface for deployed EVM contracts.',
      problem: 'Understanding a deployed contract often requires explorers, ABI hunting, and manual decoding before a useful question can be asked.',
      response: 'Scry lets people select a chain, provide a contract address, and ask questions in plain English.',
      differentiator: 'It resolves verified ABIs and can reconstruct an interface from bytecode with whatsabi when source metadata is unavailable.',
      domains: ['AI', 'Web3'], status: 'Live',
      visual: { primary: '#57E6FF', secondary: '#3F7CFF', glow: '87 230 255' },
      image: '/assets/scry.png', imageAlt: 'Scry showing a contract-address field, chain selector, and conversational analysis.',
      links: [{ label: 'Open Scry', url: 'https://scry.noctis.biz' }],
      evidence: [
        { label: 'Coverage', value: 'Six EVM chains' },
        { label: 'Unverified contracts', value: 'ABI reconstruction with whatsabi' },
      ],
    },
  ],
  proof: [
    {
      id: 'dega-ispo', title: 'DEGA ETH ISPO', date: '2024-01-17', auditor: 'STATEMIND',
      summary: 'A non-custodial Ethereum ISPO built around stETH staking and user-controlled withdrawal.',
      links: [
        { label: 'Audit report', url: 'https://github.com/statemindio/public-audits/blob/main/Dega/2024-01-17_Dega_ISPO.pdf' },
        { label: 'Source', url: 'https://github.com/DEGAorg/DEGA-ETH-ISPO' },
        { label: 'Deployment', url: 'https://etherscan.io/address/0x01ed03186D77698271AA316b0B29B99B1099465b' },
      ],
    },
    {
      id: 'dega-token', title: '$DEGA token', date: '2024', auditor: 'QuillAudits + storming0x',
      summary: 'The ERC-20 behind the DEGA ecosystem, reviewed independently by two security teams.',
      links: [
        { label: 'QuillAudits report', url: 'https://github.com/DEGAorg/ERC20/blob/main/audit/DegaTokenContractAuditReport-QuillAudits.pdf' },
        { label: 'storming0x report', url: 'https://github.com/DEGAorg/ERC20/blob/main/audit/DegaToken_Audit_Report_By_storming0x.pdf' },
        { label: 'Source', url: 'https://github.com/DEGAorg/ERC20' },
      ],
    },
    {
      id: 'dega-claim', title: 'DEGA TGE claim', date: '2024-07-20', auditor: 'storming0x',
      summary: 'Multi-chain EIP-712 token claims with replay protection across chains and contracts.',
      links: [
        { label: 'Audit report', url: 'https://github.com/DEGAorg/TGE-claim-contract/blob/main/audit/DegaToken-claim-contract-security-review_20_Jul_2024.pdf' },
        { label: 'Source', url: 'https://github.com/DEGAorg/TGE-claim-contract' },
      ],
    },
  ],
  capabilities: [
    { id: 'ai-systems', title: 'AI systems that ship', description: 'Agentic products, local and hosted models, structured outputs, and interfaces that explain rather than obscure.', references: ['spectr-ai', 'argus', 'scry', 'ai-auditor'] },
    { id: 'security-engineering', title: 'Security engineering', description: 'Threat modeling, static analysis, pre-audit hardening, and security decisions placed inside the workflow.', references: ['argus', 'argus-lens', 'spectr-ai', 'signature-replay'] },
    { id: 'web3-infrastructure', title: 'Web3 infrastructure', description: 'Smart contracts, EIP-712 flows, wallet interactions, ABI reconstruction, and multi-chain systems.', references: ['scry', 'argus', 'solidity-vyper'] },
    { id: 'product-architecture', title: 'Product architecture', description: 'Connected systems that turn complex rules into understandable, resilient product experiences.', references: ['spectr-ai', 'argus-lens', 'scry'] },
  ],
  writing: writingEntries,
  about: {
    paragraphs: [
      'Before Web3, Pavel built software for banks, airlines, energy, gaming, and healthcare—places where failure is expensive. Since 2018, his work has centered on protocols, smart-contract security, and products that make complex systems understandable.',
      'The AI thread runs through agent wallets, autonomous worlds, security tooling, medical claims, and engineering pipelines. The common discipline is the same: design the system, expose the evidence, and make the difficult thing usable.',
    ],
    experience: [
      { years: '2023 · now', role: 'Independent senior engineer', organization: 'Web3 security, AI products, and architecture' },
      { years: '2021 · 2023', role: 'Blockchain Developer', organization: 'FIWORK' },
      { years: '2019 · 2021', role: 'Senior Software Engineer', organization: 'PSL Corp · MILL5' },
      { years: '2018 · 2019', role: 'Frontend & Blockchain Developer', organization: 'Blocksize · eFIN DEX' },
      { years: '2009 · 2018', role: 'Enterprise engineering', organization: 'Banking, gaming, aviation, and energy' },
    ],
    clients: ['Wells Fargo', 'Electronic Arts', 'Inter-American Development Bank', 'Deloitte', 'Bancolombia', 'Suramericana', 'Avianca', 'Ecopetrol'],
    networks: ['Ethereum', 'BNB Chain', 'Optimism', 'Base', 'Arbitrum', 'Polygon', 'Midnight'],
  },
  contact: {
    email: 'pavel@noctis.biz',
    pitch: 'Building something difficult? Good. Bring the protocol, the adversarial workflow, or the AI product that needs to become real.',
    links: [
      { label: 'CV · Web', url: '/cv/cv.html' }, { label: 'CV · PDF', url: '/cv/pavel-espitia-cv.pdf' },
      { label: 'GitHub', url: 'https://github.com/pavelEspitia' }, { label: 'LinkedIn', url: 'https://www.linkedin.com/in/pavelespitia' },
      { label: 'Writing', url: 'https://dev.to/pavelespitia' }, { label: 'Blog', url: '/blog/' },
    ],
  },
  linkVerifiedOn: linkVerification.date,
};
