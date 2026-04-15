export interface CoverConfig {
  day: number;
  title: string;
  subtitle: string;
  command: string;
  tags: Array<{ label: string; color: "ai" | "security" | "ts" | "web3" }>;
}

export const COVERS: CoverConfig[] = [
  {
    day: 1,
    title: "5 Vulnerabilities AI\\nCatches Better Than\\nStatic Analyzers",
    subtitle: "Where LLMs outperform Slither and Mythril",
    command: "$ spectr-ai --diff HEAD~1",
    tags: [
      { label: "AI", color: "ai" },
      { label: "Security", color: "security" },
      { label: "Web3", color: "web3" },
    ],
  },
  {
    day: 2,
    title: "How to Run LLMs\\nLocally with Ollama",
    subtitle: "Free, private, no API key needed",
    command: "$ ollama pull qwen2.5-coder:7b",
    tags: [
      { label: "AI", color: "ai" },
      { label: "Tutorial", color: "ts" },
    ],
  },
  {
    day: 3,
    title: "I Made a CLI That\\nTalks to Any Smart\\nContract",
    subtitle: "Natural language interface for on-chain data",
    command: "$ abilens 0xA0b8...eB48",
    tags: [
      { label: "AI", color: "ai" },
      { label: "Web3", color: "web3" },
      { label: "TypeScript", color: "ts" },
    ],
  },
  {
    day: 4,
    title: "Zod + LLMs:\\nValidating AI\\nResponses",
    subtitle: "Stop JSON.parse from crashing your app",
    command: "$ tsc --noEmit",
    tags: [
      { label: "TypeScript", color: "ts" },
      { label: "AI", color: "ai" },
    ],
  },
  {
    day: 5,
    title: "The Provider\\nPattern: Ollama in\\n50 Lines",
    subtitle: "Swap models with a flag, not a rewrite",
    command: "$ spectr-ai --model ollama:qwen2.5",
    tags: [
      { label: "TypeScript", color: "ts" },
      { label: "Design", color: "security" },
      { label: "AI", color: "ai" },
    ],
  },
  {
    day: 6,
    title: "SARIF: Connect\\nYour AI Auditor to\\nGitHub Code Scanning",
    subtitle: "Security findings in your PR checks",
    command: "$ spectr-ai --sarif contracts/",
    tags: [
      { label: "GitHub", color: "ts" },
      { label: "Security", color: "security" },
      { label: "CI", color: "web3" },
    ],
  },
  {
    day: 7,
    title: "Real-Time Progress\\nBar with SSE\\nin Next.js",
    subtitle: "Stream updates without WebSockets",
    command: "$ curl -N /api/analyze",
    tags: [
      { label: "Next.js", color: "ts" },
      { label: "React", color: "ai" },
    ],
  },
  {
    day: 8,
    title: "What Happens When\\nYou Call a Smart\\nContract?",
    subtitle: "A visual guide from RPC to EVM",
    command: "$ cast call 0xA0b8...eB48 totalSupply()",
    tags: [
      { label: "Web3", color: "web3" },
      { label: "Beginner", color: "ts" },
      { label: "Solidity", color: "ai" },
    ],
  },
  {
    day: 9,
    title: "Solidity vs Vyper:\\nSecurity Differences",
    subtitle: "Every auditor should know these",
    command: "$ spectr-ai contract.sol contract.vy",
    tags: [
      { label: "Solidity", color: "ai" },
      { label: "Security", color: "security" },
      { label: "Web3", color: "web3" },
    ],
  },
  {
    day: 10,
    title: "TypeScript Monorepo\\nwith pnpm\\nWorkspaces",
    subtitle: "From single package to multi-app repo",
    command: "$ pnpm --filter @spectr-ai/engine build",
    tags: [
      { label: "TypeScript", color: "ts" },
      { label: "pnpm", color: "ai" },
    ],
  },
  {
    day: 11,
    title: "AI Won't Replace\\nSmart Contract\\nAuditors",
    subtitle: "But auditors using AI will replace those who don't",
    command: "$ spectr-ai + human review",
    tags: [
      { label: "AI", color: "ai" },
      { label: "Security", color: "security" },
      { label: "Career", color: "web3" },
    ],
  },
  {
    day: 12,
    title: "5 Famous Hacks\\nAnalyzed with AI",
    subtitle: "The DAO, Parity, Ronin, Cream, Euler",
    command: "$ spectr-ai --json the-dao.sol",
    tags: [
      { label: "Security", color: "security" },
      { label: "AI", color: "ai" },
      { label: "Web3", color: "web3" },
    ],
  },
  {
    day: 13,
    title: "Chat Interface\\nOver Any API",
    subtitle: "The pattern behind AbiLens",
    command: "$ npx abilens",
    tags: [
      { label: "TypeScript", color: "ts" },
      { label: "AI", color: "ai" },
    ],
  },
  {
    day: 14,
    title: "RWA Tokenization\\nin 2026",
    subtitle: "What developers need to know",
    command: "$ tokenize --asset real-estate",
    tags: [
      { label: "Web3", color: "web3" },
      { label: "Fintech", color: "security" },
    ],
  },
  {
    day: 15,
    title: "2 AI Products\\nin 2 Weeks",
    subtitle: "What I learned shipping fast",
    command: "$ git log --oneline | wc -l",
    tags: [
      { label: "AI", color: "ai" },
      { label: "Career", color: "web3" },
      { label: "ShowDev", color: "ts" },
    ],
  },
];
