import { getMessaging, register, onRegistered, onMessage, isSupported, type Messaging, type MessagePayload } from 'firebase/messaging';
import { firebaseApp } from './client';

const SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';
const TOKEN_TIMEOUT_MS = 15000;

let messagingInstance: Messaging | null = null;

export const isMessagingSupported = (): Promise<boolean> => isSupported();

export function getMessagingInstance(): Messaging {
  if (!messagingInstance) {
    messagingInstance = getMessaging(firebaseApp);
  }
  return messagingInstance;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('service-worker-not-supported');
  }
  return navigator.serviceWorker.register(SERVICE_WORKER_PATH);
}

function obtainToken(registration: ServiceWorkerRegistration, vapidKey: string): Promise<string> {
  const messaging = getMessagingInstance();
  return new Promise<string>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onRegistered(messaging, (token) => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      resolve(token);
    });
    register(messaging, { vapidKey, serviceWorkerRegistration: registration }).catch((e) => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      reject(e);
    });
    timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('token-timeout'));
    }, TOKEN_TIMEOUT_MS);
  });
}

export async function getTokenForRegistration(vapidKey: string): Promise<string> {
  const registration = await registerServiceWorker();
  return obtainToken(registration, vapidKey);
}

export async function requestAndGetToken(vapidKey: string): Promise<string> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('permission-denied');
  }
  return getTokenForRegistration(vapidKey);
}

export function onForegroundMessage(callback: (payload: MessagePayload) => void): () => void {
  return onMessage(getMessagingInstance(), callback);
}
