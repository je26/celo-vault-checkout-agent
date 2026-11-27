// Vault Checkout Agent — automated tests (node:test, no new dependencies).
//
// Rules:
//  - Never touches the real ledger, real network, real keys, or mainnet.
//  - Ledger writes go to a temp file (LEDGER_PATH), deleted after the run.
//  - Network calls are mocked (global fetch) or faked (BUY_BIN -> fake-buy.mjs).
//  - Every test restores globals it changed (fetch, BUY_BIN, FAKE_BUY_MODE).
//  - Mainnet paths are NOT tested: they need real keys and real money.
//
// Run: npm ci && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const FAKE_BUY = path.join(__dirname, 'fake-buy.mjs');
// The handler runs the fake buy CLI directly (execFile + shebang), which
// needs the execute bit. Git does not always preserve it on push, so make
// the file executable here instead of relying on the stored mode.
fs.chmodSync(FAKE_BUY, 0o755);

// --- isolation setup (before handler import) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
const LEDGER_PATH = path.join(tmpDir, 'ledger.jsonl');
fs.writeFileSync(LEDGER_PATH, '');
process.env.VAULT_NETWORK = 'sandbox';
process.env.LEDGER_PATH = LEDGER_PATH;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.VAULT_SESSION_KEY;
delete process.env.VAULT_BURNER_KEY;
delete process.env.BUY_BIN;
delete process.env.FAKE_BUY_MODE;

// The handler also reads /tmp/ledger.jsonl as a fallback. Back it up (if it
// exists) so tests never read stale entries, and restore it afterwards.
const TMP_LEDGER = '/tmp/ledger.jsonl';
const TMP_LEDGER_BAK = path.join(tmpDir, 'ledger-tmp.bak');
let tmpLedgerExisted = false;
if (fs.existsSync(TMP_LEDGER)) {
  tmpLedgerExisted = true;
  fs.copyFileSync(TMP_LEDGER, TMP_LEDGER_BAK);
  fs.unlinkSync(TMP_LEDGER);
}

const { handleRequest, NETWORK, ATTRIBUTION_TAG } = await import('../handler.mjs');

const originalFetch = globalThis.fetch;

function resetLedger() {
  fs.writeFileSync(LEDGER_PATH, '');
}
function writeLedgerEntry(entry) {
  fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n');
}
function readLedger() {
  const raw = fs.readFileSync(LEDGER_PATH, 'utf8').trim();
  return raw ? raw.split('\n').map((l) => JSON.parse(l)) : [];
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fakeReq(method, urlPath, bodyStr) {
  const r = new Readable({ read() {} });
  r.method = method;
  r.url = urlPath;
  r.push(bodyStr ?? null);
  r.push(null);
  return r;
}
function fakeRes() {
  const chunks = [];
  const r = {
    status: 0,
    headers: {},
    writeHead(s, h) { r.status = s; r.headers = h; },
    end(d) { chunks.push(d == null ? '' : String(d)); r.body = chunks.join(''); r.done(); },
    done: null,
    body: '',
  };
  r.promise = new Promise((resolve) => { r.done = () => resolve(r); });
  return r;
}
async function call(method, urlPath, body) {
  const q = fakeReq(method, urlPath, body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)));
  const s = fakeRes();
  await handleRequest(q, s);
  await s.promise;
  let json = null;
  try { json = JSON.parse(s.body); } catch { /* non-JSON body */ }
  return { status: s.status, body: s.body, json };
}

before(() => {
  assert.equal(NETWORK, 'sandbox', 'tests must run in sandbox mode');
  assert.equal(ATTRIBUTION_TAG, 'celo_2da564e80a18');
});

after(() => {
  // Restore globals and remove temp files. Never leave test state behind.
  globalThis.fetch = originalFetch;
  delete process.env.BUY_BIN;
  delete process.env.FAKE_BUY_MODE;
  if (tmpLedgerExisted) fs.copyFileSync(TMP_LEDGER_BAK, TMP_LEDGER);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// --- payment flow: quote ---
test('quote rejects a capability that is not on the allowlist (403)', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  const r = await call('POST', '/api/quote', { capabilityId: 'nope.not.real', body: {} });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /not on the approved list/);
});

test('quote rejects malformed JSON (400)', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  const r = await call('POST', '/api/quote', '{bad json');
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'bad json');
});

// --- payment flow: run ---
test('run rejects a capability that is not on the allowlist (403)', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  const r = await call('POST', '/api/run', { capabilityId: 'nope.not.real', body: {} });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /not on the approved list/);
});

test('run rejects when the daily spending cap is reached (403)', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; delete process.env.BUY_BIN; });
  resetLedger();
  // Fill today's spend to the $0.50 cap with a settled entry.
  writeLedgerEntry({
    ts: todayIso() + 'T00:00:00.000Z',
    capabilityId: 'youtube.videos.search',
    query: 'cap-test',
    priceUsd: 0.5,
    status: 'settled',
    txHash: '0x' + 'cd'.repeat(32),
    network: 'sandbox',
  });
  process.env.BUY_BIN = FAKE_BUY;
  const r = await call('POST', '/api/run', { capabilityId: 'youtube.videos.search', body: { query: 'celo' } });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'daily spending cap reached');
  assert.equal(r.json.dailyCapUsd, 0.5);
  assert.equal(r.json.spentTodayUsd, 0.5);
});

