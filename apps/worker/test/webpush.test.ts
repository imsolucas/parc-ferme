import { describe, expect, it } from 'vitest';
import { b64url, fromB64url } from '../src/db';
import { encryptPayload, vapidJwt } from '../src/push/webpush';

describe('aes128gcm payload encryption', () => {
  it('reproduces the RFC 8291 Appendix A test vector', async () => {
    const body = await encryptPayload(
      'When I grow up, I want to be a watermelon',
      {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      {
        salt: fromB64url('DGv6ra1nlYgDCS1FRnbzlw'),
        senderPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        senderPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
      },
    );
    expect(b64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('uses a fresh salt and sender key per message', async () => {
    const sub = { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' };
    const [a, b] = await Promise.all([encryptPayload('x', sub), encryptPayload('x', sub)]);
    expect(b64url(a)).not.toBe(b64url(b));
    expect(a.length).toBe(16 + 4 + 1 + 65 + 1 + 1 + 16); // header + key + "x" + delimiter + GCM tag
  });
});

describe('VAPID', () => {
  it('signs an ES256 JWT that verifies against the public key', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const publicKey = b64url((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
    const privateKey = ((await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey).d!;

    const jwt = await vapidJwt('https://push.example', { publicKey, privateKey, subject: 'mailto:a@example.com' }, 1_000);
    const [h, p, s] = jwt.split('.') as [string, string, string];
    expect(JSON.parse(new TextDecoder().decode(fromB64url(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(fromB64url(p)))).toEqual({ aud: 'https://push.example', exp: 1_000 + 43_200, sub: 'mailto:a@example.com' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });
});
