// Test ONE mainnet x402 call with direct EIP-3009 signing (no buy CLI).
// YouTube search, $0.005 USDC, paid from the burn wallet (plain EOA now).
// Proves the Task 10 option-1 path works before wiring it into the handler.
// Usage: BURNER_KEY=0x... node test-mainnet-direct.mjs [query]
//   Key comes ONLY from the exec env field. Never arguments, never files.
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const BURNER_KEY = process.env.BURNER_KEY;
if (!BURNER_KEY || !/^0x[0-9a-fA-F]{64}$/.test(BURNER_KEY)) {
  throw new Error('BURNER_KEY env var missing or malformed. Pass it via the exec env field.');
}

const query = process.argv[2] || 'celo';
const account = privateKeyToAccount(BURNER_KEY);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const url = 'https://gateway.usebuy.ai/v1/social/youtube/videos/search';
console.log('Paying for YouTube search (mainnet):', query);
const res = await fetchWithPayment(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
console.log('HTTP status:', res.status);
const text = await res.text();
console.log('Body (first 1500 chars):', text.slice(0, 1500));
try {
  const j = JSON.parse(text);
  console.log('Parsed keys:', Object.keys(j).join(', '));
  if (j.transaction) console.log('Settlement tx:', j.transaction);
} catch { /* not JSON */ }
