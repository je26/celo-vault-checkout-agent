# Vault Checkout Agent

An agent that checks out and pays for data services on Celo, under Agent Vault
rules. Built for the Celo **Agents Open for Business** hackathon (Nov 20 – Dec 7,
2026). Entered in all four tracks: Agent Vault ($1,000), Stablecoin Corridors
($2,000), Self Agent ID ($1,000), and Altana Agent Wallets ($750 + $250 + XP).
A project can win in at most two tracks.

## Live demo

**https://vault.sanjayapurba.com** - the agent running on Celo mainnet (project
`celo-agent-vault-mainnet`, team bambang9). Type a task, check the price, then
Pay & run; the payment settles in USDC on Celo mainnet with a receipt and a
Celoscan link. This is the demo the hackathon scores: mainnet only.

> Testnet / sandbox deployment: https://celo-agent-vault.vercel.app (project
> `celo-agent-vault`, team bambang9) - permanent, no expiry. Deployed
> 2026-11-21 ~12:57 WIB with 4 services (YouTube, Reddit, Instagram,
> TikTok); Flights search added 2026-11-21 as the 5th service ($0.023/call).
> First paid call from this deployment settled: tx
> `0xee1a4ac94f08547ecb43e6a18d32a5e732e517e4be949d6de8c38d02f010440f` (0.005 test USDC, YouTube search). The deployed
> function auto-creates its own sandbox wallet and is auto-funded from the
> faucet - no private key is shipped or stored in the repo. (Earlier
> temporary deployments `nimble-basalt-d2dqfhk`, `rushing-monsoon-bxnh1pk`,
> `zippy-monsoon-aijmunw` and `turbo-agate-o4df0vp` were deleted
> 2026-11-21 ~12:53 WIB.)

## How to verify (for judges)

Every claim below can be checked in under 10 minutes. All transactions are
on Celo mainnet (chain 42220) — open each hash on
https://celoscan.io/tx/<hash> and confirm **Status: Success**.

### Step 1 — Watch the demo video (2 min)
https://www.youtube.com/watch?v=1Uc4fas4AwE (v10, 103.5s, recorded on
mainnet). It shows the live site, an x402 payment, and the Corridors swap.

### Step 2 — Try the live demo (2 min)
Open https://vault.sanjayapurba.com. Type a task (e.g. "search YouTube for
celo"), check the quoted price, then Pay & run. The payment settles in USDC
on Celo mainnet and the receipt shows a Celoscan link.

### Step 3 — Confirm the agent identity
ERC-8004 agent ID **10093** on Celo mainnet (registry
`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`). Look it up on
https://8004scan.io. Attribution tag `celo_2da564e80a18` — it appears as a
calldata suffix at the end of the input data of the tagged corridor swap
below. (The two-leg Pair B swaps predate the tag implementation,
2026-11-22, and do not carry it.)

### Step 4 — Agent Vault track: website sign-in + x402 payment
- **Website sign-in:** on 2026-11-23 the agent signed in to figma.com with a
  saved login using Agent Vault mock tokens (MCP connector: open_page,
  fill_login 2/2, Figma home "Drafts" loaded). Free sign-in, no purchase.
- **Mainnet x402 payment:** flight search DXB to SIN, 2026-12-06, paid
  $0.023 USDC, tx
  `0x349d20fc63b1364de24035433faf49b3fbd7f5f5376e215074f7063047d3e047`
  (Status Success on Celoscan).
- **Second mainnet x402 payment:** flight search DXB to MAD, 2026-12-15,
  paid $0.023 USDC, tx
  `0x2d8d5c50d7055d7e47e5c6ffc6f92b244570782a648779750d4e27d8319a1bd0`
  (Status Success on Celoscan). This was the builder's own search, a
  second real job on mainnet.
- **Named user:** Rian searched flights on the live demo himself —
  Jakarta (CGK) → Yogyakarta (YIA), Thu 2026-12-17, one-way — paid
  $0.023 USDC over x402, tx
  `0xa3a1cb4403cbc5d2d08c65f205e1c4d9c9b27fa8c052383b8415c60fa15a2c92`
  (block 83708200, Status Success). See "Named user" in Mainnet proof.

