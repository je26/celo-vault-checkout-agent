# Submission: Agents Open for Business (Celo)

- **Project:** Vault Checkout Agent
- **Builder:** jejeje26 (GitHub: je26)
- **Repo:** https://github.com/je26/celo-vault-checkout-agent
- **Deadline:** Dec 7, 2026, 09:00 GMT (16:00 WIB)
- **Tracks entered:** Agent Vault, Stablecoin Corridors, Self Agent ID, Altana Agent Wallets (a project can win in at most two)

## What it is

An agent that does one real job: buy a data service on Celo and pay for it per call over x402, inside spending rules. The user types a task. The agent quotes the price, checks its rules (approved services only, per-call cap, daily cap), pays in USDC, and shows a receipt with the settlement transaction hash.

## Links

- Live demo (Celo mainnet, the version that is scored): https://vault.sanjayapurba.com
- Sandbox deployment (test USDC): https://celo-agent-vault.vercel.app
- Demo video (English, 103 s, recorded on mainnet): https://www.youtube.com/watch?v=1Uc4fas4AwE
- Project page: https://www.loops.house/explore-projects/vault-checkout-agent-9e6e1
- Launch post on X: https://x.com/Beinztepn/status/2124833995083162035

## Identity and attribution

- Agent wallet (Celo mainnet): `0x0D89830F241383535c3708b6c521F09Ee7cddb1e`
- ERC-8004 agent ID: **10093** (registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`), auto-registered by Altana on the first mainnet grant. The owner address shown on 8004scan is `0x08eef13fd03088ae1db72ed84a7eed7b255cbfe1`, which is not the agent wallet above.
- Attribution tag: `celo_2da564e80a18`. Direct transactions carry it as a calldata suffix. x402 payments are attributed through the agent wallet address.
- Self Agent ID: testnet agentId 96 (see "Known gap" below)

## Proof on mainnet

| What | Detail | Tx |
| --- | --- | --- |
| Named user, real job | Rian: flight search CGK → YIA, 17 Dec 2026, 0.023 USDC | `0xa3a1cb4403cbc5d2d08c65f205e1c4d9c9b27fa8c052383b8415c60fa15a2c92` |
| Paid call 1 | Flight search DXB → SIN, 0.023 USDC | `0x349d20fc63b1364de24035433faf49b3fbd7f5f5376e215074f7063047d3e047` |
| Paid call 2 | Flight search DXB → MAD, 0.023 USDC | `0x2d8d5c50d7055d7e47e5c6ffc6f92b244570782a648779750d4e27d8319a1bd0` |
| Website sign-in | figma.com through Agent Vault mock tokens, login filled 2/2, Figma home loaded (2026-11-23) | none (free) |
| Corridors, leg 1 | USDC → USDT | `0x169ee00bcccee2e17068cc374bbae24156023828d0cc3bb7f38a6c2bd74ad9f5` |
| Corridors, leg 2 | USDT → IDRX (1.5 USDC became 27,566.45 IDRX) | `0x9b594c4d3f98cfe4c1373873c743dd6c60b2a2309e01e14253cea8d483e122b7` |
| First tagged corridor swap | Attribution tag verified in calldata (tag first seen on funding swap `0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e`, 2026-11-21) | `0x9a8197f50368dca444334551b87cd0c02b6f5e2de89ccd4856a4af7048b070fe` |
| IDRX payout | 500 IDRX to a recipient outside the team | `0xa0ac4a0d55080052f5773c76a7b48f60c8570cde04f72d2ff14e18a2a5a94b21` |
| Altana session grant | Expires 2027-11-22, caps 0.5 USDC + 0.5 CELO per day | `0x082b5bfaa2b6508809bbbbcc2d9adcc975cb8905615af69d88c9d8042866bbde` |
| Altana revoke demo | Separate 1-day test session, granted then revoked | grant `0xa12ad2fca5f7a523d462a08675d6c54b96a60f9ee98160a9b4b0fe1ff151f68b`, revoke `0xd58ec995c8e6bb50d66773192d9aa93ed210722524e2251fbdd348c915564dea` |

The 0.023 USDC for Rian's flight search was paid from the builder-funded vault for this demo.

Altana product review: https://github.com/altananetwork/altana-sdk/issues/166

Open each hash on https://celoscan.io and confirm Status: Success.

## Sandbox proof (Celo Sepolia, test USDC)

- Live 402 quote: YouTube search 0.005 USDC.
- Settled calls: `0x35de96ba0ce0af2db82699ed6f73de6c5466d8a56feb46430001c89eae35a989` and `0x8ce72a7e568df84b8cbca387c99b15bd6afed8c8b1619a0a232822da358ff71c` (YouTube), `0x381f333e235110a4ee6f65fb0bbc067b19037054c1ca0c878508e7b372706d15` (Reddit), `0x12ec03f3077498b4ec1dbab18f78a314b2150ba9e8f40dc529c47ddd9ebc0772` (Instagram), `0x5767fbfd7e77d13702a1ec0d20f8900da12ca2373a3a6e34dd577afc6b3faf98` (TikTok).
- Policy proof: a service outside the allowlist is refused with HTTP 403.

## Known gap

Self Agent ID is registered on testnet only (agentId 96, Celo Sepolia). Mainnet registration needs a passport, because the mainnet registry does not accept an Indonesian KTP. This track is therefore the weakest of the four, and the project's mainnet identity is ERC-8004 #10093.
