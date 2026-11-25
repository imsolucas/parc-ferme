import { api } from './api';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64url.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe with the server's VAPID key and store the subscription. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('This browser does not support push alerts.');
  const { publicKey } = await api.pushKey();
  if (!publicKey) throw new Error('Push alerts are not set up on this server yet.');
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications are blocked. Allow them in your browser settings to get alerts.');
  }
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await api.pushSubscribe(sub.toJSON());
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}
