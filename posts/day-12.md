# I Analyzed 5 Famous Hacked Contracts with AI — Here's What It Found

I fed the vulnerable code patterns from five of the most devastating DeFi hacks into spectr-ai to see what an AI auditor would catch — and what it would miss. The results were both encouraging and humbling.

For each hack, I reconstructed the vulnerable code pattern (simplified for clarity), ran it through the AI analysis pipeline, and recorded the findings. No cherry-picking. Here is what happened.

## 1. The DAO — Reentrancy ($60M, June 2016)

**What happened:** The DAO's `splitDAO` function sent ETH to users before updating their balance. An attacker called the function recursively through a fallback function, draining funds repeatedly before the balance was set to zero.

**The vulnerable pattern:**

```solidity
function withdraw(uint amount) public {
    require(balances[msg.sender] >= amount);

    // ETH sent before state update
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);

    // State updated after external call
    balances[msg.sender] -= amount;
}
```

**What the AI found:** Flagged immediately. High severity. The finding identified the external call before state update, correctly described the reentrancy attack vector, and recommended the checks-effects-interactions pattern. It also suggested adding a reentrancy guard modifier.

**Verdict: Caught.** This is the canonical example of a known vulnerability pattern. Any tool worth its salt catches this one.

## 2. Parity Multisig — delegatecall + selfdestruct ($280M frozen, November 2017)

**What happened:** Parity's multisig wallet used a library contract via `delegatecall`. The library contract had an `initWallet` function that was left unprotected after deployment. An attacker called `initWallet` on the library itself, became its owner, then called `kill()` which executed `selfdestruct`. Since every wallet delegated to this library, all of them became nonfunctional — $280M in ETH was permanently frozen.

**The vulnerable pattern:**

```solidity
contract WalletLibrary {
    address public owner;
    bool public initialized;

    function initWallet(address _owner) public {
        // No check if already initialized on the library itself
        require(!initialized);
        owner = _owner;
        initialized = true;
    }

    function kill(address to) public {
        require(msg.sender == owner);
        selfdestruct(payable(to));
    }
}

contract Wallet {
    address public library;

    fallback() external payable {
        (bool success, ) = library.delegatecall(msg.data);
        require(success);
    }
}
```

**What the AI found:** It flagged two issues. First, the `selfdestruct` usage was flagged as high severity with a note about permanent contract removal. Second, the open `delegatecall` in the fallback was flagged as a proxy pattern requiring careful access control review. However, it did not connect the dots — it did not identify that the library contract itself could be initialized by anyone because it was deployed as a standalone contract with no constructor protection.

**Verdict: Partially caught.** The individual dangerous primitives were flagged, but the compound attack — that the library was a standalone contract whose initialization could be hijacked — required understanding the deployment context that the AI did not have.

## 3. Ronin Bridge — Compromised Validators ($625M, March 2022)

**What happened:** The Ronin bridge required 5 of 9 validator signatures to approve withdrawals. The attacker compromised 4 validator private keys belonging to Sky Mavis and one third-party validator (Axie DAO). With 5 signatures, they approved fraudulent withdrawals of 173,600 ETH and 25.5M USDC.

**The vulnerable pattern:**

```solidity
function withdrawERC20(
    uint256 id,
    address token,
    uint256 amount,
    address recipient,
    bytes[] calldata signatures
) external {
    require(signatures.length >= threshold, "Not enough sigs");

    bytes32 hash = keccak256(
        abi.encodePacked(id, token, amount, recipient)
    );

    uint256 validSigs = 0;
    for (uint256 i = 0; i < signatures.length; i++) {
        address signer = ECDSA.recover(hash, signatures[i]);
        if (isValidator[signer]) {
            validSigs++;
        }
    }

    require(validSigs >= threshold, "Invalid signatures");
    IERC20(token).transfer(recipient, amount);
}
```

**What the AI found:** It flagged a missing duplicate-signer check (the same validator signature could potentially be submitted multiple times depending on the implementation). It also noted that the threshold of 5/9 was relatively low for a bridge holding hundreds of millions. But fundamentally, the code logic was correct — the vulnerability was operational, not in the smart contract.

**Verdict: Missed (correctly).** This was not a code vulnerability. It was a key management failure. No static analysis or AI review of the contract source code could have caught this. The lesson here is that smart contract security is necessary but not sufficient — operational security matters just as much.

