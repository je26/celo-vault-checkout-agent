// Vault Checkout Agent — shared request handler.
// Used by server.mjs (local dev) and api/index.mjs (Vercel serverless).
//
// Rules (mirrors an Agent Vault agent card):
//   - only allowlisted capabilities (approved sellers) can be bought
//   - every paid call carries a per-call spending cap (--max-amount)
//   - a daily spending cap is enforced from the append-only ledger
//   - the agent never sees a private key: buy signs from the keystore
//
// Network defaults to the Celo Sepolia sandbox (test USDC, free faucet).
// Mainnet needs VAULT_NETWORK=mainnet AND VAULT_MAINNET_OK=1, so real money
// is never spent by accident.
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http as viemHttp, toHex } from 'viem';
import { celo } from 'viem/chains';
import crypto from 'node:crypto';
import { createClient } from '@vercel/kv';

// Durable ledger (Vercel KV / Upstash Redis). Created via the Vercel
// Marketplace (Upstash); the store's REST credentials arrive as
// KV_REST_API_URL + KV_REST_API_TOKEN. When they are absent the ledger
// falls back to the committed seed + /tmp file (see ledgerEntries).
// Sandbox keeps the original key; mainnet gets its own list so the two
// networks never share a daily cap or history.
const KV_LEDGER_KEY = process.env.VAULT_NETWORK === 'mainnet' ? 'vault:ledger:mainnet' : 'vault:ledger';
let kvClient = null;
function getKv() {
  if (kvClient) return kvClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    kvClient = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    return kvClient;
  } catch { return null; }
}

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NETWORK = process.env.VAULT_NETWORK === 'mainnet' ? 'mainnet' : 'sandbox';
if (NETWORK === 'mainnet' && process.env.VAULT_MAINNET_OK !== '1') {
  throw new Error('Mainnet requested without VAULT_MAINNET_OK=1. Refusing to start.');
}
const SANDBOX = NETWORK === 'sandbox';

// Hackathon attribution (Loops House, "Agents Open for Business").
// Every transaction the agent sends directly must carry this ERC-8021 tag.
// x402 settlements go through buy's facilitator, which sends the settlement
// tx itself, so those attribute via the agent wallet address instead — the
// wallet registered at submission time.
const ATTRIBUTION_TAG = 'celo_2da564e80a18';

// Agent card: approved sellers and their per-call caps (USDC).
// bodyKey is the request-body field the gateway expects for that service.
const ALLOWLIST = {
  'youtube.videos.search': {
    url: 'https://gateway.usebuy.ai/v1/social/youtube/videos/search',
    maxUsd: 0.01,
    title: 'Search YouTube videos',
    bodyKey: 'query',
    inputLabel: 'Task / keywords',
  },
  'reddit.posts.search': {
    url: 'https://gateway.usebuy.ai/v1/social/reddit/posts/search',
    maxUsd: 0.01,
    title: 'Search Reddit',
    bodyKey: 'query',
    inputLabel: 'Task / keywords',
  },
  'instagram.profile': {
    url: 'https://gateway.usebuy.ai/v1/social/instagram/profile',
    maxUsd: 0.01,
    title: 'Read an Instagram profile',
    bodyKey: 'username',
    inputLabel: 'Username (without @)',
  },
  'tiktok.profile': {
    url: 'https://gateway.usebuy.ai/v1/social/tiktok/profile',
    maxUsd: 0.01,
    title: 'Read a TikTok profile',
    bodyKey: 'username',
    inputLabel: 'Username (without @)',
  },
  'flights.search': {
    url: 'https://gateway.usebuy.ai/v1/travel/flights/search',
    maxUsd: 0.03,
    title: 'Search flights',
    bodyKey: 'origin',
    inputLabel: 'Origin airport (IATA)',
    multi: ['origin', 'destination', 'date'],
    inputLabels: {
      origin: 'Origin airport (IATA, e.g. CGK)',
      destination: 'Destination airport (IATA, e.g. SIN)',
      date: 'Departure date (YYYY-MM-DD)',
    },
  },
};
const DAILY_CAP_USD = 0.5;

// Ledger: local file in dev, /tmp on serverless (set LEDGER_PATH there).
const LEDGER = process.env.LEDGER_PATH || path.join(__dirname, 'agent', 'ledger.jsonl');

// Seed: verified past payments, committed in the repo so every visitor
// sees real history even though serverless /tmp does not persist.
const LEDGER_SEED = path.join(__dirname, 'agent', 'ledger-seed.jsonl');

