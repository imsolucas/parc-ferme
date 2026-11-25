// Web Push for Workers: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291 / RFC 8188),
// built on WebCrypto only. The `web-push` npm package needs Node's crypto/https and does not run here.

import { b64url, fromB64url } from '../db';

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // base64url, uncompressed P-256 point (65 bytes)
  auth: string; // base64url, 16 bytes
}

export interface Vapid {
  publicKey: string; // base64url uncompressed point
  privateKey: string; // base64url 32-byte scalar
  subject: string; // mailto: or https: URL
}

const enc = new TextEncoder();
const EC = { name: 'ECDH', namedCurve: 'P-256' } as const;

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** JWK for a P-256 key given its raw public point and (optionally) private scalar. */
function p256Jwk(publicRaw: Uint8Array, privateD?: string): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64url(publicRaw.slice(1, 33)),
    y: b64url(publicRaw.slice(33, 65)),
    ...(privateD ? { d: privateD } : {}),
  };
}

export interface EncryptOverrides {
  /** Fixed salt and sender key, only for reproducing the RFC 8291 test vector. */
  salt: Uint8Array;
  senderPublic: string;
  senderPrivate: string;
}

/** Encrypt a push payload for one subscription. Returns the full aes128gcm body. */
export async function encryptPayload(
  plaintext: string | Uint8Array,
  sub: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  overrides?: EncryptOverrides,
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  const salt = overrides?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  let asPublic: Uint8Array;
  let asPrivate: CryptoKey;
  if (overrides) {
    asPublic = fromB64url(overrides.senderPublic);
    asPrivate = await crypto.subtle.importKey('jwk', p256Jwk(asPublic, overrides.senderPrivate), EC, false, [
      'deriveBits',
    ]);
  } else {
    const pair = (await crypto.subtle.generateKey(EC, true, ['deriveBits'])) as CryptoKeyPair;
    asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
    asPrivate = pair.privateKey;
  }

  const uaKey = await crypto.subtle.importKey('jwk', p256Jwk(uaPublic), EC, false, []);
  const secret = new Uint8Array(
    // Workers types call this field `$public`; the runtime (and Node) read `public`.
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as never, asPrivate, 256),
  );

  const ikm = await hkdf(authSecret, secret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const data = typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext;
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      aes,
      concat(data, new Uint8Array([2])) as BufferSource, // 0x02 = last-record delimiter, no padding
    ),
  );

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096); // record size
  header[20] = asPublic.length;
  return concat(header, asPublic, ciphertext);
}

/** Signed VAPID JWT for a push service origin. */
export async function vapidJwt(audience: string, vapid: Vapid, nowSec = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    'jwk',
    p256Jwk(fromB64url(vapid.publicKey), vapid.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const part = (o: object) => b64url(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: audience, exp: nowSec + 12 * 3600, sub: vapid.subject })}`;
  // WebCrypto already returns the raw r||s form that JWS wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

export interface PushResult {
  status: number;
  /** The push service says this subscription is dead; delete it. */
  gone: boolean;
}

export async function sendPush(
  sub: PushSubscriptionKeys,
  payload: object,
  vapid: Vapid,
  opts: {
    ttl?: number;
    urgency?: 'low' | 'normal' | 'high';
    fetcher?: typeof fetch;
    /** Reuse one signed JWT per push-service origin across a batch (signing is the costly part). */
    jwtCache?: Map<string, Promise<string>>;
  } = {},
): Promise<PushResult> {
  const body = await encryptPayload(JSON.stringify(payload), sub);
  const origin = new URL(sub.endpoint).origin;
  let signing = opts.jwtCache?.get(origin);
  if (!signing) {
    signing = vapidJwt(origin, vapid);
    opts.jwtCache?.set(origin, signing);
  }
  const jwt = await signing;
  const res = await (opts.fetcher ?? fetch)(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(opts.ttl ?? 3600),
      urgency: opts.urgency ?? 'normal',
    },
    body,
  });
  await res.body?.cancel();
  return { status: res.status, gone: res.status === 410 || res.status === 404 };
}
