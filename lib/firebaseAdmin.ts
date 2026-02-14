import { cert, getApps, initializeApp } from 'firebase-admin/app';
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

let cachedDb: Firestore | null = null;

export const getAdminDb = (): Firestore => {
  if (cachedDb) return cachedDb;

  const projectId = trim(process.env.FIREBASE_ADMIN_PROJECT_ID);
  const clientEmail = trim(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials');
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });

  cachedDb = getFirestore(app);
  return cachedDb;
};
