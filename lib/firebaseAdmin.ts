import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const trim = (value: string | undefined): string => (value ?? '').trim();

const getPrivateKey = (): string => {
  const raw = trim(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!raw) return '';
  const unquoted = raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1)
    : raw;
  return unquoted.replace(/\\n/g, '\n');
};

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

const getAdminApp = (): App => {
  if (cachedApp) return cachedApp;

  const projectId = trim(process.env.FIREBASE_ADMIN_PROJECT_ID);
  const clientEmail = trim(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials');
  }

  cachedApp =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });

  return cachedApp;
};

export const getAdminDb = (): Firestore => {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getAdminApp());
  return cachedDb;
};

export const getAdminAuth = (): Auth => {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
};
