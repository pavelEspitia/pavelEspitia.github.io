---
title: "Signature Replay Attacks in Solidity: The Bug That Looks Correct"
tags: ["security", "blockchain", "solidity", "ai"]
publish: false
---

Some smart contract bugs scream at you. A missing `onlyOwner`, a reentrancy with the state update after the transfer. Signature replay is not one of those. The code looks careful. It checks a signature, it recovers the right address, it gates on the result. And it lets an attacker replay the same approval forever. Here is the bug class, three ways it shows up, and how I check for it.

## The setup: meta-transactions and permit

Lots of protocols let users sign a message off-chain and have someone else submit it on-chain. Gasless approvals, relayers, `permit`-style flows. The contract recovers the signer from the signature and acts on their behalf. The whole security model rests on "only the real signer could have produced this signature."

That is true. The problem is that a signature, once produced, can be used more than once unless you stop it.

## Version 1: no nonce

```solidity
function executeWithSig(address user, uint256 amount, bytes memory sig) external {
    bytes32 hash = keccak256(abi.encodePacked(user, amount));
    require(recover(hash, sig) == user, "bad sig");
    balances[user] -= amount;
    payable(msg.sender).transfer(amount);
}
```

This looks fine. It recovers the signer and checks it matches `user`. But there is nothing stopping me from calling `executeWithSig` with the *same* `sig` again. And again. The signature is valid every time, so the `require` passes every time, and the balance drains in repeated calls.

The fix is a nonce that the contract increments and includes in the signed hash:

```solidity
mapping(address => uint256) public nonces;

function executeWithSig(address user, uint256 amount, uint256 nonce, bytes memory sig) external {
    require(nonce == nonces[user], "bad nonce");
    bytes32 hash = keccak256(abi.encodePacked(user, amount, nonce));
    require(recover(hash, sig) == user, "bad sig");
    nonces[user]++;          // consume the nonce so the sig can't be replayed
    balances[user] -= amount;
    payable(msg.sender).transfer(amount);
}
```

## Version 2: nonce but no domain separator (cross-contract replay)

You add a nonce. Good. But you deploy the same contract on Base and on Arbitrum, and the signed message does not include the chain ID or the contract address. Now a signature meant for the Base contract is also valid on the Arbitrum contract, because the hash is identical on both chains.

This is exactly the kind of cross-chain assumption that bites bridge and multi-chain protocols. The fix is EIP-712 with a domain separator that binds the signature to a specific chain and contract:

```solidity
bytes32 private immutable DOMAIN_SEPARATOR;

constructor() {
    DOMAIN_SEPARATOR = keccak256(abi.encode(
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
        keccak256(bytes("MyProtocol")),
        block.chainid,             // binds to this chain
        address(this)              // binds to this contract
    ));
}
```

Now the same signature is worthless on the other chain.

## Version 3: nonce reuse after a state reset

The subtle one. You have a nonce. But somewhere you reset it, maybe in a "clear account" admin function, maybe on a re-registration path. The moment the nonce goes back to a value an old signature already used, that old signature is valid again. The nonce only works if it monotonically increases and is never reset for an address that ever signed.

## How AI helps with this class

This is a case where pattern-matching static analysis struggles and reasoning helps. A linter can flag "this function recovers a signature but I see no nonce mapping," which catches version 1. It is much weaker on versions 2 and 3, because those require understanding the deployment context and the lifecycle of the nonce across functions.

When I run a contract through an LLM-assisted pass, the prompt I use is explicit about the replay surface:

> For every signature verification, check: is the signed payload bound to a nonce that is consumed on use? Is it bound to chainId and contract address? Is there any path that resets the nonce for an address?

That framing pushes the model to reason about all three versions, not just the missing-nonce one. It is the difference between "I see a signature check" and "I traced where this signature could be valid a second time."

## The checklist

For any signature-gated function, verify all of these:

- A nonce is included in the signed hash and incremented on use.
- The signature is bound to `block.chainid` and `address(this)` via EIP-712.
- No code path resets a nonce to a previously-used value.
- The signed payload includes every field that should make the signature single-use (amount, recipient, deadline).
- There is a deadline, so a stale signature cannot be replayed months later.

The bug looks correct because the cryptography is correct. The flaw is in what the signature is *not* bound to. Check the bindings, not the recovery.
