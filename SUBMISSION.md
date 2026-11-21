# Submission — Agents Open for Business (Celo)

- **Project:** Vault Checkout Agent
- **Track:** Online and Onchain Checkouts w/ Agent Vault ($1,000)
- **Repo:** https://github.com/je26/celo-vault-checkout-agent
- **Deadline:** Dec 7, 2026, 09:00 GMT (16:00 WIB)
- **Builder:** jejeje26 (GitHub je26, Telegram @ojansale)

## What it is

An agent that does one real job: buy a data service on Celo and pay for it
per call over x402 with buy, under Agent Vault rules. The user types a task,
the agent quotes first, checks the agent card (allowlisted services only,
per-call cap, daily cap), pays in USDC, and shows the receipt with the
settlement transaction hash.

## Live demo

- **https://turbo-agate-o4df0vp.tmp.now** — Vercel serverless, sandbox.
  Temporary deployment (2026-11-21 ~12:42 WIB, 4 services: YouTube, Reddit,
  Instagram, TikTok); claim it into the owner's Vercel account to keep it
  permanent. First paid call from it settled 2026-11-21:
  tx `0x3f2edae9740c54bd6432453d42acd73994786220c2f9323bce6d7bd4ad5a64f9`
  (0.005 test USDC, Instagram profile @nasa). The function auto-creates its own
  sandbox wallet and is auto-funded from the faucet; no private key is
  shipped or stored in the repo.
- Demo video (English, 28.7s, MP4): recorded locally; the file is not in
  this repo (binary), it will be uploaded to YouTube and linked here.

## Proof (sandbox, Celo Sepolia, test USDC)

- Quote: live 402 offers, YouTube search 0.005 USDC.
- Settled: tx `0x35de96ba0ce0af2db82699ed6f73de6c5466d8a56feb46430001c89eae35a989`,
  0.005 USDC, 20 YouTube results.
- Settled through the agent UI: tx
  `0x8ce72a7e568df84b8cbca387c99b15bd6afed8c8b1619a0a232822da358ff71c`,
  0.005 USDC, 20 YouTube results.
- Three more services verified settled (2026-11-21 ~12:15 WIB, 0.005 USDC
  each): Reddit post search "celo" (tx
  `0x381f333e235110a4ee6f65fb0bbc067b19037054c1ca0c878508e7b372706d15`, 7 posts),
  Instagram profile @nasa (tx
  `0x12ec03f3077498b4ec1dbab18f78a314b2150ba9e8f40dc529c47ddd9ebc0772`,
  104,325,121 followers), TikTok profile @nasa (tx
  `0x5767fbfd7e77d13702a1ec0d20f8900da12ca2373a3a6e34dd577afc6b3faf98`,
  2,200,000 followers).
- Demo video (English, 28.7s, MP4): recorded locally; the file is not in
  this repo (binary), it will be uploaded to YouTube and linked here.
- Policy proof: a capability outside the allowlist is refused with 403.

## Proof (mainnet — TODO)

- [x] Fund the agent wallet with a few USDC on Celo mainnet — DONE 2026-11-21
  (owner funded it; verified live on Forno: 22.5149 CELO + 1.017749 USDC,
  after swapping 19.5 CELO to USDC, tx
  `0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e`).
- [ ] Run one real paid call on mainnet, record the Celoscan tx link.
- [ ] Upload the demo video to YouTube, add the link here.

## Registration — Loops House (confirmed 2026-11-21)

- Platform: **Loops House**, event "Agents Open for Business". Enrollment is
  Step 2 of 2; the owner clicks **Enroll** on the event page.
- Enroll URL: https://www.loops.house/agents-open-for-business/enroll
- Loops CLI skill INSTALLED 2026-11-21 ~11:33 WIB in the project
  (`.agents/skills/loops-agents-open-for-business/SKILL.md`, CLI v0.7.1).
  Auth DONE 2026-11-21 ~11:38 WIB via email code to blyjeje@gmail.com
  (authenticated: true, userId `594a0b98-afe7-41b4-bf58-6e4adf4515b5`).