async function ledgerEntries() {
  // Read the deployed ledger, the committed seed, the /tmp fallback
  // (serverless writes go there when the deployed path is read-only),
  // and the durable KV list when configured — deduplicated by txHash.
  const seen = new Set();
  const out = [];
  const push = (e) => {
    if (!e || typeof e !== 'object') return;
    // Entries are tagged with their network; never mix networks in one ledger.
    if (e.network && e.network !== NETWORK) return;
    const k = (e.ts || '') + '|' + (e.capabilityId || '') + '|' + (e.txHash || '');
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  for (const p of [LEDGER, LEDGER_SEED, '/tmp/ledger.jsonl']) {
    try {
      if (!fs.existsSync(p)) continue;
      for (const l of fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)) {
        push(JSON.parse(l));
      }
    } catch { /* ignore a bad ledger file */ }
  }
  const kv = getKv();
  if (kv) {
    try {
      const items = await kv.lrange(KV_LEDGER_KEY, 0, -1);
      for (const raw of items || []) push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch { /* KV unreachable: file sources above still apply */ }
  }
  return out;
}

async function spentTodayUsd() {
  // The $0.50/day cap covers only the 5 Agent Vault services. Corridor
  // conversions have their own $50/day cap and must not inflate this
  // number, or the ledger reads "Spent today $21 of $0.5 cap".
  const today = new Date().toISOString().slice(0, 10);
  return (await ledgerEntries())
    .filter((e) => e.status === 'settled' && e.ts.startsWith(today) && e.kind !== 'corridor')
    .reduce((s, e) => s + Number(e.priceUsd || 0), 0);
}

function appendLedger(entry) {
  // A ledger write must never crash a payment: the payment result is what
  // matters. On serverless the deployed files are read-only, so fall back
  // to /tmp when the configured path is not writable.
  const line = JSON.stringify(entry) + '\n';
  const candidates = [LEDGER];
  if (LEDGER !== '/tmp/ledger.jsonl') candidates.push('/tmp/ledger.jsonl');
  let wrote = false;
  for (const p of candidates) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.appendFileSync(p, line);
      wrote = true;
      break;
    } catch { /* try the next path */ }
  }
  if (!wrote) console.error('ledger file write failed for', entry.capabilityId);
  // Durable copy in KV (fire-and-forget: a KV failure must never delay
  // or break the payment response).
  const kv = getKv();
  if (kv) {
    kv.rpush(KV_LEDGER_KEY, line.trim()).catch(() => { /* KV write failed; file copy above still applies */ });
  }
}

// Resolve the buy CLI: explicit BUY_BIN, else the bundled @celo/buy package,
// else `buy` from PATH.
function buyCommand() {
  if (process.env.BUY_BIN) return { cmd: process.env.BUY_BIN, prefix: [] };
  const bundled = path.join(__dirname, 'node_modules', '@celo', 'buy', 'dist', 'main.js');
  if (fs.existsSync(bundled)) return { cmd: process.execPath, prefix: [bundled] };
  return { cmd: 'buy', prefix: [] };
}

function buyArgs(sub, url, bodyJson, extra = []) {
  const args = [];
  if (SANDBOX) args.push('--sandbox');
  args.push(sub, '-X', 'POST', url, '-H', 'content-type: application/json', '-d', bodyJson);
  return args.concat(extra);
}

async function runBuy(args) {
  const { cmd, prefix } = buyCommand();
  try {
    const { stdout } = await execFileAsync(cmd, [...prefix, ...args], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    return { ok: true, out: stdout };
  } catch (err) {
    // buy exits non-zero on provider errors but still prints JSON.
    return { ok: false, out: (err.stdout || '') + (err.stderr || ''), code: err.code };
  }
}

// Mainnet direct x402: buy's file keystore refuses mainnet, so the agent
// signs EIP-3009 authorizations itself and pays the buy gateway through
// @x402/fetch. The payer is the Altana SESSION KEY (VAULT_SESSION_KEY), a
// plain EOA holding its own USDC (funded from the agent wallet via the
// session, 0.5 USDC/day cap). The burn wallet itself is delegated to Porto
// for the Altana session, and a delegated wallet CANNOT sign EIP-3009:
// USDC's transferWithAuthorization calls ERC-1271 isValidSignature on the
// delegation, which returns invalid (0xffffffff). So the session key pays;
// the burn wallet remains the agent wallet and Altana session owner.
// Returns { ok, out } shaped like runBuy.
let mainnetFetch = null;
function getMainnetFetch() {
  if (mainnetFetch) return mainnetFetch;
  const key = process.env.VAULT_SESSION_KEY || process.env.VAULT_BURNER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('VAULT_SESSION_KEY env var missing or malformed.');
  }
  const account = privateKeyToAccount(key);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  mainnetFetch = wrapFetchWithPayment(fetch, client);
  return mainnetFetch;
}

async function runMainnetDirect(url, bodyJson) {
  try {
    const f = getMainnetFetch();
    const res = await f(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bodyJson,
    });
    const out = await res.text();
    return { ok: res.status === 200, out };
  } catch (err) {
    return { ok: false, out: String(err.message || err) };
  }
}

function mainnetWalletAddress() {
  // The agent wallet (Altana session owner). The x402 payer is the session
  // key, a separate plain EOA; see getMainnetFetch.
  const key = process.env.VAULT_BURNER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return privateKeyToAccount(key).address;
}