test('run happy path with mocked buy CLI settles and writes the ledger', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; delete process.env.BUY_BIN; });
  resetLedger();
  process.env.BUY_BIN = FAKE_BUY;
  const r = await call('POST', '/api/run', { capabilityId: 'youtube.videos.search', body: { query: 'celo' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.entry.status, 'settled');
  assert.equal(r.json.entry.capabilityId, 'youtube.videos.search');
  assert.equal(r.json.entry.priceUsd, 0.005);
  assert.match(r.json.entry.txHash, /^0x[0-9a-f]{64}$/);
  const entries = readLedger();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, 'settled');
  assert.equal(entries[0].txHash, r.json.entry.txHash);
});

test('run with a provider 502 is ambiguous and does not blind-retry', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; delete process.env.BUY_BIN; delete process.env.FAKE_BUY_MODE; });
  resetLedger();
  process.env.BUY_BIN = FAKE_BUY;
  process.env.FAKE_BUY_MODE = '502';
  const r = await call('POST', '/api/run', { capabilityId: 'youtube.videos.search', body: { query: 'celo' } });
  assert.equal(r.status, 502);
  assert.equal(r.json.entry.status, 'ambiguous');
  assert.match(r.json.entry.error, /502|may still settle/);
  const entries = readLedger();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, 'ambiguous');
});

// --- agent flow: catalog ---
test('catalog returns only allowlisted capabilities with price and cap', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      capabilities: [
        { id: 'youtube.videos.search', title: 'Search YouTube videos', url: 'https://gateway.usebuy.ai/v1/social/youtube/videos/search', price: 0.005 },
        { id: 'not.allowlisted', title: 'Not allowed', url: 'https://example.com/x', price: 1 },
        { id: 'flights.search', title: 'Search flights', url: 'https://gateway.usebuy.ai/v1/travel/flights/search', price: 0.023 },
      ],
    }),
  });
  const r = await call('GET', '/api/catalog');
  assert.equal(r.status, 200);
  const ids = r.json.capabilities.map((c) => c.id);
  assert.deepEqual(ids, ['youtube.videos.search', 'flights.search']);
  const yt = r.json.capabilities.find((c) => c.id === 'youtube.videos.search');
  assert.equal(yt.maxUsd, 0.01);
  assert.equal(yt.bodyKey, 'query');
  const fl = r.json.capabilities.find((c) => c.id === 'flights.search');
  assert.equal(fl.maxUsd, 0.03);
  assert.equal(r.json.network, 'sandbox');
  assert.equal(r.json.attributionTag, 'celo_2da564e80a18');
});

// --- agent flow: ledger ---
test('ledger returns entries, spent today, and the daily cap', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  writeLedgerEntry({
    ts: todayIso() + 'T01:00:00.000Z',
    capabilityId: 'youtube.videos.search',
    query: 'celo',
    priceUsd: 0.005,
    status: 'settled',
    txHash: '0x' + '11'.repeat(32),
    network: 'sandbox',
  });
  writeLedgerEntry({
    ts: todayIso() + 'T02:00:00.000Z',
    capabilityId: 'reddit.posts.search',
    query: 'celo',
    priceUsd: 0.005,
    status: 'settled',
    txHash: '0x' + '22'.repeat(32),
    network: 'sandbox',
  });
  const r = await call('GET', '/api/ledger');
  assert.equal(r.status, 200);
  // The committed seed (agent/ledger-seed.jsonl) also contributes entries,
  // so check ours are present instead of asserting a total count.
  const hashes = r.json.entries.map((e) => e.txHash);
  assert.ok(hashes.includes('0x' + '11'.repeat(32)), 'first test entry present');
  assert.ok(hashes.includes('0x' + '22'.repeat(32)), 'second test entry present');
  assert.equal(r.json.spentTodayUsd, 0.01);
  assert.equal(r.json.dailyCapUsd, 0.5);
});

// --- corridors: validation only (mainnet-only, blocked in sandbox) ---
test('corridor-rate rejects bad from/to/amount (400); corridor-convert is blocked in sandbox (403)', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  const bad = await call('GET', '/api/corridor-rate?from=XXX&to=YYY&amount=2');
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'bad from/to/amount');
  const same = await call('GET', '/api/corridor-rate?from=USDC&to=USDC&amount=2');
  assert.equal(same.status, 400);
  const conv = await call('POST', '/api/corridor-convert', { from: 'USDC', to: 'IDRX', amount: 2 });
  assert.equal(conv.status, 403);
  assert.equal(conv.json.error, 'corridors run on mainnet only');
});

// --- routing ---
test('unknown route returns 404', async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  resetLedger();
  const r = await call('GET', '/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json.error, 'not found');
});