## 4. Cream Finance — Flash Loan + Oracle Manipulation ($130M, October 2021)

**What happened:** The attacker used a flash loan to manipulate the price of crYUSD (Cream's yUSD lending token), then used the inflated collateral value to borrow all available assets across Cream's lending markets. The attack exploited how Cream calculated the value of crYUSD as collateral — it relied on the token's exchange rate, which could be manipulated through large deposits.

**The vulnerable pattern (simplified):**

```solidity
function getCollateralValue(
    address token,
    uint256 amount
) public view returns (uint256) {
    // Exchange rate can be manipulated via flash loan
    uint256 exchangeRate = ICToken(token).exchangeRateStored();
    uint256 underlyingAmount = amount * exchangeRate / 1e18;
    uint256 price = oracle.getPrice(token);
    return underlyingAmount * price / 1e18;
}

function borrow(
    address collateralToken,
    uint256 collateralAmount,
    address borrowToken,
    uint256 borrowAmount
) external {
    uint256 collateralValue = getCollateralValue(
        collateralToken, collateralAmount
    );
    uint256 borrowValue = borrowAmount
        * oracle.getPrice(borrowToken) / 1e18;
    require(
        collateralValue >= borrowValue * collateralFactor / 1e18
    );
    // ... execute borrow
}
```

**What the AI found:** It flagged the use of `exchangeRateStored()` instead of `exchangeRateCurrent()` as a potential stale-data issue. It also noted that the collateral valuation was susceptible to price manipulation if the underlying exchange rate could be moved within a single transaction. The flash loan attack vector was mentioned as a possibility.

**Verdict: Partially caught.** The AI identified the right area of concern — manipulable exchange rates used for collateral valuation — but did not construct the full multi-step attack path involving flash loans, cross-market borrowing, and the specific economic conditions needed for profitability.

## 5. Euler Finance — Donation Attack ($197M, March 2023)

**What happened:** The attacker exploited Euler's `donateToReserves` function, which allowed users to inflate their debt without a corresponding health check. By donating to reserves, the attacker made their own position liquidatable, then used a liquidation mechanism that was more favorable than it should have been given the manipulated state. The interaction between `donateToReserves`, the health check bypass, and the liquidation bonus created an extraction path.

**The vulnerable pattern (simplified):**

```solidity
function donateToReserves(
    address subAccount,
    uint256 amount
) external {
    // Increases the donor's debt token balance
    // WITHOUT checking if the position remains healthy
    debtBalances[subAccount] += amount;
    reserveBalance += amount;
    // Missing: health check after debt increase
}
```

**What the AI found:** It flagged the missing health check after the debt increase. The finding noted that any function that modifies a user's debt-to-collateral ratio should verify the position remains solvent afterward. This was rated high severity.

However, the AI did not identify the full exploit chain — how the donation attack combined with the liquidation discount to create a profitable extraction. It caught the entry point but not the economic reasoning.

**Verdict: Partially caught.** The root cause (missing health check) was identified. The complete attack economics were not.

## The Scorecard

| Hack | Root Cause | AI Caught It? |
|------|-----------|---------------|
| The DAO | Reentrancy | Yes |
| Parity Multisig | Unprotected init + selfdestruct | Partial |
| Ronin Bridge | Key compromise | No (not a code bug) |
| Cream Finance | Oracle manipulation | Partial |
| Euler Finance | Missing health check | Partial |

**Full catches: 1/5. Partial catches: 3/5. Misses: 1/5.**

## What I Learned

The AI reliably catches known vulnerability patterns — reentrancy, missing access control, dangerous opcodes. That first finding from The DAO analysis would have saved $60M in 2016. That is not nothing.

But the most devastating modern hacks exploit economic logic, cross-protocol interactions, and deployment context. AI flags the ingredients (a manipulable exchange rate, a missing health check) without assembling them into the full recipe.

This confirms the hybrid model. AI as the first pass catches the known patterns quickly and cheaply. Human auditors then focus their expensive time on the economic modeling and novel attack surfaces that AI cannot reason about.

The goal of spectr-ai is not to produce a final audit report. It is to give the human auditor a head start — flagging the obvious issues so they can spend their time on the hard problems. Based on these results, that approach is working, but the gap between "flagging ingredients" and "identifying complete attack chains" remains wide.

That gap is where human expertise lives. And for now, it is not going anywhere.
