/**
 * Web push, from the browser's side.
 *
 * Two rules this file exists to enforce:
 *  1. Never ask for permission on page load. A permission prompt nobody asked
 *     for gets denied, and a denied prompt cannot be asked again — it has to be
 *     undone in browser settings. Permission is only ever requested from a
 *     click on "Activar avisos".
 *  2. The service worker is registered for push only. It caches nothing (see
 *     public/sw.js) so it can never serve a stale index.html.
 */
import axios from 'axios';
import { API_BASE_URL } from './constants';

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/** Does this browser have the pieces at all? iOS needs the app installed first. */
export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** True when the page is running as an installed app rather than a tab. */
export function isInstalled() {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
}

/** iOS only allows push from an installed app — worth saying out loud in the UI. */
export function isIOS() {
  return typeof navigator !== 'undefined'
    && (/iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}

let registration = null;
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (e) {
    console.warn('Service worker no registrado:', e.message);
    return null;
  }
}

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * What the UI needs to decide what to show, without asking for anything.
 * @returns {{supported, enabledOnServer, permission, subscribed, installed, ios}}
 */
export async function pushStatus() {
  const supported = pushSupported();
  let enabledOnServer = false;
  try {
    const { data } = await axios.get(`${API_BASE_URL}/api/notifications/push/key`, { headers: auth() });
    enabledOnServer = Boolean(data?.enabled);
  } catch { /* server without keys — treated as "not offered" */ }

  let subscribed = false;
  if (supported) {
    const reg = await registerServiceWorker();
    const sub = await reg?.pushManager.getSubscription();
    subscribed = Boolean(sub);
  }
  return {
    supported,
    enabledOnServer,
    permission: supported ? Notification.permission : 'unsupported',
    subscribed,
    installed: isInstalled(),
    ios: isIOS(),
  };
}

/** Ask, subscribe, and register the device. Only ever call this from a click. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador no admite avisos.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Los avisos están bloqueados para este sitio. Actívalos en los ajustes del navegador.'
      : 'No se concedió el permiso.');
  }

  const { data } = await axios.get(`${API_BASE_URL}/api/notifications/push/key`, { headers: auth() });
  if (!data?.enabled || !data?.key) throw new Error('Los avisos no están configurados en el servidor.');

  const reg = await registerServiceWorker();
  if (!reg) throw new Error('No se pudo iniciar el servicio de avisos.');
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.key),
  });

  await axios.post(`${API_BASE_URL}/api/notifications/push/subscribe`, sub.toJSON(), { headers: auth() });
  return true;
}

/** Stop this device. Other devices the person allowed keep working. */
export async function disablePush() {
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return true;
  await axios.post(`${API_BASE_URL}/api/notifications/push/unsubscribe`,
    { endpoint: sub.endpoint }, { headers: auth() }).catch(() => {});
  await sub.unsubscribe();
  return true;
}

/** Send one to this person's devices, so they can see it arrive. */
export async function sendTestPush() {
  await axios.post(`${API_BASE_URL}/api/notifications/push/test`, {}, { headers: auth() });
}
