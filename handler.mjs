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

function ledgerEntries() {
  try {
    if (!fs.existsSync(LEDGER)) return [];
    return fs.readFileSync(LEDGER, 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

function spentTodayUsd() {
  const today = new Date().toISOString().slice(0, 10);
  return ledgerEntries()
    .filter((e) => e.status === 'settled' && e.ts.startsWith(today))
    .reduce((s, e) => s + Number(e.priceUsd || 0), 0);
}

function appendLedger(entry) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.appendFileSync(LEDGER, JSON.stringify(entry) + '\n');
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
    await ensureBuySetup();
    const args = SANDBOX ? ['--sandbox', 'whoami'] : ['whoami'];
    const r = await runBuy(args);
    sendJson(res, 200, { network: NETWORK, attributionTag: ATTRIBUTION_TAG, output: r.out });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/ledger') {
    sendJson(res, 200, { entries: ledgerEntries().slice(-50).reverse(), spentTodayUsd: spentTodayUsd(), dailyCapUsd: DAILY_CAP_USD });
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
    await ensureBuySetup();
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const cap = ALLOWLIST[body.capabilityId];
    if (!cap) return sendJson(res, 403, { error: 'capability not on the approved list' });
    const r = await runBuy(buyArgs('quote', cap.url, JSON.stringify(body.body || {})));
    sendJson(res, 200, { output: r.out });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    await ensureBuySetup();
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const cap = ALLOWLIST[body.capabilityId];
    if (!cap) return sendJson(res, 403, { error: 'capability not on the approved list' });
    if (spentTodayUsd() + cap.maxUsd > DAILY_CAP_USD) {
      return sendJson(res, 403, { error: 'daily spending cap reached', spentTodayUsd: spentTodayUsd(), dailyCapUsd: DAILY_CAP_USD });
    }
    const r = await runBuy(buyArgs('curl', cap.url, JSON.stringify(body.body || {}), ['--max-amount', String(cap.maxUsd)]));
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
