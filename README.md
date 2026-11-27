# Vault Checkout Agent

An agent that buys data services on Celo and pays for each call in USDC over x402, inside spending rules it cannot break: approved services only, a cap per call, and a cap per day.

Built for the Celo **Agents Open for Business** hackathon (Nov 20 – Dec 7, 2026). Entered in four tracks: Agent Vault, Stablecoin Corridors, Self Agent ID, and Altana Agent Wallets.

- **Live demo (Celo mainnet):** https://vault.sanjayapurba.com (also at https://celo-agent-vault.vercel.app; sandbox/test-USDC mode available in-app)
- **Demo video (103 s, mainnet):** https://www.youtube.com/watch?v=1Uc4fas4AwE
- **Project page:** https://www.loops.house/explore-projects/vault-checkout-agent-9e6e1

## What it does

You type a task, for example "search YouTube for celo" or a flight search. The agent then:

1. **Quotes first.** It asks the seller for the exact price before any money moves.
2. **Checks its rules.** Only allowlisted services can be bought, each with a per-call cap, plus a daily cap.
3. **Pays per call over x402** in USDC on Celo.
4. **Shows the receipt.** Amount, token, settlement transaction hash and an explorer link. Every payment is written to an append-only ledger.

Approved services:

| Service | Price per call | Per-call cap |
| --- | --- | --- |
| YouTube video search | 0.005 USDC | 0.01 USDC |
| Reddit post search | 0.005 USDC | 0.01 USDC |
| Instagram profile | 0.005 USDC | 0.01 USDC |
| TikTok profile | 0.005 USDC | 0.01 USDC |
| Flights search | 0.023 USDC | 0.03 USDC |

Daily cap for the agent: 0.5 USDC. A service outside the list is refused with HTTP 403.

## Spending rules, in code

- `ALLOWLIST` in `handler.mjs` (shared by `server.mjs` and `api/index.mjs`): approved sellers only.
- `--max-amount` on every paid call: the per-call cap.
- `DAILY_CAP_USD`: enforced from the ledger before each payment.
- Mainnet needs two flags (`VAULT_NETWORK=mainnet` and `VAULT_MAINNET_OK=1`), so real money is never spent by accident.

Who signs: on the sandbox, the `buy` CLI signs from the OS keychain. On mainnet, `buy`'s file keystore refuses mainnet, so the server signs EIP-3009 authorizations with the Altana session key (a Vercel Production secret). No key is stored in this repo.

Agent Vault: the agent connects to the Agent Vault MCP server (`open_page`, `fill_login`, `fill_checkout`) and signs in to regular websites with mock tokens, without seeing the password or card number. Proven on figma.com (see Step 4).

## How to verify (for judges)

All transactions are on Celo mainnet (chain 42220). Open each hash on `https://celoscan.io/tx/<hash>` and confirm **Status: Success**.

### 1. Demo and live site
Watch the video above, or open https://vault.sanjayapurba.com, check a price, then Pay & run. The receipt links to Celoscan.

### 2. Agent identity

#### ERC-8004 Agent Registration

Vault Checkout Agent runs on a registered ERC-8004 agent (Celo mainnet):

- Agent ID: **10093**
- Registered name: **"Altana Agent"** (the Altana agentic wallet that powers Vault Checkout Agent)
- Owner / agent wallet: `0x0D89830F241383535c3708b6c521F09Ee7cddb1e`
- Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Registration tx: `0x3eafbed0f0b4a55088b5273ef1853bd6907ce3a175a5e40027e144eb01db1cf1` (block 83411380, 22 Nov 2026, Status: Success)
- Explorer: https://celoscan.io/tx/0x3eafbed0f0b4a55088b5273ef1853bd6907ce3a175a5e40027e144eb01db1cf1

Auto-registered by Altana on the first mainnet grant. "Altana Agent" is the registration name of this same agent; the name is not changed on-chain.

- Attribution tag `celo_2da564e80a18` appears at the end of the input data of the tagged corridor swap in Step 5. x402 payments are attributed through the agent wallet address.

### 3. Named user, real job
**Rian** searched flights on the live site himself: Jakarta (CGK) → Yogyakarta (YIA), Thu 17 Dec 2026, one-way. The agent paid 0.023 USDC over x402, signed by the Altana session key. The 0.023 USDC was paid from the builder-funded vault for this demo.
Tx `0xa3a1cb4403cbc5d2d08c65f205e1c4d9c9b27fa8c052383b8415c60fa15a2c92` (block 83708200).