### Step 5 — Stablecoin Corridors track: USDC -> IDRX (two-leg)
1.5 USDC became 27,566.45 IDRX, both legs Status Success on Celoscan:
- Leg 1, USDC -> USDT:
  `0x169ee00bcccee2e17068cc374bbae24156023828d0cc3bb7f38a6c2bd74ad9f5`
- Leg 2, USDT -> IDRX:
  `0x9b594c4d3f98cfe4c1373873c743dd6c60b2a2309e01e14253cea8d483e122b7`
- First tagged swap (tag `celo_2da564e80a18` verified at the end of the input
  data):
  `0x9a8197f50368dca444334551b87cd0c02b6f5e2de89ccd4856a4af7048b070fe`
- Real IDRX payout outside the agent wallet (500 IDRX):
  `0xa0ac4a0d55080052f5773c76a7b48f60c8570cde04f72d2ff14e18a2a5a94b21`
  (block 83536029, Status Success).

### Step 6 — Altana track: session grant, revoke, product review
- **Permanent session grant** (expiry 2027-11-22, caps 0.5 USDC + 0.5 CELO
  per day):
  `0x082b5bfaa2b6508809bbbbcc2d9adcc975cb8905615af69d88c9d8042866bbde`
- **Revoke demo** (separate 1-day test session, permanent session untouched):
  grant
  `0xa12ad2fca5f7a523d462a08675d6c54b96a60f9ee98160a9b4b0fe1ff151f68b`,
  revoke
  `0xd58ec995c8e6bb50d66773192d9aa93ed210722524e2251fbdd348c915564dea`
  (Status Success).
- **Product review** (5,000 XP):
  https://github.com/altananetwork/altana-sdk/issues/166

### Step 7 — Self Agent ID track (honest note)
Self Agent ID is **testnet only** (agent ID 96 on Celo Sepolia). Mainnet
registration is blocked because the registry does not recognise the
builder's KTP (Indonesian ID card); a passport is the only path and there
was not time to obtain one during the hackathon. This track is therefore
weaker than the other three — the limitation is stated here rather than
hidden.

### Step 8 — Project page
Loops House project:
https://www.loops.house/explore-projects/vault-checkout-agent-9e6e1

## Hackathon

Celo **Agents Open for Business** (Nov 20 – Dec 7, 2026). Entered in all four
tracks: Agent Vault ($1,000), Stablecoin Corridors ($2,000), Self Agent ID
($1,000), and Altana Agent Wallets ($750 + $250 + XP); a project can win in
at most two. Registration on **Loops House**. Attribution tag
`celo_2da564e80a18` - required in every transaction the agent sends directly;
x402 settlements attribute via the agent wallet address. **Scoring is Celo
mainnet only** (chain 42220); testnet activity does not count. ERC-8004 agent
ID **10093** on Celo mainnet (registry
`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`), auto-registered by Altana on
the first mainnet grant.

## What it does

You type a task ("search YouTube for celo", or look up an Instagram/TikTok
profile). The agent:

Approved services (5): YouTube video search, Reddit post search, Instagram
profile, TikTok profile - each 0.005 USDC per call - plus Flights search at
0.023 USDC per call. (X post search was removed 2026-11-21 ~12:31 WIB: the
buy gateway route 502s at the provider.) Each service also has a per-call
safety cap (0.01 USDC for the four data services, 0.03 USDC for flights):
the quote shows the exact price, the cap is the maximum the agent will
ever pay, and the receipt settles at the price.

1. **Quotes first** - asks buy for the exact price before any money moves.
2. **Checks the agent card** - only allowlisted (approved) services can be
   bought, each with a per-call spending cap, plus a daily cap.
3. **Pays per call over x402** with buy, in USDC on Celo. On sandbox, buy
   signs from the OS keychain and the agent never sees a key. On mainnet,
   buy's file keystore refuses mainnet, so the server signs EIP-3009
   authorizations with the Altana session key (VAULT_SESSION_KEY), held as
   a Vercel Production secret - the burn wallet itself never signs.
