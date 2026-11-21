# Vault Checkout Agent

An agent that checks out and pays for data services on Celo, under Agent Vault
rules. Built for the Celo **Agents Open for Business** hackathon (Nov 20 – Dec 7,
2026), track **Agent Vault** ($1,000).

## What it does

You type a task ("search YouTube for celo"). The agent:

1. **Quotes first** — asks buy for the exact price before any money moves.
2. **Checks the agent card** — only allowlisted (approved) services can be
   bought, each with a per-call spending cap, plus a daily cap.
3. **Pays per call over x402** with buy, in USDC on Celo. The agent never sees
   a private key: buy signs from the OS keychain.
4. **Shows the receipt** — amount, token, settlement transaction hash, and a
   link to the explorer — and writes every payment to an append-only ledger
   (`agent/ledger.jsonl`).

## Agent Vault rules, in code

This mirrors an Agent Vault agent card:

- `ALLOWLIST` in `server.mjs` — approved sellers only. A capability outside
  the list is refused with 403.
- `--max-amount` on every paid call — the per-call cap. buy refuses to sign
  above it.
- `DAILY_CAP_USD` — enforced from the ledger before each payment.
- The production deployment swaps the payer to the Agent Vault wallet: the
  Vault holds the key, funds it with stablecoins, and the agent card's limits
  apply to wallet payments exactly as they do to card fills.

## Run it

Requires Node.js 22+ and the buy CLI:

```sh
npm install -g @celo/buy@0.8.5
npm start
```

Open http://localhost:8787. Default network is the **Celo Sepolia sandbox**:
test USDC, free from the faucet, no wallet setup needed. The sandbox wallet is
created on first use.

Mainnet (real money) needs both flags, so it can never happen by accident:

```sh
VAULT_NETWORK=mainnet VAULT_MAINNET_OK=1 npm start
```

## Verified sandbox proof

- `buy --sandbox quote` returns live 402 offers (YouTube search: 0.005 USDC).
- A sandbox paid call settled on Celo Sepolia:
  tx `0x35de96ba0ce0af2db82699ed6f73de6c5466d8a56feb46430001c89eae35a989`,
  0.005 USDC, 20 YouTube results for "celo".
- A second paid call through the agent's own UI settled on Celo Sepolia:
  tx `0x8ce72a7e568df84b8cbca387c99b15bd6afed8c8b1619a0a232822da358ff71c`,
  0.005 USDC, 20 YouTube results. Screen recording of that run:
  `demo/page@ce3824867e0238a39667fe76a011c7b5.webm` (reproduce it with
  `demo/record_demo.py`).
- Note: the buy gateway's X posts search route returned HTTP 502 twice during
  testing (provider-side); the agent records such payments as `ambiguous` and
  never retries them blindly.

## Stack

Node.js only, zero dependencies. The buy CLI does the x402 payment flow;
the agent is a thin policy + ledger layer around it.
