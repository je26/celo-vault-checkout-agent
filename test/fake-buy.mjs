#!/usr/bin/env node
// Fake `buy` CLI for tests. Prints canned output; never touches network or keys.
// The handler invokes it via BUY_BIN. Mode via FAKE_BUY_MODE env:
//   ok (default) -> canned quote/settlement JSON
//   502          -> provider error output (for the ambiguous-receipt test)
const mode = process.env.FAKE_BUY_MODE || 'ok';
const args = process.argv.slice(2);
const sub = args.find((a) => ['quote', 'curl', 'whoami'].includes(a));

if (sub === 'whoami') {
  console.log('sandbox account: balances 10.000000 S-CELO, 5.000000 USDC');
  process.exit(0);
}
if (mode === '502') {
  // Plain text, deliberately NOT a JSON error object: the handler only marks
  // a run 'ambiguous' when no JSON error parses but the output mentions 502.
  console.log('provider_error 502: gateway returned 502 Bad Gateway');
  process.exit(0);
}
if (sub === 'quote') {
  console.log(JSON.stringify({ capability: 'youtube.videos.search', price: '0.005 USDC', priceUsd: 0.005, maxUsd: 0.01 }));
  process.exit(0);
}
// curl (run): canned settlement, single JSON line starting with '{'.
console.log(JSON.stringify({
  transaction: '0x' + 'ab'.repeat(32),
  payment: { usd: 0.005, atomic: 5000 },
  resultCount: 3,
  output: { items: [{ title: 'test result' }] },
}));
process.exit(0);
