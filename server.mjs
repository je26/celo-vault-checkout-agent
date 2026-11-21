// Vault Checkout Agent — local dev server (thin wrapper around handler.mjs).
import http from 'node:http';
import { handleRequest, NETWORK } from './handler.mjs';

const PORT = Number(process.env.PORT || 8787);

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Vault Checkout Agent on http://localhost:${PORT} (network=${NETWORK})`);
});
