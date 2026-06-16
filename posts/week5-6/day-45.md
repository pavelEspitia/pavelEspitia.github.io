---
title: "What I Learned Submitting a Chrome Extension to the Web Store"
tags: ["webdev", "typescript", "productivity", "career"]
publish: false
---

I built Argus, an AI transaction firewall as a Chrome extension, and submitting it to the Web Store was its own small adventure separate from writing the code. The review process, the permissions justifications, the manifest gotchas: none of it is hard, but all of it is undocumented in the way that matters. Here is what I wish I had known before I hit submit.

## The extension, briefly

Argus inspects Web3 transactions before you sign them and warns you if something looks dangerous: an unlimited approval, a drainer pattern, an address that does not match what the dApp claims. It is built with WXT (a modern extension framework) and TypeScript, with an LLM-backed analysis step behind a freemium proxy. The technical part was the part I knew how to do. The store submission was the part that surprised me.

## Manifest V3 is the only option now, and it changes your architecture

If you are starting an extension in 2026, it is Manifest V3, period. The biggest practical consequence: no persistent background page. You get a service worker that the browser can kill at any time and restart on the next event. State does not survive.

This bit me. I had assumed a long-lived background context where I could cache analysis results in memory. In MV3 that cache evaporates whenever the worker sleeps. The fix was to treat the service worker as stateless and put anything that needs to persist into `chrome.storage`:

```typescript
// Wrong assumption: this Map is gone when the worker sleeps
const cache = new Map<string, Analysis>();

// Right: persist to chrome.storage, which survives worker restarts
async function cacheAnalysis(txHash: string, result: Analysis) {
  await chrome.storage.local.set({ [`tx:${txHash}`]: result });
}
async function getCached(txHash: string): Promise<Analysis | undefined> {
  const data = await chrome.storage.local.get(`tx:${txHash}`);
  return data[`tx:${txHash}`];
}
```

Design as if the background context can vanish between any two events, because it can.

## Permissions are where reviews stall

The store review scrutinizes permissions hard, and rightly so. Every permission you request, you have to justify in the submission form, in plain language, tied to a specific feature. Requesting a broad permission "just in case" is the fastest way to a rejection or a long back-and-forth.

I went through my manifest and cut every permission I was not actively using. For the ones I kept, I wrote the justification before submitting:

- `storage`: cache transaction analyses so we do not re-analyze the same transaction.
- `activeTab` instead of broad host permissions: only read the page the user is actively on, only when they invoke the extension.

The principle is least privilege, and the store enforces it. If you cannot write a one-sentence justification tying a permission to a feature, you do not need the permission.

## The privacy disclosure is not optional

Because Argus sends transaction data to a backend for analysis, I had to disclose exactly what data leaves the user's machine and why. The store wants a privacy policy URL and a data-use declaration. "We send transaction details to our server for security analysis and do not retain them beyond the request" is the kind of specific, honest statement they want. Vague or missing disclosures get flagged.

Write this for the user, not for the lawyer. The people reading it are deciding whether to trust your extension with their wallet activity.

## Review takes longer than you expect, plan for it

I submitted and then waited. Review is not instant, and if they have a question about a permission or the privacy disclosure, that is another round trip. Build the wait into your launch timeline. I had a soft launch date in mind and the review queue did not care about it.

The lesson: submit earlier than you think you need to, with the cleanest possible permission set and a clear privacy disclosure, so there is nothing to question.

## What I would tell past me

The code was 90% of the effort and 10% of the risk to launch. The submission was 10% of the effort and most of the launch risk, because a rejection there blocks everything. So front-load it:

1. Start with MV3 and a stateless service-worker design.
2. Request the minimum permissions and write the justification for each one as you add it, not at submission time.
3. Write the privacy disclosure honestly and specifically.
4. Submit with buffer time before any date you have promised anyone.

None of this is hard once you know it. All of it is friction if you discover it at submission time. Now you know it.