// Live mainnet balances for the agent wallet (CELO + USDC + USDT + IDRX),
// read from Forno. Used by /api/wallet so the Altana pane and wallet card
// show real numbers, and by the Corridors Max button.
const MAINNET_USDC = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C';
const MAINNET_USDT = '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e';
const MAINNET_IDRX = '0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22';
// Fast balances, Uniswap-style: two cache layers so the UI never waits on
// Forno. The in-memory cache (5s) covers repeat calls in one serverless
// instance; the KV cache (10s TTL, shared by ALL instances) covers the
// rest. A KV hit returns instantly and refreshes in the background, so the
// balance shows at once and a swap's result still appears within seconds.
// 10s is short enough that a balance changed by a swap shows up almost
// immediately.
const BAL_KV_KEY = 'vault:balances:mainnet';
let balCache = { at: 0, addr: '', value: null };
// RPC endpoints for balance reads. Ankr first (often faster and more
// reliable than Forno), Forno as fallback. Both return the same data;
// if Ankr fails or times out (5s), Forno is tried instead.
const RPC_ENDPOINTS = ['https://rpc.ankr.com/celo', 'https://forno.celo.org'];
async function fetchBalancesFromForno(address) {
  const call = async (method, params) => {
    let lastErr = null;
    for (const url of RPC_ENDPOINTS) {
      try {
        const r = await fetch(url, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
          signal: AbortSignal.timeout(5000),
        });
        const j = await r.json();
        if (j.result != null) return j.result;
        lastErr = new Error('no result from ' + url);
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('all RPC endpoints failed');
  };
  const balOf = (token) => call('eth_call', [{ to: token, data: '0x70a08231' + address.slice(2).padStart(64, '0') }, 'latest']);
  // All four reads in parallel; sequential awaits made the wallet card slow.
  const [celoHex, usdcHex, usdtHex, idrxHex] = await Promise.all([
    call('eth_getBalance', [address, 'latest']),
    balOf(MAINNET_USDC), balOf(MAINNET_USDT), balOf(MAINNET_IDRX),
  ]);
  return {
    celo: Number(BigInt(celoHex)) / 1e18,
    usdc: Number(BigInt(usdcHex)) / 1e6,
    usdt: Number(BigInt(usdtHex)) / 1e6,
    idrx: Number(BigInt(idrxHex)) / 1e2,
  };
}
async function mainnetBalances(address) {
  if (balCache.value && balCache.addr === address && Date.now() - balCache.at < 5000) return balCache.value;
  const kv = getKv();
  // Shared KV cache: return at once, refresh in the background.
  if (kv) {
    try {
      const raw = await kv.get(BAL_KV_KEY);
      if (raw) {
        const out = typeof raw === 'string' ? JSON.parse(raw) : raw;
        balCache = { at: Date.now(), addr: address, value: out };
        // Background refresh so the next read is fresh; never blocks the reply.
        fetchBalancesFromForno(address).then(fresh => {
          balCache = { at: Date.now(), addr: address, value: fresh };
          kv.set(BAL_KV_KEY, JSON.stringify(fresh), { ex: 10 }).catch(() => {});
        }).catch(() => {});
        return out;
      }
    } catch { /* fall through to a live read */ }
  }
  try {
    const out = await fetchBalancesFromForno(address);
    balCache = { at: Date.now(), addr: address, value: out };
    if (kv) kv.set(BAL_KV_KEY, JSON.stringify(out), { ex: 10 }).catch(() => {});
    return out;
  } catch { return balCache.value || null; }
}

// ---- Stablecoin Corridors (Textile FX v2 RFQ, Celo mainnet) ----
// The agent converts between USD stablecoins and local stablecoins (IDRX =
// Indonesian rupiah) through Textile's firm-quote RFQ. No direct USDC-IDRX
// corridor exists, so USDC<->IDRX routes through USDT (two swaps).
const TEXTILE_API = 'https://api.textilecredit.com/v2';
const TEXTILE_TOKENS = {
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
  IDRX: '0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22',
};
const TEXTILE_DECIMALS = { USDC: 6, USDT: 6, IDRX: 2 };
const TEXTILE_MIN_USD = 1; // Textile dollar floor per swap
const CORRIDOR_DAILY_CAP_USD = 100; // demo safety cap for corridor conversions (raised from 50 on 2026-11-22: a heavy testing day hit 50 through legitimate demo runs, blocking the owner from finishing a conversion)
// Approximate USD value of an amount, for the minimum and daily-cap checks.
// USDC/USDT are ~$1; IDRX is ~$0.0000544 (about 18,370 IDRX per USD).
// The cap is a safety limit, so a live rate is not needed here.
function corridorUsdValue(from, amount) {
  if (from === 'IDRX') return amount / 18370;
  return amount;
}

const ERC20_MIN_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
];

function corridorTaker() {
  // The burn wallet signs the takerProof and the swap txs. It is the same
  // wallet as the Altana session owner; the key arrives via env only.
  const key = process.env.VAULT_BURNER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return privateKeyToAccount(key);
}

