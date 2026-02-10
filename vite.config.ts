import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    // .env.local 파일 + Vercel 시스템 환경변수 모두 사용
    const fileEnv = loadEnv(mode, '.', '');
    const env = { ...process.env, ...fileEnv };
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
        'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
        'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
        'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
        'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
        'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID),
        'process.env.FIREBASE_MEASUREMENT_ID': JSON.stringify(env.FIREBASE_MEASUREMENT_ID),
        '__APP_VERSION__': JSON.stringify(pkg.version)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
