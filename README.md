# Vault Checkout Agent

An agent that checks out and pays for data services on Celo, under Agent Vault
rules. Built for the Celo **Agents Open for Business** hackathon (Nov 20 – Dec 7,
2026), track **Agent Vault** ($1,000).

## Live demo

**https://celo-agent-vault.vercel.app** — the agent running on Vercel
(serverless, sandbox). Type a task, check the price, then Pay & run; the
payment settles in test USDC with a receipt and a Blockscout link.

> Production deployment on the owner's Vercel account (project
> `celo-agent-vault`, team bambang9) — permanent, no expiry. Deployed
> 2026-11-21 ~12:57 WIB with 4 services (YouTube, Reddit, Instagram,
> TikTok). First paid call from this deployment settled: tx
> `0xee1a4ac94f08547ecb43e6a18d32a5e732e517e4be949d6de8c38d02f010440f` (0.005 test USDC, YouTube search). The deployed
> function auto-creates its own sandbox wallet and is auto-funded from the
> faucet — no private key is shipped or stored in the repo. (Earlier
> temporary deployments `nimble-basalt-d2dqfhk`, `rushing-monsoon-bxnh1pk`,
> `zippy-monsoon-aijmunw` and `turbo-agate-o4df0vp` were deleted
> 2026-11-21 ~12:53 WIB.)

## Hackathon

Celo **Agents Open for Business** (Nov 20 – Dec 7, 2026), track **Agent Vault**
($1,000). Registration on **Loops House**. Attribution tag
`celo_2da564e80a18` — required in every transaction the agent sends directly;
x402 settlements attribute via the agent wallet address. **Scoring is Celo
mainnet only** (chain 42220); testnet activity does not count.

## What it does

You type a task ("search YouTube for celo", or look up an Instagram/TikTok
profile). The agent:

Approved services (4, each 0.005 USDC per call): YouTube video search,
Reddit post search, Instagram profile, TikTok profile. (X post search was
removed 2026-11-21 ~12:31 WIB: the buy gateway route 502s at the provider.)

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

- `ALLOWLIST` in `handler.mjs` (shared by `server.mjs` and `api/index.mjs`) —
  approved sellers only. A capability outside the list is refused with 403.
- `--max-amount` on every paid call — the per-call cap. buy refuses to sign
  above it.
- `DAILY_CAP_USD` — enforced from the ledger before each payment.
- Planned production setup (not yet live — no Agent Vault account exists
  yet): the deployment swaps the payer to the Agent Vault wallet, the Vault
  holds the key, funds it with stablecoins, and the agent card's limits apply
  to wallet payments exactly as they do to card fills.

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
  0.005 USDC, 20 YouTube results. A screen recording of that run was made
  locally (`demo/record_demo.py`); the video file is not in this repo
  (binary), it will be uploaded to YouTube.
- Note: the buy gateway's X posts search route returned HTTP 502 repeatedly
  during testing (provider-side); the agent records such payments as
  `ambiguous` and never retries them blindly. X was removed from the
  allowlist 2026-11-21 ~12:31 WIB for that reason.
- Three more services verified settled on Celo Sepolia (2026-11-21 ~12:15 WIB,
  0.005 USDC each):
  - Reddit post search "celo": tx
    `0x381f333e235110a4ee6f65fb0bbc067b19037054c1ca0c878508e7b372706d15`,
    7 posts.
  - Instagram profile @nasa: tx
    `0x12ec03f3077498b4ec1dbab18f78a314b2150ba9e8f40dc529c47ddd9ebc0772`,
    104,325,121 followers.
  - TikTok profile @nasa: tx
    `0x5767fbfd7e77d13702a1ec0d20f8900da12ca2373a3a6e34dd577afc6b3faf98`,
    2,200,000 followers.

## Stack

Node.js only, zero dependencies. The buy CLI does the x402 payment flow;
the agent is a thin policy + ledger layer around it.
