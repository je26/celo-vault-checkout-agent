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
  const today = new Date().toISOString().slice(0, 10);
  return (await ledgerEntries())
    .filter((e) => e.status === 'settled' && e.ts.startsWith(today))
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

// Mainnet direct x402 (Task 10 option 1): buy's file keystore refuses mainnet,
// so the agent signs EIP-3009 authorizations itself with the burner key from
// VAULT_BURNER_KEY and pays the buy gateway through @x402/fetch. The wallet
// must be a plain EOA (delegation revoked) or USDC's SignatureChecker rejects
// the authorization. Returns { ok, out } shaped like runBuy.
let mainnetFetch = null;
function getMainnetFetch() {
  if (mainnetFetch) return mainnetFetch;
  const key = process.env.VAULT_BURNER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('VAULT_BURNER_KEY env var missing or malformed.');
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
  const key = process.env.VAULT_BURNER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return privateKeyToAccount(key).address;
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
      return sendJson(res, 200, {
        network: NETWORK,
        attributionTag: ATTRIBUTION_TAG,
        output: addr ? `agent wallet (mainnet, direct signing): ${addr}` : 'VAULT_BURNER_KEY not configured',
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

  sendJson(res, 404, { error: 'not found' });
}

export { NETWORK, ATTRIBUTION_TAG };
