SARIF: The Format That Connects Your AI Auditor to GitHub Code Scanning

You've built a tool that finds security issues. Maybe it's an AI auditor like spectr-ai, maybe it's a custom linter, maybe it's a script that checks for hardcoded secrets. The tool works great locally. But how do you get those findings into GitHub so they show up as annotations on pull requests, in the Security tab, and in code scanning alerts?

The answer is SARIF — Static Analysis Results Interchange Format. It's a JSON-based standard for representing static analysis results, and GitHub Code Scanning speaks it natively.

## What SARIF Looks Like

At its core, a SARIF file describes which tool ran, what rules it checked, and what results it found. Here's the minimal structure:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "spectr-ai",
          "version": "1.0.0",
          "rules": []
        }
      },
      "results": []
    }
  ]
}
```

A SARIF file has one or more "runs." Each run has a tool (with its rules) and results (the findings). GitHub processes each run and creates code scanning alerts from the results.

## Mapping Severity to SARIF Levels

SARIF uses three severity levels: `error`, `warning`, and `note`. Most security tools use more granular severities. You need a mapping.

```typescript
type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

type SarifLevel = "error" | "warning" | "note";

function toSarifLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
    case "informational":
      return "note";
  }
}
```

This mapping is a judgment call. In spectr-ai, critical and high findings both become `error` because they should block PRs in a branch protection rule. Medium findings are `warning` — visible but not blocking. Low and informational are `note` — context without noise.

## Generating the SARIF File

Here's the function that converts spectr-ai audit results into a valid SARIF document:

```typescript
interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: {
        startLine: number;
        endLine: number;
      };
    };
  }>;
}

interface SarifDocument {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        rules: Array<{
          id: string;
          shortDescription: { text: string };
          defaultConfiguration: { level: SarifLevel };
        }>;
      };
    };
    results: SarifResult[];
  }>;
}

function toSarif(
  vulnerabilities: Vulnerability[],
  filePath: string,
  version: string,
): SarifDocument {
  const rules = vulnerabilities.map((v) => ({
    id: v.id,
    shortDescription: { text: v.title },
    defaultConfiguration: {
      level: toSarifLevel(v.severity),
    },
  }));

  const results: SarifResult[] = vulnerabilities.map(
    (v) => ({
      ruleId: v.id,
      level: toSarifLevel(v.severity),
      message: {
        text: `${v.description}\n\nRecommendation: ${v.recommendation}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: filePath },
            region: {
              startLine: v.lineStart,
              endLine: v.lineEnd,
            },
          },
        },
      ],
    }),
  );

  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "spectr-ai",
            version,
            rules,
          },
        },
        results,
      },
    ],
  };
}
```

Each vulnerability becomes both a rule (in `tool.driver.rules`) and a result (in `results`). The rule defines what the check is. The result says where it was found and at what severity. The `artifactLocation.uri` must be a path relative to the repository root — GitHub uses this to map findings to files in the PR diff.

## Writing the File

```typescript
import { writeFile } from "node:fs/promises";

async function writeSarif(
  vulnerabilities: Vulnerability[],
  filePath: string,
  outputPath: string,
): Promise<void> {
  const sarif = toSarif(vulnerabilities, filePath, "1.0.0");
  await writeFile(
    outputPath,
    JSON.stringify(sarif, null, 2),
  );
}
```

In spectr-ai, the CLI writes SARIF to a file with the `--sarif` flag:

```bash
spectr-ai analyze contract.sol --sarif results.sarif
```

## Uploading to GitHub Code Scanning

Once you have a SARIF file, upload it with the GitHub CLI:

```bash
gh code-scanning upload-sarif \
  --sarif results.sarif \
  --ref refs/heads/main \
  --commit-sha "$(git rev-parse HEAD)"
```

The `--ref` and `--commit-sha` flags tell GitHub which branch and commit the results apply to. This is important — GitHub uses these to track findings across commits and determine if an alert is new or already known.

## In a GitHub Actions Workflow

The real power of SARIF is in CI. Here's a workflow that runs spectr-ai on every PR that modifies Solidity files:

```yaml
name: Smart Contract Audit
on:
  pull_request:
    paths:
      - "contracts/**/*.sol"

permissions:
  security-events: write
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          persist-credentials: false

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: "22"

      - run: npx spectr-ai analyze contracts/ --sarif results.sarif

      - uses: github/codeql-action/upload-sarif@ff0a06e83cb2de871e5a09832bc6a81e7276941f  # v3.28.18
        with:
          sarif_file: results.sarif
        if: always()
```

The `if: always()` on the upload step is important. If the audit finds critical issues, spectr-ai exits with a non-zero code. Without `if: always()`, the upload step would be skipped and the findings would never reach GitHub.

The `security-events: write` permission is required for uploading SARIF. The `contents: read` permission lets the action check out the code. No other permissions are needed.

## What You Get

Once SARIF is uploaded, GitHub provides:

1. **PR annotations.** Findings appear as inline comments on the exact lines of code where the vulnerability was found. Reviewers see them without leaving the diff view.

2. **Security tab alerts.** Every finding becomes a code scanning alert that can be triaged — dismissed, marked as false positive, or assigned to a developer.

3. **Branch protection integration.** You can require that code scanning finds no new `error`-level results before a PR can be merged. This is why the severity mapping matters.

4. **Historical tracking.** GitHub tracks which findings are new, fixed, or persistent across commits. You get a timeline of your security posture.

## The Value of Standards

SARIF isn't the most exciting technology. It's a verbose JSON schema for expressing "this tool found this problem on this line." But that standardization is what makes it powerful. Any tool that outputs SARIF — whether it's an AI auditor, a traditional SAST scanner, or a custom script — integrates with the same GitHub infrastructure.

For spectr-ai, adding SARIF output was about 80 lines of code. The mapping function, the type definitions, and the file writer. In return, every finding from the AI auditor appears in the same place as findings from CodeQL, Semgrep, and every other security tool. That's a good trade.
