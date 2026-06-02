---
title: "Scanning npm Packages for Malware Before You Install, Without Running Them"
tags: ["security","javascript","npm","devops"]
publish: false
---

`npm install` is not a download. It is arbitrary code execution. The moment you run it, a package can fire a script that reads your SSH keys, exfiltrates environment variables, or drops a second-stage payload, all before you have typed a single line against it. Most developers treat `node_modules` like a folder of files. It is closer to a folder of programs you just agreed to run.

You do not have to run them to find out what they do. You can read a package the way a reviewer reads a pull request: fetch the files, look at the wiring, flag the parts that try to execute on install. This post is the technical how-to behind a small web tool I built that does exactly this. Paste a GitHub repo URL, get back a verdict, and nothing is cloned, installed, or executed.

## Why install is code execution

npm packages have lifecycle scripts. Three of them run automatically during `npm install`:

| Script | When it runs |
|--------|-------------|
| `preinstall` | Before the package is installed |
| `install` | During installation |
| `postinstall` | After the package is installed |

There are more (`prepare`, `prepublishOnly`), but those three are the ones malware reaches for, because they fire on the victim's machine the instant the dependency lands. The script field is just a shell command. There is no sandbox. It runs with your user's permissions, your env vars, your network.

The classic pattern looks innocent:

```json
{
  "name": "totally-normal-utils",
  "version": "1.0.4",
  "scripts": {
    "postinstall": "node ./scripts/setup.js"
  }
}
```

`setup.js` is where the payload lives. So the first thing any scanner should do is read `package.json` and check whether the package wants to run anything on install.

## Fetching the files without cloning

You do not need `git clone`. The GitHub Contents API serves any file in a public repo over HTTPS, and it never executes anything. Cloning, by contrast, can trigger git hooks and writes a working tree to disk. The API is read-only by nature, which is the whole point.

```ts
const GH = "https://api.github.com/repos";

async function fetchFile(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(`${GH}/${owner}/${repo}/contents/${path}`, {
    headers: { Accept: "application/vnd.github.raw+json" },
  });
  if (!res.ok) return null;
  return res.text();
}
```

With that, you pull the three files that tell you most of the story: `package.json`, the lockfile (`package-lock.json` or `pnpm-lock.yaml`), and any script referenced by a lifecycle hook. No dependencies of your own, no git, no shell.

## Check 1: install and postinstall scripts

Parse `package.json`, look at `scripts`, and flag the install-time hooks. This is the highest-signal check, because legitimate packages rarely need to run code just to be installed.

```ts
const INSTALL_HOOKS = ["preinstall", "install", "postinstall"] as const;

interface ScriptFinding {
  hook: string;
  command: string;
}

function findInstallScripts(pkgJson: string): ScriptFinding[] {
  const pkg = JSON.parse(pkgJson) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};
  const findings: ScriptFinding[] = [];
  for (const hook of INSTALL_HOOKS) {
    const command = scripts[hook];
    if (command) findings.push({ hook, command });
  }
  return findings;
}
```

A `postinstall` that runs `node-gyp rebuild` is normal for native modules. A `postinstall` that runs `node -e "..."` with a base64 blob, or `curl ... | sh`, is not. The hook being present is the signal; the command's contents tell you how worried to be.

## Check 2: lockfile evasion

This is the subtle one, and it is how a real attack hides. A lockfile pins every dependency to an exact version and integrity hash. CI installs from the lockfile, so reviewers read `package.json` but the resolver reads the lockfile. If those two disagree, you have a gap a payload can live in.

There are three shapes of evasion:

1. A dependency declared in `package.json` but **absent** from the lockfile.
2. A dependency in the lockfile that is **not** in `package.json` (something slipped in).
3. A **version mismatch**: `package.json` says `^1.2.0`, the lockfile resolves to a version outside that range.

Any of these means "what you reviewed is not what gets installed." Here is the first two, comparing the declared dependency set against the locked one:

```ts
interface LockMismatch {
  kind: "missing-from-lock" | "extra-in-lock";
  name: string;
}

function compareDeclaredVsLocked(
  declared: Set<string>,
  locked: Set<string>,
): LockMismatch[] {
  const findings: LockMismatch[] = [];
  for (const name of declared) {
    if (!locked.has(name)) {
      findings.push({ kind: "missing-from-lock", name });
    }
  }
  for (const name of locked) {
    if (!declared.has(name)) {
      findings.push({ kind: "extra-in-lock", name });
    }
  }
  return findings;
}
```