4. **Shows the receipt** - amount, token, settlement transaction hash, and a
   link to the explorer - and writes every payment to an append-only ledger
   (`agent/ledger.jsonl`).

## Agent Vault rules, in code

This mirrors an Agent Vault agent card:

- `ALLOWLIST` in `handler.mjs` (shared by `server.mjs` and `api/index.mjs`) -
  approved sellers only. A capability outside the list is refused with 403.
- `--max-amount` on every paid call - the per-call cap. buy refuses to sign
  above it.
- `DAILY_CAP_USD` - enforced from the ledger before each payment.
- Live production setup: an Agent Vault account exists (created 2026-11-22,
  card and Figma login saved). The agent connects through the Agent Vault
  MCP connector (open_page, fill_login, fill_checkout) and signs in to
  regular websites with mock tokens, without seeing the password or card
  number. Figma sign-in proven 2026-11-23 (see Mainnet proof below).

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
  locally (`demo/record_demo.py`). The demo video is live on YouTube (v10,
  103.5s, mainnet): https://www.youtube.com/watch?v=1Uc4fas4AwE.
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

Node.js 22+. Dependencies (see package.json): `@celo/buy`, `@vercel/kv`,
`@x402/evm`, `@x402/fetch`, and `viem`. The buy CLI does the x402 payment
flow; the agent is a thin policy + ledger layer around it.

## Known limitations

- Corridors two-leg swaps (e.g. USDC -> IDRX via USDT): fixed 2026-11-22
  after a TRANSFER_FROM_FAILED on leg 2 (09:07 UTC). Cause: after the USDT
  approve receipt, the code did not re-read the allowance before the swap
  simulation, so a stale RPC read reverted it. Fix: re-read the allowance
  until sufficient (up to 8s), retry the leg up to 3 times with a fresh
  quote on TRANSFER_FROM_FAILED, and use the real on-chain USDT balance
  (minus 10 atomic) as the leg-2 sell amount. A "Retry step 2" button now
  appears if leg 1 settled but leg 2 failed. The fix is deployed and proven
  by live two-leg runs: Pair A
  (`0xc5966dbb8e34180ba5902737c2bf109c6e5fccf084637e8b4f84fd3c21dc9403` /
  `0x504330ab6ece993ee90c03158cec35fdfe5722f135d7576dd1ae2de6d4d495a8`) and
  Pair B (`0x169ee00bcccee2e17068cc374bbae24156023828d0cc3bb7f38a6c2bd74ad9f5` /
  `0x9b594c4d3f98cfe4c1373873c743dd6c60b2a2309e01e14253cea8d483e122b7`),
  1.5 USDC to 27,566.45 IDRX, both legs Status Success on Celoscan.
- The 2-minute frontend timeout path (intermediate token never arrives) is
  untested: the wait is bounded at 120s and then shows a red X, but no live
  run has exercised that timeout.

## Proof run: USDC -> IDRX 1.5 (two-leg, after the balance-poll fix)

Recorded for the demo video. Both legs Success on Celoscan, amounts match
the on-screen modal (1.5 USDC became about 27,566.45 IDRX).
- Leg 1, USDC -> USDT:
  `0x169ee00bcccee2e17068cc374bbae24156023828d0cc3bb7f38a6c2bd74ad9f5`
- Leg 2, USDT -> IDRX:
  `0x9b594c4d3f98cfe4c1373873c743dd6c60b2a2309e01e14253cea8d483e122b7`
Route: USDC -> USDT -> IDRX (via USDT, no direct USDC-IDRX pair).
An earlier successful run of the same route (0xc5966dbb... /
0x504330ab...) is the first retest after the fix; the run above is the
recorded demo run.

## Mainnet proof - Agent Vault website sign-in and Altana revoke (2026-11-23 – 2026-11-25)

