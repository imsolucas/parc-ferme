// Generates a VAPID key pair in the base64url form the Worker expects.
// Usage: pnpm vapid
import { webcrypto } from 'node:crypto';

const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as ArrayBuffer).toString('base64url');

const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const publicKey = b64url(await webcrypto.subtle.exportKey('raw', pair.publicKey));
const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.error('\nLocal: paste both lines into apps/worker/.dev.vars');
console.error('Prod:  wrangler secret put VAPID_PUBLIC_KEY   (then VAPID_PRIVATE_KEY)');