Building the `locked` set differs by lockfile. For `package-lock.json` (v3), the top-level deps live under `packages[""].dependencies`; for `pnpm-lock.yaml`, under the `importers` and `dependencies` keys. Normalize both to a flat `Set<string>` of names, then run the comparison once. Version mismatches need the semver range check on top:

```ts
import { satisfies } from "semver";

function rangeMismatch(
  declaredRange: string,
  lockedVersion: string,
): boolean {
  return !satisfies(lockedVersion, declaredRange);
}
```

A clean repo produces an empty findings array. Anything in it deserves a human look before you trust the install.

## Check 3: obfuscation heuristics

Malicious payloads are almost never readable. They hide the actual instructions inside encoded strings and dynamic evaluation so a casual reader sees noise. You cannot prove intent from text, but you can score how hard the code is working to be unreadable.

The heuristics that pay off:

- Long base64 blobs (a 200-character run of base64 chars is not a config value).
- `eval(`, `new Function(`, and `atob(` (runtime evaluation of strings).
- Hex string arrays, the signature of obfuscators that split code into `["\x68","\x69"]`.
- Network calls (`fetch`, `http.get`, `child_process` with `curl`/`wget`) inside an install script.

```ts
interface Heuristic {
  id: string;
  pattern: RegExp;
  weight: number;
}

const HEURISTICS: Heuristic[] = [
  { id: "long-base64", pattern: /[A-Za-z0-9+/]{200,}={0,2}/, weight: 3 },
  { id: "dynamic-eval", pattern: /\b(eval|Function)\s*\(/, weight: 3 },
  { id: "atob-decode", pattern: /\batob\s*\(/, weight: 2 },
  { id: "hex-array", pattern: /(\["\\x[0-9a-f]{2}",?\s*){5,}/i, weight: 2 },
  { id: "install-network", pattern: /\b(fetch|curl|wget|https?\.get)\b/, weight: 2 },
];

function scoreObfuscation(source: string): { id: string; weight: number }[] {
  const hits: { id: string; weight: number }[] = [];
  for (const h of HEURISTICS) {
    if (h.pattern.test(source)) hits.push({ id: h.id, weight: h.weight });
  }
  return hits;
}
```

Sum the weights to get a risk score. A minified-but-honest library might trip `long-base64` on a bundled asset; that is a false positive you triage. An install script that trips `dynamic-eval`, `atob-decode`, and `install-network` at once is not a false positive.

## What to do when you actually install

Reading the package is the front line. The second line is making install itself less dangerous, so even a missed payload cannot fire on its own:

1. **`npm install --ignore-scripts`** skips all lifecycle scripts for a one-off install. Nothing in `preinstall`/`install`/`postinstall` runs.
2. **`pnpm config set ignore-scripts true`** makes that the default for every project. You explicitly allow the few packages that genuinely need a build step.
3. **`npm pack <pkg>`** downloads the tarball without installing it, so you can extract and read the published files (which can differ from the GitHub repo).
4. **Publish delay.** Set `pnpm config set minimumReleaseAge 1440` to refuse any version published in the last 24 hours. Most malicious versions are caught and pulled within hours, so a one-day buffer dodges the majority of supply-chain bursts.

The combination matters: ignore-scripts removes the automatic execution, and the publish delay removes the freshest, least-vetted releases.

## The limits of static analysis

Be honest about what this gives you. Static scanning is signal, not proof.

- It can be evaded. An attacker who knows your heuristics can split a base64 blob, rename `eval`, or fetch the payload at runtime instead of install time.
- It produces false positives. Minifiers, WASM blobs, and legitimate native-module builds all look suspicious to a regex.
- It reads the repo, not the registry. The tarball on npm can contain files that are not in the GitHub repo. `npm pack` closes that gap; the GitHub API alone does not.

What it does do is raise the cost of attacking you and shorten the time to notice. A scan that takes ten seconds and flags an install-time `postinstall` running an `atob`-decoded network call has done its job: it moved a "ship it" into a "wait, read this first."

## Takeaway

Treat every dependency as code you are about to execute, because it is. Before you install: read `package.json` for install hooks, diff it against the lockfile, and grep the install scripts for obfuscation. After you decide to install: use `--ignore-scripts`, set a publish delay, and let the freshest releases age before you touch them.

I packaged all three checks (install scripts, lockfile evasion, obfuscation) into a vanilla-TypeScript web app with no runtime dependencies. You paste a GitHub repo URL and it fetches the files over the API, runs the heuristics, and gives you a verdict, without cloning, installing, or running anything. Source and details: [repo-malware-scanner](https://github.com/pavelEspitia).