- **Attribution tag: `celo_2da564e80a18`** — must be in every transaction the
  agent sends directly; untagged transactions are never credited, no backfill.
  Confirmed by the platform via `loops project get` (2026-11-21 ~11:38).
  dataSuffix to append to direct tx data:
  `0x63656c6f5f326461353634653830613138110080218021802180218021802180218021`.
  For x402 payments through buy, attribution rides the agent wallet address
  (the facilitator sends the settlement tx, so the tag cannot be attached
  to it).
- **Scoring is mainnet only** (Celo chain 42220). Testnet activity does not
  count. Gas in CELO, or fees paid in stablecoins.
- **One agent wallet** for the whole event; the score is tied to its address.
  The address is entered at submit time (or from the Celo button in the
  playground). Register its **ERC-8004 identity** from that wallet before
  the deadline.
- [x] Owner clicks Enroll on Loops House. — DONE 2026-11-21 ~11:31 WIB (email Loops House: "You're enrolled in Agents Open for Business", Jejeje26).
- [x] Agent wallet (mainnet) created/funded; address entered at submit.
  - Address (burner, made by the owner 2026-11-21): `0x0D89830F241383535c3708b6c521F09Ee7cddb1e`.
  - Verified live on Celo mainnet (Forno, 2026-11-21 ~12:37): 22.5149 CELO +
    1.017749 USDC, 5 txs. Funded by the owner, then 19.5 CELO swapped to
    1.017749 USDC (tx
    `0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e`).
  - NOT yet registered in Loops; register at project create/submit time.
- [ ] ERC-8004 identity registered from the agent wallet.
- [ ] Direct transactions carry the tag (via `toDataSuffix`); x402 calls
  attribute via the wallet address.
- [ ] Post on X tagging @CeloDevs + @Celo with the repo link — from the
  owner's OTHER X account (not @Beinztepn); needs his explicit go and the
  account handle.

## Submission fields (from the Loops skill — authoritative)

Track: Agent Vault, bounties 1st $700 (`4379f770-3b52-4bb9-93cf-a2853765658f`),
2nd $300 (`ddee9cee-4065-43cd-a43b-c74aa9b55e74`). Judging: integration 30%,
innovation/value 30%, named user + real job 25%, real use 15%.
ERC-8004 registry (mainnet): `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
Required extra fields: agent-wallet, team contacts, payout wallet on Celo,
ERC-8004 agent ID, Self Agent ID (mainnet agentId), attribution tag, named
user, founder/project X handles, follow @Celo + @CeloDevs on X.
OPEN QUESTIONS: (1) Self Agent ID is listed required — Jeje has KTP only,
no passport; verify whether the Agent Vault track really needs it.
(2) Agent Vault integration gap: the agent pays via buy x402 but has no
Agent Vault account/wallet yet (owner creates it at app.agentvault.io);
the track's "Quality of the integration" (30%) needs Agent Vault central,
not an add-on.
Submission flow: `loops project fields` first, then `loops project create`
WITHOUT --confirm (draft), show the draft, re-run with --confirm only
after the owner's yes. Then `loops evaluate --sponsor agent-vault`.

## Draft X post (needs owner's go before posting)

> Building for the @CeloDevs Agents Open for Business hackathon 🟡
> Vault Checkout Agent — an agent that checks out and pays for data
> services on Celo under Agent Vault rules. Live demo:
> https://turbo-agate-o4df0vp.tmp.now — paid proof onchain:
> https://celo-sepolia.blockscout.com/tx/0x3f2edae9740c54bd6432453d42acd73994786220c2f9323bce6d7bd4ad5a64f9
> Repo: https://github.com/je26/celo-vault-checkout-agent @celo
