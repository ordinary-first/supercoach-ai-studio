import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const DEV_SERVICE_ACCOUNT_CANDIDATES = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  path.resolve(__dirname, '../coach-52bf4-firebase-adminsdk-fbsvc-c7bf9ad338.json'),
].filter((value): value is string => Boolean(value));

const resolveDevServiceAccountPath = () =>
  DEV_SERVICE_ACCOUNT_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;

const createDevAuthPlugin = () => ({
  name: 'dev-firebase-auth-token',
  configureServer(server) {
    server.middlewares.use('/__dev/custom-token', async (req, res) => {
      try {
        const serviceAccountPath = resolveDevServiceAccountPath();
        if (!serviceAccountPath) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing Firebase service account key for dev auth.' }));
          return;
        }

        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
        const { cert, getApps, initializeApp } = await import('firebase-admin/app');
        const { getAuth } = await import('firebase-admin/auth');
        if (!getApps().length) {
          initializeApp({ credential: cert(serviceAccount) });
        }

        const requestUrl = new URL(req.url ?? '/', 'http://localhost');
        const uid = requestUrl.searchParams.get('uid') || 'dev-preview-user';
        const token = await getAuth().createCustomToken(uid);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ token }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Failed to create dev auth token.',
          }),
        );
      }
    });
  },
});

export default defineConfig(({ mode }) => {
    // .env.local 파일 + Vercel 시스템 환경변수 모두 사용
    const fileEnv = loadEnv(mode, '.', '');
    const env = { ...process.env, ...fileEnv };
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), createDevAuthPlugin()],
      define: {
        'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
        'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
        'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
        'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
        'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
        'process.env.FIREBASE_VAPID_KEY': JSON.stringify(env.FIREBASE_VAPID_KEY),
        'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID),
        'process.env.FIREBASE_MEASUREMENT_ID': JSON.stringify(env.FIREBASE_MEASUREMENT_ID),
        '__APP_VERSION__': JSON.stringify(pkg.displayVersion || pkg.version)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom'],
      }
    };
});
