// Wipe per-user app data in Firestore (goals/todos/profile/billing) for the current Firebase project.
//
// Safety:
// - Default is dry-run.
// - Requires `--confirm` to actually write/delete.
//
// Usage:
// - node scripts/wipe-user-data.mjs --dry-run
// - node scripts/wipe-user-data.mjs --all --confirm
// - node scripts/wipe-user-data.mjs --uids uid1,uid2 --confirm
// - node scripts/wipe-user-data.mjs --all --scope goals,todos --confirm
//
// Notes:
// - This does NOT delete Firebase Auth users. Only Firestore documents under `users/{uid}`.
// - We write empty payloads with a high `updatedAt` so localStorage won't "win" and repopulate Firestore.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    confirm: false,
    all: false,
    uids: [],
    scope: new Set(['goals', 'todos']),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') out.confirm = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--all') out.all = true;
    else if (a === '--uids') {
      const v = argv[i + 1];
      i++;
      out.uids = String(v || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--scope') {
      const v = argv[i + 1];
      i++;
      out.scope = new Set(
        String(v || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }

  if (out.confirm) out.dryRun = false;
  return out;
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Only set if not already provided by the environment.
    if (process.env[key] !== undefined) continue;
    // Strip surrounding quotes (supports multiline escaped \\n sequences).
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function requiredEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getPrivateKey() {
  const raw = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY');
  return raw.replace(/\\n/g, '\n');
}

function initAdmin() {
  if (getApps().length > 0) return;
  initializeApp({
    credential: cert({
      projectId: requiredEnv('FIREBASE_ADMIN_PROJECT_ID'),
      clientEmail: requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
      privateKey: getPrivateKey(),
    }),
  });
}

async function listAllAuthUids() {
  const auth = getAuth();
  const uids = [];
  let pageToken = undefined;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) uids.push(u.uid);
    pageToken = res.pageToken;
  } while (pageToken);
  return uids;
}

function makeEmptyGoalsPayload(updatedAt) {
  return {
    nodes: [
      {
        id: 'root',
        text: '나의 인생 비전',
        type: 'ROOT',
        status: 'PENDING',
        progress: 0,
        parentId: null,
        imageUrl: null,
        collapsed: false,
      },
    ],
    links: [],
    updatedAt,
  };
}

function makeEmptyTodosPayload(updatedAt) {
  return { items: [], updatedAt };
}

async function wipeUid(db, uid, scope, updatedAt) {
  const ops = [];

  if (scope.has('goals')) {
    ops.push(db.doc(`users/${uid}/data/goals`).set(makeEmptyGoalsPayload(updatedAt)));
  }

  if (scope.has('todos')) {
    ops.push(db.doc(`users/${uid}/data/todos`).set(makeEmptyTodosPayload(updatedAt)));
  }

  if (scope.has('profile')) {
    // Keep minimal doc so client has a consistent place to read from.
    ops.push(db.doc(`users/${uid}/profile/main`).set({ updatedAt }));
  }

  if (scope.has('billing')) {
    // Remove billing snapshot docs (keeps Auth user intact).
    ops.push(db.doc(`users/${uid}/billing/polar`).delete().catch(() => {}));
  }

  await Promise.all(ops);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  loadEnvLocal();
  initAdmin();

  const db = getFirestore();

  let targets = [];
  if (args.all) {
    targets = await listAllAuthUids();
  } else {
    targets = args.uids;
  }

  const scopeList = [...args.scope].sort().join(',');
  if (targets.length === 0) {
    console.error('No target uids. Use --all or --uids uid1,uid2');
    process.exit(1);
  }

  console.log(`[wipe-user-data] targets=${targets.length} scope=${scopeList} dryRun=${args.dryRun}`);

  if (args.dryRun) {
    console.log('[wipe-user-data] dry-run only. Add --confirm to execute.');
    return;
  }

  // Make this "win" against stale localStorage timestamps.
  const updatedAt = Date.now() + 365 * 24 * 60 * 60 * 1000;

  for (const uid of targets) {
    await wipeUid(db, uid, args.scope, updatedAt);
  }

  console.log('[wipe-user-data] done');
}

main().catch((e) => {
  console.error('[wipe-user-data] failed:', e?.message || e);
  process.exit(1);
});

