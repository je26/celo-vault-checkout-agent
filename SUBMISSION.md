# Submission - Agents Open for Business (Celo)

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

- **https://vault.sanjayapurba.com** - the agent running on Celo mainnet
  (project `celo-agent-vault-mainnet`, team bambang9). Type a task, check
  the price, then Pay & run; the payment settles in USDC on Celo mainnet
  with a receipt and a Celoscan link. This is the demo the hackathon
  scores: mainnet only.
- Testnet / sandbox deployment: https://celo-agent-vault.vercel.app
  (project `celo-agent-vault`, team bambang9) - permanent. Deployed
  2026-11-21 ~12:57 WIB with 5 services (YouTube, Reddit, Instagram,
  TikTok, Flights). First paid call from it settled 2026-11-21:
  tx `0xee1a4ac94f08547ecb43e6a18d32a5e732e517e4be949d6de8c38d02f010440f` (0.005 test USDC, YouTube search). The function auto-creates its own
  sandbox wallet and is auto-funded from the faucet; no private key is
  shipped or stored in the repo.
- Demo video (English, v10, 103.5s, MP4, mainnet):
  https://www.youtube.com/watch?v=1Uc4fas4AwE

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
- Demo video (English, v10, 103.5s, MP4, mainnet):
  https://www.youtube.com/watch?v=1Uc4fas4AwE
- Policy proof: a capability outside the allowlist is refused with 403.

## Proof (mainnet)

- [x] Fund the agent wallet with a few USDC on Celo mainnet - DONE 2026-11-21
  (owner funded it; verified live on Forno: 22.5149 CELO + 1.017749 USDC,
  after swapping 19.5 CELO to USDC, tx
  `0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e`).
- [x] Run one real paid call on mainnet - DONE 2026-11-22: flight search
  DXB to SIN, 2026-12-06, paid $0.023 USDC, tx
  `0x349d20fc63b1364de24035433faf49b3fbd7f5f5376e215074f7063047d3e047`
  (Status Success on Celoscan).
- [x] Upload the demo video to YouTube - DONE 2026-11-23: v10, 103.5s,
  mainnet, https://www.youtube.com/watch?v=1Uc4fas4AwE

## Registration - Loops House (confirmed 2026-11-21)

- Platform: **Loops House**, event "Agents Open for Business". Enrolled
  2026-11-21; project SUBMITTED 2026-11-23 (see below).
- Enroll URL: https://www.loops.house/agents-open-for-business/enroll
- Loops CLI skill INSTALLED 2026-11-21 ~11:33 WIB in the project
  (`.agents/skills/loops-agents-open-for-business/SKILL.md`, CLI v0.7.1).
  Auth DONE 2026-11-21 ~11:38 WIB via email code to blyjeje@gmail.com
  (authenticated: true, userId `594a0b98-afe7-41b4-bf58-6e4adf4515b5`).
- **Attribution tag: `celo_2da564e80a18`** - must be in every transaction the
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
- [x] Owner clicks Enroll on Loops House. - DONE 2026-11-21 ~11:31 WIB (email Loops House: "You're enrolled in Agents Open for Business", Jejeje26).
- [x] Agent wallet (mainnet) created/funded; address entered at submit.
  - Address (burner, made by the owner 2026-11-21): `0x0D89830F241383535c3708b6c521F09Ee7cddb1e`.
  - Verified live on Celo mainnet (Forno, 2026-11-21 ~12:37): 22.5149 CELO +
    1.017749 USDC, 5 txs. Funded by the owner, then 19.5 CELO swapped to
    1.017749 USDC (tx
    `0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e`).
  - SUBMITTED in Loops 2026-11-23: projectId
    `47e87138-57cd-5332-8f31-2d6bb33603f9`, slug `vault-checkout-agent-9e6e1`,
    public URL
    https://www.loops.house/explore-projects/vault-checkout-agent-9e6e1.
- [x] ERC-8004 identity registered from the agent wallet - DONE: agent ID
  10093 on Celo mainnet (registry
  `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`), auto-registered by Altana
  on the first mainnet grant.
- [x] Direct transactions carry the tag (via `toDataSuffix`); x402 calls
  attribute via the wallet address - DONE: tag implemented in
  `textileSwapLegOnce`, proven on tx
  `0x9a8197f50368dca444334551b87cd0c02b6f5e2de89ccd4856a4af7048b070fe`
  (2026-11-23 19:13 WIB, Status Success, tag verified at the end of the
  input data).
- [x] Post on X tagging @selfxyz and @Celo with the repo link - DONE
  2026-11-23, posted from @Beinztepn:
  https://x.com/Beinztepn/status/2124833995083162035 (demo video attached).

## Submission fields (from the Loops skill - authoritative)

Track: Agent Vault, bounties 1st $700 (`4379f770-3b52-4bb9-93cf-a2853765658f`),
2nd $300 (`ddee9cee-4065-43cd-a43b-c74aa9b55e74`). Judging: integration 30%,
innovation/value 30%, named user + real job 25%, real use 15%.
ERC-8004 registry (mainnet): `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
Required extra fields: agent-wallet, team contacts, payout wallet on Celo,
ERC-8004 agent ID, Self Agent ID (mainnet agentId), attribution tag, named
user, founder/project X handles, follow @Celo + @CeloDevs on X.
Self Agent ID caveat: only a Sepolia testnet Self ID exists (agentId 96);
mainnet registration is blocked because the owner's KTP is rejected by the
registry, and mainnet needs a passport, which he does not have. Submitted
in Loops as testnet 96 with this note.
Agent Vault integration (live): the account exists (created 2026-11-22,
Visa ending 8203, Figma login saved). The agent connects through the Agent
Vault MCP connector and signed in to figma.com on 2026-11-23 (session
`s_da500f7fe4306b032f583af9147c4de8`, fill_login 2/2, Figma home "Drafts"
loaded). The integration is documented on the demo site.
Submission flow: `loops project fields` first, then `loops project create`
WITHOUT --confirm (draft), show the draft, re-run with --confirm only
after the owner's yes. Then `loops evaluate --sponsor agent-vault`.

## X post (posted 2026-11-23 from @Beinztepn)

> Vault Checkout Agent is live on @Celo mainnet. My AI agent pays for its
> own work in USDC via x402, and swaps USDC to rupiah (IDRX) and back.
> Demo: https://vault.sanjayapurba.com
> Repo: https://github.com/je26/celo-vault-checkout-agent @selfxyz
>
> https://x.com/Beinztepn/status/2124833995083162035 (demo video attached)