async function textilePreview(from, to, sellAmountAtomic) {
  // Same retry as the firm quote: a quote can be briefly unavailable.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`${TEXTILE_API}/rfq/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId: 42220, sellToken: TEXTILE_TOKENS[from], buyToken: TEXTILE_TOKENS[to], sellAmount: String(sellAmountAtomic) }),
      signal: AbortSignal.timeout(30_000),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || j.error?.details?.reason || 'textile preview failed');
    if (j.data && j.data.status === 'no_quote') {
      if (attempt < 3) { await new Promise(r2 => setTimeout(r2, 2000)); continue; }
      throw new Error('Textile has no quote for this route right now. Please try again in a moment.');
    }
    return j.data;
  }
}

// One Textile RFQ leg: firm quote (with takerProof) -> approve -> swap.
// Returns { txHash, buyAmount, feeAmount }.
async function textileSwapLeg(from, to, sellAmountAtomic) {
  const taker = corridorTaker();
  if (!taker) throw new Error('VAULT_BURNER_KEY not configured');
  const pub = createPublicClient({ chain: celo, transport: viemHttp('https://forno.celo.org') });
  const wallet = createWalletClient({ account: taker, chain: celo, transport: viemHttp('https://forno.celo.org') });
  return textileSwapLegOnce(pub, wallet, taker, from, to, sellAmountAtomic);
}