### Mainnet x402 payment (flight)
A real paid call on Celo mainnet: flight search DXB to SIN, 2026-12-06,
paid $0.023 USDC, tx
`0x349d20fc63b1364de24035433faf49b3fbd7f5f5376e215074f7063047d3e047`
(Status Success on Celoscan). This is the track's core proof: the agent
pays per call over x402 in USDC on mainnet. A second real paid call on
mainnet: flight search DXB to MAD, 2026-12-15, paid $0.023 USDC, tx
`0x2d8d5c50d7055d7e47e5c6ffc6f92b244570782a648779750d4e27d8319a1bd0`
(Status Success on Celoscan).

### Named user: Rian — flight search for a real person (2026-11-25)
A real person used the agent for a real job. **Rian** searched for flights
on the live demo site (vault.sanjayapurba.com): Jakarta (CGK) →
Yogyakarta (YIA), Thursday 17 December 2026, one-way. The agent paid
$0.023 USDC over x402 — the permanent Altana session key
(`0x54b31C517bd1bd8cC5ef0a895a3C095064c1f559`) signed the EIP-3009
transferWithAuthorization — tx
`0xa3a1cb4403cbc5d2d08c65f205e1c4d9c9b27fa8c052383b8415c60fa15a2c92`
(block 83708200, Status Success on Celoscan). Results: Lion Air JT 312 /
JT 336 / JT 314 ($60), Batik Air ID 6368 / ID 6344 ($69). This is the
named-user proof: a job done for a named person, paid on mainnet,
verifiable on Celoscan.

### Agent Vault website sign-in (Figma)
On 2026-11-23 the agent signed in to figma.com with a saved login
(blyjeje@gmail.com) using Agent Vault mock tokens, through the Agent Vault
MCP connector (open_page, fill_login 2/2, then the Figma home "Drafts"
loaded). Free sign-in, no purchase. This is the website flow for the
Agent Vault track: the agent signs in to a regular website without seeing
the password.

### Altana session revoke demo
A separate 1-day test session (0.1 USDC/day + 0.1 CELO/day, fresh key)
was granted and then revoked to demonstrate the revoke flow, without
touching the permanent 365-day session (expiry 2027-11-22, caps 0.5 USDC +
0.5 CELO per day).
- Test session grant tx:
  `0xa12ad2fca5f7a523d462a08675d6c54b96a60f9ee98160a9b4b0fe1ff151f68b`
  (block 83539578, CONFIRMED; cost 9.09 CELO).
- Revoke tx:
  `0xd58ec995c8e6bb50d66773192d9aa93ed210722524e2251fbdd348c915564dea`
  (block 83539650, Status Success).
The permanent session was not touched (different session key). Permanent
session grant tx:
`0x082b5bfaa2b6508809bbbbcc2d9adcc975cb8905615af69d88c9d8042866bbde`
(expiry 2027-11-22, caps 0.5 USDC + 0.5 CELO per day).

### Altana product review
Product review filed as a GitHub issue in the Altana SDK repo:
https://github.com/altananetwork/altana-sdk/issues/166 (5,000 XP). It covers
what worked (session grant, ERC-8004 auto-registration, session-key x402
payments, revoke), what was hard (delegation prerequisite, relay fees,
silent skip of self-sponsored authorization, keyId overwrite, revokeSession
JSON TypeError), and suggestions.

### Corridors attribution tag and IDRX payout
Corridor swap transactions now carry the hackathon attribution tag
(`celo_2da564e80a18`) as a calldata suffix, appended in
`textileSwapLegOnce`. First tagged corridor swap:
`0x9a8197f50368dca444334551b87cd0c02b6f5e2de89ccd4856a4af7048b070fe`
(2026-11-23 19:13 WIB, Status Success, tag verified at the end of the
input data). The tag was first seen on the funding swap
`0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e`
(2026-11-21, 19.5 CELO to USDC). A real IDRX payout outside the agent wallet was also sent:
500 IDRX to `0xbdeCC64F2478B2DA074DdF3FFF87d84778f60991`, tx
`0xa0ac4a0d55080052f5773c76a7b48f60c8570cde04f72d2ff14e18a2a5a94b21`
(block 83536029, Status Success).