### 4. Agent Vault track
- **Website sign-in:** on 2026-11-23 the agent signed in to figma.com with a saved login through Agent Vault mock tokens (`fill_login` filled 2/2 fields, Figma home "Drafts" loaded). Free sign-in, no purchase.
- **Mainnet x402 payments:**
  - Flight search DXB → SIN, 2026-12-06, 0.023 USDC: `0x349d20fc63b1364de24035433faf49b3fbd7f5f5376e215074f7063047d3e047`
  - Flight search DXB → MAD, 2026-12-15, 0.023 USDC: `0x2d8d5c50d7055d7e47e5c6ffc6f92b244570782a648779750d4e27d8319a1bd0`

### 5. Stablecoin Corridors track
USDC → USDT → IDRX through Textile FX (no direct USDC–IDRX pair). Daily cap $100.
- 1.5 USDC became 27,566.45 IDRX. Leg 1: `0x169ee00bcccee2e17068cc374bbae24156023828d0cc3bb7f38a6c2bd74ad9f5`. Leg 2: `0x9b594c4d3f98cfe4c1373873c743dd6c60b2a2309e01e14253cea8d483e122b7`.
- First tagged corridor swap: `0x9a8197f50368dca444334551b87cd0c02b6f5e2de89ccd4856a4af7048b070fe`. The tag was first seen on a funding swap, `0xb89e553057f9e1b3b1535889402164f394796bf8b23a65e957e4372197bf5f6e` (2026-11-21).
- IDRX payout of 500 IDRX to a recipient outside the team: `0xa0ac4a0d55080052f5773c76a7b48f60c8570cde04f72d2ff14e18a2a5a94b21` (block 83536029).

### 6. Altana track
- Permanent session grant (expires 2027-11-22, caps 0.5 USDC + 0.5 CELO per day): `0x082b5bfaa2b6508809bbbbcc2d9adcc975cb8905615af69d88c9d8042866bbde`
- Revoke demo, with a separate 1-day test session: grant `0xa12ad2fca5f7a523d462a08675d6c54b96a60f9ee98160a9b4b0fe1ff151f68b`, revoke `0xd58ec995c8e6bb50d66773192d9aa93ed210722524e2251fbdd348c915564dea`. The permanent session was not touched.
- Product review: https://github.com/altananetwork/altana-sdk/issues/166

### 7. Self Agent ID track
Testnet is done: agentId **96** on Celo Sepolia. Mainnet registration is waiting for a passport, because the mainnet registry does not accept an Indonesian KTP. Until then, the agent's mainnet identity is ERC-8004 #10093.

## Run it

Requires Node.js 22+ and the `buy` CLI.

```sh
npm install -g @celo/buy@0.8.5
npm start
```

Open http://localhost:8787. The default network is the Celo Sepolia sandbox: test USDC, free from the faucet, no wallet setup.

Mainnet (real money):

```sh
VAULT_NETWORK=mainnet VAULT_MAINNET_OK=1 npm start
```

Copy `.env.example` and set secrets as environment variables. Never commit keys.

## Testing

Automated tests cover the payment flow (quote, Pay & run, receipt parsing) and the agent flow (catalog allowlist, ledger, corridor validation), using Node's built-in `node:test` runner. No extra test dependencies.

```sh
npm ci
npm test
```

Tests never touch the real ledger, the network, real keys, or mainnet. The `buy` CLI is replaced by a fake (`test/fake-buy.mjs`, via `BUY_BIN`), HTTP calls are mocked, and the ledger uses a temporary file that is deleted afterwards. Mainnet paths are not tested: they need real keys and real money. `test-mainnet-direct.mjs` is a manual mainnet script, not part of the test suite.

## Stack

Node.js 22+, `@celo/buy`, `@x402/core`, `@x402/evm`, `@x402/fetch`, `@vercel/kv`, `viem`. The `buy` CLI runs the x402 payment flow. The agent is a thin policy and ledger layer around it.

## Known limitations

- The 2-minute frontend timeout for a corridor swap (when the intermediate token never arrives) is bounded at 120 s and shows a red X, but no live run has exercised it.
- Corridor leg 2 once failed with `TRANSFER_FROM_FAILED` because of a stale allowance read. It now re-reads the allowance, retries with a fresh quote, and offers a "Retry step 2" button. Two live runs passed after the fix.
- X (Twitter) post search was removed from the allowlist because the provider route returned HTTP 502.
- Self Agent ID is testnet only (see Step 7).
- Mainnet endpoints (`/api/run`, `/api/corridor-convert`) are public and unauthenticated by design for this demo. Spending is bounded by per-call caps, a $0.50/day cap for data services and a $100/day cap for corridors. Corridor swaps are signed by the agent wallet, which is the taker of each swap.
- Daily caps are checked per request and are not atomic, so concurrent requests can slightly exceed them.
- A later corridor leg (leg > 0) sells the on-chain balance of the intermediate token rather than the requested amount; the output stays in the agent wallet.

## License

MIT