async function textileSwapLegOnce(pub, wallet, taker, from, to, sellAmountAtomic) {
  const nonce = toHex(crypto.randomBytes(32));
  const issuedAt = Date.now();
  const signature = await taker.signTypedData({
    domain: { name: 'Textile Taker Control', version: '1', chainId: 42220 },
    types: { TakerControl: [
      { name: 'taker', type: 'address' },
      { name: 'chainId', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'issuedAt', type: 'uint256' },
    ] },
    primaryType: 'TakerControl',
    message: { taker: taker.address, chainId: 42220n, nonce, issuedAt: BigInt(issuedAt) },
  });
  // A quote can be briefly unavailable (no maker at that instant). Retry
  // the RFQ a few times before giving up, so a momentary gap does not
  // strand a conversion halfway (leg 1 done, leg 2 without a quote).
  // A firm quote LOCKS the sell token for about a minute. If a previous
  // attempt's quote is still outstanding, a new request is rejected with
  // "does not hold enough" even though the balance is there. Wait for the
  // old quote to expire and retry the RFQ instead of failing at once.
  let q = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${TEXTILE_API}/rfq/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chainId: 42220,
        sellToken: TEXTILE_TOKENS[from],
        buyToken: TEXTILE_TOKENS[to],
        sellAmount: String(sellAmountAtomic),
        taker: taker.address,
        takerProof: { nonce, issuedAt, signature },
      }),
      signal: AbortSignal.timeout(75_000),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const raw = data.error?.message || data.error?.details?.reason || String(res.status);
      // Translate the raw minimum-size error into plain language.
      if (/below the RFQ minimum/i.test(raw)) {
        const minAtomic = raw.match(/(\d+)\s*atomic/i)?.[1];
        const minHuman = minAtomic ? (Number(minAtomic) / 10 ** TEXTILE_DECIMALS[from]).toLocaleString('en-US') : '';
        throw new Error(`Amount too small. Textile needs at least ${minHuman ? `about ${minHuman} ${from}` : 'the $1 minimum'} for this route.`);
      }
      // The balance is held by a previous firm quote that has not expired
      // yet. Wait for it to expire (about a minute) and try the RFQ again
      // instead of failing at once.
      if (/does not hold enough|insufficient/i.test(raw)) {
        if (attempt < 4) { await new Promise(r => setTimeout(r, 12000)); continue; }
        throw new Error('Balance is held by the last quote. Wait a moment and try again.');
      }
      // Textile allows at most 4 outstanding firm quotes per taker. Each
      // one expires after about a minute. This happens after a few quick
      // retries; the fix is to wait, not to request more quotes.
      if (/too many outstanding rfqs/i.test(raw)) {
        if (attempt < 4) { await new Promise(r => setTimeout(r, 12000)); continue; }
        throw new Error('Too many pending quotes. Wait about a minute and try again.');
      }
      throw new Error('textile rfq failed: ' + raw);
    }
    q = data.data;
    if (q.status !== 'no_quote') break;
    if (attempt < 4) await new Promise(r => setTimeout(r, 3000));
  }
  if (q.status === 'no_quote') throw new Error('Textile has no quote for this route right now. Please try again in a moment.');
  const takerPays = BigInt(q.quote.takerPays);
  const reactor = q.quote.reactor;
  // Final preflight: the swap reverts as TRANSFER_FROM_FAILED if the
  // balance is even 1 atomic unit below takerPays. Fail here with a
  // clear message instead of paying gas for a reverted swap.
  const balBefore = await pub.readContract({ address: TEXTILE_TOKENS[from], abi: ERC20_MIN_ABI, functionName: 'balanceOf', args: [taker.address] });
  if (balBefore < takerPays) {
    throw new Error(`insufficient ${from} balance for this quote (have ${balBefore}, need ${takerPays}). Try a slightly smaller amount.`);
  }
  const allowance = await pub.readContract({ address: TEXTILE_TOKENS[from], abi: ERC20_MIN_ABI, functionName: 'allowance', args: [taker.address, reactor] });
  if (allowance < takerPays) {
    // USDT (and some other tokens) refuse to change a non-zero allowance
    // to a different non-zero value: reset to 0 first, then approve.
    // The old code also never checked whether the approval tx itself
    // succeeded, so a reverted approval led to TRANSFER_FROM_FAILED
    // on the swap. Check every receipt now.
    if (allowance > 0n) {
      const resetHash = await wallet.writeContract({ address: TEXTILE_TOKENS[from], abi: ERC20_MIN_ABI, functionName: 'approve', args: [reactor, 0n] });
      const resetRc = await pub.waitForTransactionReceipt({ hash: resetHash });
      if (resetRc.status !== 'success') throw new Error('allowance reset failed: ' + resetHash);
    }
    const approveTx = q.transactions.approval;
    const h = await wallet.sendTransaction({ to: approveTx.to, data: approveTx.data, value: BigInt(approveTx.value || '0') });
    const approveRc = await pub.waitForTransactionReceipt({ hash: h });
    if (approveRc.status !== 'success') throw new Error('allowance approval failed: ' + h);
    // The receipt confirms the approve is in a block, but the RPC node
    // used for the swap simulation may not have indexed it yet. Give it
    // a brief moment to catch up, but do NOT block on the re-read: Forno
    // reads can stay stale for seconds after a confirmed approve, and
    // blocking here turned a working swap into a false "allowance too
    // low" failure. The swap itself executes against on-chain state, and
    // the outer retry loop catches a genuine TRANSFER_FROM_FAILED.
    const allowDeadline = Date.now() + 5000;
    while (Date.now() < allowDeadline) {
      const allowNow = await pub.readContract({ address: TEXTILE_TOKENS[from], abi: ERC20_MIN_ABI, functionName: 'allowance', args: [taker.address, reactor] });
      if (allowNow >= takerPays) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  const exp = new Date(q.quote.expiresAt).getTime();
  if (exp - Date.now() < 10_000) throw new Error('textile quote expired before broadcast');
  // The swap is sent WITHOUT gas estimation (explicit gas limit), so it
  // never fails at the simulation stage. viem's sendTransaction simulates
  // first by default, and that simulation reads from a Forno node that can
  // lag seconds behind the approve: it sees the old allowance and reverts
  // with TRANSFER_FROM_FAILED even though the approve is already on chain.
  // That wasted the firm quote and locked the balance. Sending directly
  // executes against current on-chain state, where the allowance IS
  // sufficient (the preflight above already verified balance + allowance,
  // and the approve receipt confirmed). Gas limit 800k covers the worst
  // observed leg (IDRX->USDT used 514k); the user pays only gas actually
  // used, not the limit.
  const swapTx = q.transactions.swap;
  const swapHash = await wallet.sendTransaction({ to: swapTx.to, data: swapTx.data, value: BigInt(swapTx.value || '0'), gas: 800000n });
  const receipt = await pub.waitForTransactionReceipt({ hash: swapHash });
  if (receipt.status !== 'success') throw new Error('textile swap tx failed onchain: ' + swapHash);
  return { txHash: swapHash, buyAmount: q.quote.buyAmount, feeAmount: q.quote.feeAmount, rfqId: q.rfqId };
}

// Corridor path: direct if Textile has the pair, else via USDT.
function corridorLegs(from, to) {
  if ((from === 'USDC' && to === 'IDRX') || (from === 'IDRX' && to === 'USDC')) {
    return from === 'USDC' ? [['USDC', 'USDT'], ['USDT', 'IDRX']] : [['IDRX', 'USDT'], ['USDT', 'USDC']];
  }
  return [[from, to]];
}

async function corridorSpentTodayUsd() {
  const entries = await ledgerEntries();
  const today = new Date().toISOString().slice(0, 10);
  return entries
    .filter((e) => e.kind === 'corridor' && (e.ts || '').slice(0, 10) === today)
    .reduce((s, e) => s + (Number(e.spentUsd) || 0), 0);
}

// Serverless cold start: import the demo key as the sandbox account when the
// file keystore is in use and no sandbox account exists yet. Runs once per
// instance; the key comes from BUY_IMPORT_KEY (a demo-only test wallet).
let setupDone = false;
async function ensureBuySetup() {
  if (setupDone) return;
  setupDone = true;
  if (!process.env.BUY_IMPORT_KEY || process.env.BUY_KEYSTORE_BACKEND !== 'file') return;
  const buyHome = process.env.BUY_HOME || '';
  if (!buyHome) return;
  let hasSandbox = false;
  try {
    const accs = JSON.parse(fs.readFileSync(path.join(buyHome, 'accounts.json'), 'utf8'));
    hasSandbox = (accs.accounts || []).some((a) => a.name === 'sandbox');
  } catch { /* no accounts file yet */ }
  if (hasSandbox) return;
  const { cmd, prefix } = buyCommand();
  try {
    await execFileAsync(cmd, [...prefix, 'setup', '--import', '--name', 'sandbox', '--network', 'sepolia'], { timeout: 60000 });
  } catch (e) {
    console.error('buy setup --import failed:', String(e.message || e).slice(0, 200));
  }
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

let catalogCache = null;
let catalogAt = 0;
async function getCatalog() {
  if (catalogCache && Date.now() - catalogAt < 10 * 60 * 1000) return catalogCache;
  const r = await fetch('https://gateway.usebuy.ai/v1/catalog');
  if (!r.ok) throw new Error('catalog fetch failed: ' + r.status);
  catalogCache = await r.json();
  catalogAt = Date.now();
  return catalogCache;
}

export async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/wallet') {
    if (!SANDBOX) {
      const addr = mainnetWalletAddress();
      const balances = addr ? await mainnetBalances(addr) : null;
      return sendJson(res, 200, {
        network: NETWORK,
        attributionTag: ATTRIBUTION_TAG,
        output: addr ? `agent wallet (mainnet, direct signing): ${addr}` : 'VAULT_BURNER_KEY not configured',
        balances,
      });
    }
    await ensureBuySetup();
    const args = ['--sandbox', 'whoami'];
    const r = await runBuy(args);
    // Structured balances for the live Altana pane (parsed from whoami).
    const m = String(r.out || '').match(/balances\s+([\d.]+)\s+S-CELO,\s+([\d.]+)\s+USDC/);
    sendJson(res, 200, { network: NETWORK, attributionTag: ATTRIBUTION_TAG, output: r.out, balances: m ? { celo: Number(m[1]), usdc: Number(m[2]) } : null });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/ledger') {
    const entries = await ledgerEntries();
    sendJson(res, 200, { entries: entries.slice(-50).reverse(), spentTodayUsd: await spentTodayUsd(), dailyCapUsd: DAILY_CAP_USD });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    try {
      const cat = await getCatalog();
      const caps = (cat.capabilities || [])
        .filter((c) => ALLOWLIST[c.id])
        .map((c) => ({ id: c.id, title: c.title, url: c.url, price: c.price, maxUsd: ALLOWLIST[c.id].maxUsd, bodyKey: ALLOWLIST[c.id].bodyKey, inputLabel: ALLOWLIST[c.id].inputLabel, multi: ALLOWLIST[c.id].multi || null, inputLabels: ALLOWLIST[c.id].inputLabels || null }))
        // Working services first: the X posts route 502s often at the provider.
        .sort((a, b) => (a.id === 'youtube.videos.search' ? -1 : b.id === 'youtube.videos.search' ? 1 : 0));
      sendJson(res, 200, { capabilities: caps, network: NETWORK, attributionTag: ATTRIBUTION_TAG });
    } catch (e) {
      sendJson(res, 502, { error: String(e.message || e) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/quote') {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const cap = ALLOWLIST[body.capabilityId];
    if (!cap) return sendJson(res, 403, { error: 'capability not on the approved list' });
    if (!SANDBOX) {
      // Mainnet has no buy CLI quote (file keystore refuses mainnet); the
      // price is the allowlist per-call cap, paid in USDC on Celo mainnet.
      return sendJson(res, 200, { output: JSON.stringify({ capability: body.capabilityId, maxUsd: cap.maxUsd, network: 'mainnet', note: 'price is the per-call cap; payment settles in USDC on Celo mainnet' }) });
    }
    await ensureBuySetup();
    const r = await runBuy(buyArgs('quote', cap.url, JSON.stringify(body.body || {})));
    sendJson(res, 200, { output: r.out });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const cap = ALLOWLIST[body.capabilityId];
    if (!cap) return sendJson(res, 403, { error: 'capability not on the approved list' });
    const spent = await spentTodayUsd();
    if (spent + cap.maxUsd > DAILY_CAP_USD) {
      return sendJson(res, 403, { error: 'daily spending cap reached', spentTodayUsd: spent, dailyCapUsd: DAILY_CAP_USD });
    }
    let r;
    if (!SANDBOX) {
      r = await runMainnetDirect(cap.url, JSON.stringify(body.body || {}));
    } else {
      await ensureBuySetup();
      r = await runBuy(buyArgs('curl', cap.url, JSON.stringify(body.body || {}), ['--max-amount', String(cap.maxUsd)]));
    }
    const entry = {
      ts: new Date().toISOString(),
      capabilityId: body.capabilityId,
      query: (body.body && (body.body.query || body.body.username || ((body.body.origin && body.body.destination) ? body.body.origin + ' → ' + body.body.destination + ' ' + (body.body.date || '') : ''))) || '',
      network: NETWORK,
      maxUsd: cap.maxUsd,
      status: 'unknown',
      priceUsd: null,
      txHash: null,
      raw: r.out.slice(0, 2000),
    };
    let parsed = null;
    try { parsed = JSON.parse(r.out.trim().split('\n').find((l) => l.trim().startsWith('{')) || ''); } catch { /* keep raw */ }
    if (parsed && parsed.transaction) {
      entry.status = 'settled';
      entry.txHash = parsed.transaction;
      entry.priceUsd = Number(parsed.payment?.usd || parsed.payment?.atomic / 1e6 || 0);
      entry.resultCount = parsed.resultCount ?? null;
      entry.result = parsed.output ?? null;
    } else if (parsed && parsed.error) {
      entry.status = 'failed';
      entry.error = parsed.error?.message || parsed.error?.code || 'provider error';
    } else if (r.out.includes('502') || r.out.includes('provider_error')) {
      entry.status = 'ambiguous';
      entry.error = 'provider returned 502; payment may still settle — do not retry blindly';
    }
    appendLedger(entry);
    sendJson(res, entry.status === 'settled' ? 200 : 502, { entry });
    return;
  }

  // Short-lived rate cache: the Textile preview is the slowest call, and
  // the rate barely moves within half a minute. Keyed by from/to/amount.
  const rateCache = new Map();
  if (req.method === 'GET' && url.pathname === '/api/corridor-rate') {
    const from = (url.searchParams.get('from') || 'USDC').toUpperCase();
    const to = (url.searchParams.get('to') || 'IDRX').toUpperCase();
    const amount = Number(url.searchParams.get('amount') || '2');
    if (!TEXTILE_TOKENS[from] || !TEXTILE_TOKENS[to] || from === to || !isFinite(amount) || amount <= 0) {
      return sendJson(res, 400, { error: 'bad from/to/amount' });
    }
    const cacheKey = `${from}:${to}:${amount}`;
    const cached = rateCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 30_000) return sendJson(res, 200, cached.body);
    try {
      // Preview the full path (two legs via USDT when there is no direct pair).
      const legs = corridorLegs(from, to);
      let sellAtomic = BigInt(Math.round(amount * 10 ** TEXTILE_DECIMALS[from]));
      let buyAtomic = null;
      let rate = null;
      const legPreviews = [];
      for (const [lf, lt] of legs) {
        const p = await textilePreview(lf, lt, sellAtomic);
        legPreviews.push({ from: lf, to: lt, sellAmount: p.sellAmount, buyAmount: p.buyAmount, feeAmount: p.feeAmount });
        buyAtomic = BigInt(p.buyAmount);
        sellAtomic = buyAtomic;
      }
      const buyHuman = Number(buyAtomic) / 10 ** TEXTILE_DECIMALS[to];
      rate = buyHuman / amount;
      const body = { from, to, amount, buyAmount: buyHuman, rate, legs: legPreviews, minUsd: TEXTILE_MIN_USD };
      rateCache.set(cacheKey, { at: Date.now(), body });
      return sendJson(res, 200, body);
    } catch (e) {
      return sendJson(res, 502, { error: String(e.message || e) });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/corridor-convert') {
    if (SANDBOX) return sendJson(res, 403, { error: 'corridors run on mainnet only' });
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const from = String(body.from || 'USDC').toUpperCase();
    const to = String(body.to || 'IDRX').toUpperCase();
    const amount = Number(body.amount);
    if (!TEXTILE_TOKENS[from] || !TEXTILE_TOKENS[to] || from === to || !isFinite(amount)) {
      return sendJson(res, 400, { error: 'bad corridor request' });
    }
    // The minimum and the daily cap are in USD, not in the from-token's
    // units: 36,737 IDRX is only about $2, not $36,737.
    const usdValue = corridorUsdValue(from, amount);
    if (usdValue < TEXTILE_MIN_USD) {
      return sendJson(res, 400, { error: `amount must be at least $${TEXTILE_MIN_USD}` });
    }
    const spent = await corridorSpentTodayUsd();
    if (spent + usdValue > CORRIDOR_DAILY_CAP_USD) {
      return sendJson(res, 403, { error: 'corridor daily cap reached', spentTodayUsd: spent, dailyCapUsd: CORRIDOR_DAILY_CAP_USD });
    }
    const legs = corridorLegs(from, to);
    // Each leg records an equal share of the USD value, so one conversion
    // counts once toward the daily cap, not once per leg.
    const spentPerLeg = usdValue / legs.length;
    // Single-leg mode: the frontend calls once per leg so it can show live
    // progress (quote -> approve -> swap) for each hop.
    if (body.leg != null) {
      const legIndex = Number(body.leg);
      if (!Number.isInteger(legIndex) || legIndex < 0 || legIndex >= legs.length) {
        return sendJson(res, 400, { error: 'bad leg index' });
      }
      const [lf, lt] = legs[legIndex];
      // Leg 0 always derives the sell amount from `amount` (the value the
      // daily-cap check used). Never trust the client's sellAmountAtomic
      // here: a caller could pass amount 1.5 (cap check sees $1.50) while
      // selling the wallet's entire balance. Later legs override
      // sellAtomic with the real on-chain balance below, so the client's
      // hint is only used there.
      let sellAtomic = legIndex === 0
        ? BigInt(Math.round(amount * 10 ** TEXTILE_DECIMALS[from]))
        : (body.sellAmountAtomic != null
          ? BigInt(body.sellAmountAtomic)
          : BigInt(Math.round(amount * 10 ** TEXTILE_DECIMALS[from])));
      // For a later leg, the input is the previous leg's output. The quoted
      // buyAmount can be a few atomic units more than what actually landed
      // on chain, and Textile rejects the RFQ when the wallet holds less
      // than the requested sell amount. Use the amount that ACTUALLY
      // landed (the real on-chain balance), not the estimate.
      // The previous leg's tx may be settled on Textile's side while the
      // wallet/RPC balance has not updated yet. Poll briefly until the
      // balance actually rises instead of failing on the first stale read
      // — that stale read is what produced "no USDT balance for the next
      // leg" on a live USDC->IDRX swap. The poll here is SHORT (15s) on
      // purpose: Vercel serverless maxDuration is 60s, and this call still
      // has to run the leg-2 swap after the poll. The long wait lives in
      // the FRONTEND, which polls /api/wallet between legs with no
      // serverless timeout, so a slow balance update cannot time out the
      // backend mid-swap.
      if (legIndex > 0) {
        const taker = corridorTaker();
        if (taker) {
          const pub = createPublicClient({ chain: celo, transport: viemHttp('https://forno.celo.org') });
          const tokenAddr = TEXTILE_TOKENS[lf];
          let bal = 0n;
          const deadline = Date.now() + 15000;
          while (Date.now() < deadline) {
            bal = await pub.readContract({ address: tokenAddr, abi: ERC20_MIN_ABI, functionName: 'balanceOf', args: [taker.address] });
            if (bal > 10n) break;
            await new Promise(r => setTimeout(r, 2000));
          }
          // Use the REAL on-chain balance minus a tiny buffer (10 atomic
          // units) as the leg-2 sell amount, not the quoted buyAmount from
          // leg 1. The quote can be a few atomic units more than what
          // actually landed, and even 1 atomic unit short of takerPays
          // makes transferFrom revert as TRANSFER_FROM_FAILED, so never
          // request the full balance or the quoted estimate.
          const cap = bal > 10n ? bal - 10n : 0n;
          if (cap <= 0n) return sendJson(res, 502, { error: `no ${lf} balance for the next leg`, leg: legIndex });
          sellAtomic = cap;
        }
      }
      try {
        const leg = await textileSwapLeg(lf, lt, sellAtomic);
        appendLedger({ ts: new Date().toISOString(), kind: 'corridor', capabilityId: 'corridor.' + lf.toLowerCase() + '-' + lt.toLowerCase(), query: `${lf} -> ${lt}`, network: NETWORK, status: 'settled', txHash: leg.txHash, priceUsd: usdValue, spentUsd: spentPerLeg, buyAmount: leg.buyAmount });
        return sendJson(res, 200, { from: lf, to: lt, leg: legIndex, legsTotal: legs.length, txHash: leg.txHash, buyAmount: leg.buyAmount, feeAmount: leg.feeAmount, rfqId: leg.rfqId });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.message || e), leg: legIndex });
      }
    }
    const results = [];
    try {
      let sellAtomic = BigInt(Math.round(amount * 10 ** TEXTILE_DECIMALS[from]));
      for (const [lf, lt] of legs) {
        const leg = await textileSwapLeg(lf, lt, sellAtomic);
        results.push({ from: lf, to: lt, txHash: leg.txHash, buyAmount: leg.buyAmount, feeAmount: leg.feeAmount, rfqId: leg.rfqId });
        sellAtomic = BigInt(leg.buyAmount);
      }
    } catch (e) {
      // Record the partial path honestly, then report the failure.
      for (const r of results) {
        appendLedger({ ts: new Date().toISOString(), kind: 'corridor', capabilityId: 'corridor.' + r.from.toLowerCase() + '-' + r.to.toLowerCase(), query: `${r.from} -> ${r.to}`, network: NETWORK, status: 'settled', txHash: r.txHash, priceUsd: usdValue, spentUsd: spentPerLeg, buyAmount: r.buyAmount });
      }
      return sendJson(res, 502, { error: String(e.message || e), completedLegs: results });
    }
    const finalBuy = Number(results[results.length - 1].buyAmount) / 10 ** TEXTILE_DECIMALS[to];
    for (const r of results) {
      appendLedger({ ts: new Date().toISOString(), kind: 'corridor', capabilityId: 'corridor.' + r.from.toLowerCase() + '-' + r.to.toLowerCase(), query: `${r.from} -> ${r.to}`, network: NETWORK, status: 'settled', txHash: r.txHash, priceUsd: usdValue, spentUsd: spentPerLeg, buyAmount: r.buyAmount });
    }
    return sendJson(res, 200, { from, to, amount, buyAmount: finalBuy, legs: results });
  }

  sendJson(res, 404, { error: 'not found' });
}

export { NETWORK, ATTRIBUTION_TAG };
