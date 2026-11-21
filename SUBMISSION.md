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

## Proof (sandbox, Celo Sepolia, test USDC)

- Quote: live 402 offers, YouTube search 0.005 USDC.
- Settled: tx `0x35de96ba0ce0af2db82699ed6f73de6c5466d8a56feb46430001c89eae35a989`,
  0.005 USDC, 20 YouTube results.
- Settled through the agent UI: tx
  `0x8ce72a7e568df84b8cbca387c99b15bd6afed8c8b1619a0a232822da358ff71c`,
  0.005 USDC, 20 YouTube results.
- Demo video: `demo/page@ce3824867e0238a39667fe76a011c7b5.webm` (24.7s).
- Policy proof: a capability outside the allowlist is refused with 403.

## Proof (mainnet — TODO)

- [ ] Fund the agent wallet with a few USDC on Celo mainnet (owner's step).
- [ ] Run one real paid call on mainnet, record the Celoscan tx link.
- [ ] Upload the demo video to YouTube, add the link here.

## Registration — Loops House (confirmed 2026-11-21)

- Platform: **Loops House**, event "Agents Open for Business". Enrollment is
  Step 2 of 2; the owner clicks **Enroll** on the event page.
- **Attribution tag: `celo_2da564e80a18`** — must be in every transaction the
  agent sends directly; untagged transactions are never credited, no backfill.
  For x402 payments through buy, attribution rides the agent wallet address
  (the facilitator sends the settlement tx, so the tag cannot be attached
  to it).
- **Scoring is mainnet only** (Celo chain 42220). Testnet activity does not
  count. Gas in CELO, or fees paid in stablecoins.
- **One agent wallet** for the whole event; the score is tied to its address.
  The address is entered at submit time (or from the Celo button in the
  playground). Register its **ERC-8004 identity** from that wallet before
  the deadline.
- [ ] Owner clicks Enroll on Loops House.
- [ ] Agent wallet (mainnet) created/funded; address entered at submit.
- [ ] ERC-8004 identity registered from the agent wallet.
- [ ] Direct transactions carry the tag (via `toDataSuffix`); x402 calls
  attribute via the wallet address.
- [ ] Post on X tagging @CeloDevs + @Celo with the repo link — from the
  owner's OTHER X account (not @Beinztepn); needs his explicit go and the
  account handle.

## Draft X post (needs owner's go before posting)

> Building for the @CeloDevs Agents Open for Business hackathon 🟡
> Vault Checkout Agent — an agent that checks out and pays for data
> services on Celo under Agent Vault rules. Paid proof onchain:
> [tx link] Repo: https://github.com/je26/celo-vault-checkout-agent @celo
