---
title: "Detecting Supply-Chain Malware Without Running the Code"
tags: ["security", "typescript", "webdev", "ai"]
publish: false
---

After I got targeted by a fake-job-interview repo designed to steal my keys, I built a scanner that checks a repository for supply-chain attacks without cloning, installing, or running any of it. The whole point is to find the malicious code statically, before it ever executes, because by the time you run `npm install` it is already too late. Here is how static detection of these attacks works and what it looks for.

## Why static, and why before install

The dangerous moment in a supply-chain attack is install or build time. A `postinstall` script, a malicious dependency, a build step that runs arbitrary code. Once you run `npm install`, that code has already executed with your shell's environment, including any secrets it can reach.

So a scanner that runs the code to analyze it has already lost. The analysis has to be static: read the files, parse them, reason about them, and never execute a line. That constraint shapes everything.

## What the scanner looks for

Three categories cover most of what I have seen in real lures.

**1. Build-time code execution.** The first thing I check is anything that runs during install or build:

```typescript
// package.json scripts that fire automatically
const dangerousScripts = ["preinstall", "install", "postinstall", "prepare"];
```

A `postinstall` that runs an obfuscated script, downloads and executes a remote payload, or shells out to `curl | sh` is the single biggest red flag. Legitimate packages occasionally use these hooks, but a `postinstall` that fetches and runs remote code is almost never benign.

**2. Dependencies missing from the lockfile.** This is the subtle one, and it is how the attack that targeted me worked. The `package.json` declares a dependency, but it is not in the lockfile, or the lockfile points a known package name at a malicious tarball URL. The intent is that you trust the familiar name in `package.json` and never check what the lockfile actually resolves it to.

```typescript
// Flag dependencies in package.json that the lockfile resolves
// to an unexpected registry or a direct tarball URL
function checkResolutions(pkg: PackageJson, lock: Lockfile) {
  for (const [name] of Object.entries(pkg.dependencies ?? {})) {
    const resolved = lock.packages[name]?.resolved;
    if (resolved && !resolved.startsWith("https://registry.npmjs.org/")) {
      flag(`${name} resolves to a non-registry URL: ${resolved}`);
    }
  }
}
```

A package named like a popular library but resolved from a random URL is a classic typosquat or hijack.

**3. Obfuscation.** Malicious payloads are usually obfuscated to hide what they do and slip past a casual reader. So I look for the fingerprints of obfuscation: long hex or base64 string literals, dense `\x` escape sequences, `eval` of a decoded string, arrays of character codes assembled at runtime.

```typescript
function looksObfuscated(source: string): boolean {
  const longHexString = /["'][0-9a-f]{120,}["']/i.test(source);
  const evalOfDecoded = /eval\s*\(\s*(atob|Buffer\.from|decode)/.test(source);
  const charCodeArray = /String\.fromCharCode\s*\(\s*\d+(\s*,\s*\d+){20,}/.test(source);
  return longHexString || evalOfDecoded || charCodeArray;
}
```

None of these is proof of malice on its own. Together, on a file that also has a `postinstall` hook, they are damning.

## The analyzer core is pure and testable

The most important architectural decision was keeping the analysis logic pure: it takes file contents as input and returns findings, with no I/O of its own. Fetching the repo is a separate layer. That separation means I can unit-test the analyzer against known-malicious and known-clean fixtures without any network or filesystem:

```typescript
test("flags postinstall that pipes curl to sh", () => {
  const findings = analyze({ "package.json": MALICIOUS_FIXTURE });
  expect(findings).toContainEqual(
    expect.objectContaining({ rule: "remote-code-execution-on-install" }),
  );
});
```

A security tool that I cannot test thoroughly is a security tool I do not trust. Pure functions make the testing trivial.

## Where AI fits, carefully

I do use an LLM as one layer, but not as the gate. The deterministic rules above catch the known patterns reliably. The model is for the judgment call on suspicious-but-not-obviously-malicious code: "this script downloads a config file and parses it, is that benign or a staged payload?" The model reasons about intent in a way regex cannot.

But the model never executes anything either, and I never let it be the sole reason to pass or fail a repo. Deterministic rules first, model for nuance, human for the final call. The model is an advisor, not an authority, because a model can be talked out of a finding and a regex cannot.

## The real lesson

The attack that targeted me relied on me trusting a friendly repo and running its install step. The entire defense is to break that chain: analyze before you install, statically, and treat install-time code execution, lockfile mismatches, and obfuscation as the three things most likely to hurt you. You do not need to run hostile code to know it is hostile. You need to read it before it gets the chance to run.
