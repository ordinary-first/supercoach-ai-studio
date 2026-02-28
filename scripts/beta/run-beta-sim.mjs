import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from 'playwright';

const parseArg = (name, fallback) => {
  const key = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(key));
  return hit ? hit.slice(key.length) : fallback;
};

const USERS = Number.parseInt(parseArg('users', process.env.BETA_USERS ?? '100'), 10);
const ACTIONS_PER_USER = Number.parseInt(
  parseArg('actions', process.env.BETA_ACTIONS ?? '20'),
  10,
);
const PORT = Number.parseInt(parseArg('port', process.env.BETA_PORT ?? '4173'), 10);
const MODE = parseArg('mode', process.env.BETA_MODE ?? 'random');
const VERBOSE = parseArg('verbose', process.env.BETA_VERBOSE ?? '0') === '1';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DEV_AUTH_UID = parseArg('dev-auth-uid', process.env.BETA_DEV_AUTH_UID ?? 'beta-sim-user');

const loadEnvLocal = () => {
  const envPath = path.resolve(process.cwd(), '.env.local');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (process.env[key] !== undefined) continue;
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // optional for local runs
  }
};

const requiredEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`missing_env_${name}`);
  return value;
};

const findAdminKeyFile = () => {
  const explicit = [
    process.env.FIREBASE_ADMIN_KEY_FILE,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  for (const filePath of explicit) {
    if (existsSync(filePath)) return filePath;
  }

  const roots = [];
  let cursor = process.cwd();
  for (let depth = 0; depth < 4; depth += 1) {
    roots.push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  for (const root of roots) {
    try {
      const hit = readdirSync(root).find(
        (name) => name.includes('firebase-adminsdk') && name.endsWith('.json'),
      );
      if (hit) return path.join(root, hit);
    } catch {
      // keep searching
    }
  }

  return null;
};

const initAdminApp = () => {
  if (getApps().length > 0) return;
  const hasInlineEnv =
    Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID)
    && Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
    && Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (hasInlineEnv) {
    initializeApp({
      credential: cert({
        projectId: requiredEnv('FIREBASE_ADMIN_PROJECT_ID'),
        clientEmail: requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
        privateKey: requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  const keyFile = findAdminKeyFile();
  if (!keyFile) {
    throw new Error('firebase_admin_credentials_not_found');
  }

  const raw = JSON.parse(readFileSync(keyFile, 'utf8'));
  initializeApp({
    credential: cert({
      projectId: String(raw.project_id || ''),
      clientEmail: String(raw.client_email || ''),
      privateKey: String(raw.private_key || ''),
    }),
  });
};

const createDevAuthToken = async () => {
  try {
    initAdminApp();
    return await getAuth().createCustomToken(DEV_AUTH_UID);
  } catch {
    return null;
  }
};

const TAB_NAMES = {
  GOALS: ['Goals', '목표'],
  CALENDAR: ['Schedule', '일정'],
  TODO: ['To-Do', '할 일'],
  VISUALIZE: ['Visualize', '시각화'],
  FEEDBACK: ['Feedback', '피드백'],
};

const OPEN_COACH_NAMES = ['Open AI Coach', 'AI 코치 열기'];
const SETTINGS_OPEN_NAMES = ['Open settings'];
const SETTINGS_CLOSE_NAMES = ['Close settings'];

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const chance = (rnd, p) => rnd() < p;

const takeShuffled = (arr, rnd, count) => {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, count);
};

const uniqueByName = (actions) => {
  const seen = new Set();
  const out = [];
  for (const action of actions) {
    if (seen.has(action.name)) continue;
    seen.add(action.name);
    out.push(action);
  }
  return out;
};

const compactError = (error) => {
  if (!error) return 'unknown_error';
  if (typeof error === 'string') return error.slice(0, 240);
  if (error?.message) return String(error.message).slice(0, 240);
  return JSON.stringify(error).slice(0, 240);
};

const compactStack = (error) => {
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  if (!stack) return undefined;
  return stack.split('\n').slice(0, 8).join('\n').slice(0, 1000);
};

const shouldIgnoreConsoleError = (message) => {
  const text = String(message || '');
  if (text.includes('[Billing] Polar sync failed')) return true;
  if (text.includes('Failed to load resource: the server responded with a status of 404')) {
    return true;
  }
  return false;
};

const fingerprint = (message) =>
  message.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 180);

const waitForServer = async (url, timeoutMs = 90000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`dev server did not respond within ${timeoutMs}ms: ${url}`);
};

const waitForAppReady = async (page, options = {}) => {
  const timeoutMs = options.timeoutMs ?? 30000;
  const hasDevToken = options.hasDevToken ?? false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const openSettings = page.getByRole('button', {
      name: 'Open settings',
      exact: true,
    });
    if ((await openSettings.count()) > 0) return;

    const loginBtn = page.getByRole('button', {
      name: 'Google Login',
      exact: true,
    });
    if ((await loginBtn.count()) > 0) {
      throw new Error(
        'app_not_authenticated_in_dev: login screen visible. '
        + (hasDevToken
          ? 'Dev custom-token auth failed. Check FIREBASE_ADMIN_* env.'
          : 'Anonymous auth likely disabled. Enable it or provide FIREBASE_ADMIN_* env for devToken.'),
      );
    }

    const landingCta = page.getByRole('button', {
      name: /Start Free|Get Started|무료 시작|시작하기/,
    });
    if ((await landingCta.count()) > 0) {
      throw new Error(
        'app_not_authenticated_in_dev: landing CTA visible. '
        + (hasDevToken
          ? 'Dev custom-token auth failed before app bootstrap.'
          : 'Anonymous auth likely failed or is disabled.'),
      );
    }

    await sleep(250);
  }
  throw new Error(`app_not_ready_within_${timeoutMs}ms`);
};

const clickByAnyLabel = async (page, labels) => {
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if ((await btn.count()) > 0) {
      await btn.first().click({ timeout: 3000 });
      return true;
    }
  }
  return false;
};

const switchTab = async (page, tabKey) => clickByAnyLabel(page, TAB_NAMES[tabKey]);

const openSettings = async (page) => clickByAnyLabel(page, SETTINGS_OPEN_NAMES);

const closeSettings = async (page) => {
  const closed = await clickByAnyLabel(page, SETTINGS_CLOSE_NAMES);
  if (closed) return;
  const x = page.getByRole('button', { name: /Close/i });
  if ((await x.count()) > 0) await x.first().click({ timeout: 2000 });
};

const actionSwitchTab = async (page, rnd) => {
  const tabKey = pick(Object.keys(TAB_NAMES), rnd);
  await switchTab(page, tabKey);
};

const actionTodoAdd = async (page, rnd, userId, step) => {
  await switchTab(page, 'TODO');
  const input = page.locator(
    'input[aria-label="New to-do input"], input[aria-label="할 일 입력"]',
  );
  if ((await input.count()) === 0) return;
  await input.first().click({ timeout: 3000 });
  await input.first().fill(`beta-u${userId}-step${step}-v${Math.floor(rnd() * 10000)}`);
  await input.first().press('Enter');
};

const actionTodoToggleFirst = async (page) => {
  await switchTab(page, 'TODO');
  const row = page.locator('div.apple-card').filter({ hasText: 'beta-u' }).first();
  if ((await row.count()) === 0) return;
  const toggle = row.locator('button').first();
  if ((await toggle.count()) > 0) {
    await toggle.click({ timeout: 3000 });
  }
};

const actionOpenCloseSettings = async (page) => {
  const opened = await openSettings(page);
  if (!opened) return;
  await closeSettings(page);
};

const actionSettingsToggleLanguage = async (page) => {
  const opened = await openSettings(page);
  if (!opened) return;

  const languageSelect = page.locator('select').filter({
    has: page.locator('option[value="en"]'),
  }).first();

  if ((await languageSelect.count()) > 0) {
    const current = await languageSelect.inputValue();
    await languageSelect.selectOption(current === 'ko' ? 'en' : 'ko');
  }

  await closeSettings(page);
};

const actionSettingsToggleTheme = async (page, rnd) => {
  const opened = await openSettings(page);
  if (!opened) return;

  for (const label of takeShuffled(['System', 'Light', 'Dark'], rnd, 3)) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if ((await btn.count()) > 0) {
      await btn.first().click({ timeout: 3000 });
      break;
    }
  }

  await closeSettings(page);
};

const actionOpenCloseCoach = async (page) => {
  const opened = await clickByAnyLabel(page, OPEN_COACH_NAMES);
  if (!opened) return;
  const closeBtn = page.getByRole('button', { name: 'Close', exact: true });
  if ((await closeBtn.count()) > 0) {
    await closeBtn.first().click({ timeout: 3000 });
  }
};

const actionFeedbackTap = async (page) => {
  await switchTab(page, 'FEEDBACK');
  await page.mouse.wheel(0, 350);
  await sleep(80);
  await page.mouse.click(220, 320);
};

const actionFeedbackHeavyScroll = async (page) => {
  await switchTab(page, 'FEEDBACK');
  await page.mouse.wheel(0, 1200);
  await sleep(60);
  await page.mouse.wheel(0, -900);
  await sleep(60);
  await page.mouse.click(220, 330);
};

const actionCalendarTap = async (page) => {
  await switchTab(page, 'CALENDAR');
  await page.mouse.click(200, 320);
};

const actionVisualizeTap = async (page, rnd) => {
  await switchTab(page, 'VISUALIZE');
  const textArea = page.locator('textarea').first();
  if ((await textArea.count()) > 0) {
    const prompt = chance(rnd, 0.5)
      ? 'beta simulation sanity check'
      : 'long-term dream scene for reliability test';
    await textArea.fill(prompt);
  }
};

const actionRapidTabBurst = async (page, rnd) => {
  const order = takeShuffled(['GOALS', 'TODO', 'CALENDAR', 'VISUALIZE', 'FEEDBACK'], rnd, 5);
  for (const key of order) {
    await switchTab(page, key);
    await sleep(35 + Math.floor(rnd() * 50));
  }
};

const actionViewportJitter = async (page, rnd) => {
  const vp = page.viewportSize();
  if (!vp) return;
  const width = Math.max(360, Math.min(1600, vp.width + Math.floor((rnd() - 0.5) * 220)));
  const height = Math.max(640, Math.min(1200, vp.height + Math.floor((rnd() - 0.5) * 260)));
  await page.setViewportSize({ width, height });
};

const buildJourneyRandomActions = (rnd) => {
  const blockTodo = [
    { name: 'tab-todo', run: async (page) => switchTab(page, 'TODO') },
    { name: 'todo-add', run: actionTodoAdd },
    { name: 'todo-toggle-first', run: actionTodoToggleFirst },
  ];
  const blockCalendar = [
    { name: 'tab-calendar', run: async (page) => switchTab(page, 'CALENDAR') },
    { name: 'calendar-interact', run: actionCalendarTap },
  ];
  const blockVisualize = [
    { name: 'tab-visualize', run: async (page) => switchTab(page, 'VISUALIZE') },
    { name: 'visualize-interact', run: actionVisualizeTap },
  ];
  const blockFeedback = [
    { name: 'tab-feedback', run: async (page) => switchTab(page, 'FEEDBACK') },
    { name: 'feedback-interact', run: actionFeedbackTap },
  ];

  const optionalBlocks = [
    [{ name: 'settings-open-close', run: actionOpenCloseSettings }],
    [{ name: 'settings-toggle-language', run: actionSettingsToggleLanguage }],
    [{ name: 'settings-toggle-theme', run: actionSettingsToggleTheme }],
    [{ name: 'coach-open-close', run: actionOpenCloseCoach }],
    [{ name: 'feedback-heavy-scroll', run: actionFeedbackHeavyScroll }],
    [{ name: 'rapid-tab-burst', run: actionRapidTabBurst }],
    [{ name: 'viewport-jitter', run: actionViewportJitter }],
    [{ name: 'tab-goals-peek', run: async (page) => switchTab(page, 'GOALS') }],
  ];

  const required = [blockTodo, blockCalendar, blockVisualize, blockFeedback];
  const selectedOptional = takeShuffled(optionalBlocks, rnd, 3 + Math.floor(rnd() * 4));
  const mixed = takeShuffled([...required, ...selectedOptional], rnd, required.length + selectedOptional.length);

  return uniqueByName([
    { name: 'tab-goals-start', run: async (page) => switchTab(page, 'GOALS') },
    ...mixed.flat(),
    { name: 'tab-goals-end', run: async (page) => switchTab(page, 'GOALS') },
  ]);
};

const buildActionPlan = (rnd) => {
  const randomPool = [
    { name: 'switch-tab', run: actionSwitchTab },
    { name: 'todo-add', run: actionTodoAdd },
    { name: 'todo-toggle-first', run: actionTodoToggleFirst },
    { name: 'settings-open-close', run: actionOpenCloseSettings },
    { name: 'settings-toggle-language', run: actionSettingsToggleLanguage },
    { name: 'settings-toggle-theme', run: actionSettingsToggleTheme },
    { name: 'coach-open-close', run: actionOpenCloseCoach },
    { name: 'feedback-interact', run: actionFeedbackTap },
    { name: 'feedback-heavy-scroll', run: actionFeedbackHeavyScroll },
    { name: 'calendar-interact', run: actionCalendarTap },
    { name: 'visualize-interact', run: actionVisualizeTap },
    { name: 'rapid-tab-burst', run: actionRapidTabBurst },
    { name: 'viewport-jitter', run: actionViewportJitter },
  ];

  const smokePlan = [
    { name: 'tab-goals', run: async (page) => switchTab(page, 'GOALS') },
    { name: 'tab-todo', run: async (page) => switchTab(page, 'TODO') },
    { name: 'todo-add', run: actionTodoAdd },
    { name: 'tab-calendar', run: async (page) => switchTab(page, 'CALENDAR') },
    { name: 'calendar-interact', run: actionCalendarTap },
    { name: 'tab-visualize', run: async (page) => switchTab(page, 'VISUALIZE') },
    { name: 'visualize-interact', run: actionVisualizeTap },
    { name: 'tab-feedback', run: async (page) => switchTab(page, 'FEEDBACK') },
    { name: 'feedback-interact', run: actionFeedbackTap },
    { name: 'settings-open-close', run: actionOpenCloseSettings },
    { name: 'coach-open-close', run: actionOpenCloseCoach },
    { name: 'tab-goals-end', run: async (page) => switchTab(page, 'GOALS') },
  ];

  const journeyPlan = [
    { name: 'tab-goals', run: async (page) => switchTab(page, 'GOALS') },
    { name: 'tab-todo', run: async (page) => switchTab(page, 'TODO') },
    { name: 'todo-add-1', run: actionTodoAdd },
    { name: 'todo-toggle', run: actionTodoToggleFirst },
    { name: 'settings-open-close', run: actionOpenCloseSettings },
    { name: 'tab-calendar', run: async (page) => switchTab(page, 'CALENDAR') },
    { name: 'calendar-interact', run: actionCalendarTap },
    { name: 'tab-visualize', run: async (page) => switchTab(page, 'VISUALIZE') },
    { name: 'visualize-interact', run: actionVisualizeTap },
    { name: 'tab-feedback', run: async (page) => switchTab(page, 'FEEDBACK') },
    { name: 'feedback-heavy-scroll', run: actionFeedbackHeavyScroll },
    { name: 'coach-open-close', run: actionOpenCloseCoach },
    { name: 'tab-goals-end', run: async (page) => switchTab(page, 'GOALS') },
  ];

  if (MODE === 'journey-random') return { type: 'plan', actions: buildJourneyRandomActions(rnd) };
  if (MODE === 'journey') return { type: 'plan', actions: journeyPlan };
  if (MODE === 'smoke') return { type: 'plan', actions: smokePlan };
  return { type: 'random', actions: randomPool };
};

const runSingleScenario = async (browser, id, actionCount, options = {}) => {
  const devAuthToken = options.devAuthToken ?? null;
  const rnd = mulberry32(1000 + id);
  const mobile = rnd() > 0.35;
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  const errors = [];
  const actionErrors = [];
  const executedNames = [];

  page.on('pageerror', (error) => {
    errors.push({
      type: 'pageerror',
      message: compactError(error),
      stack: compactStack(error),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (shouldIgnoreConsoleError(text)) return;
      errors.push({ type: 'console', message: text.slice(0, 240) });
    }
  });

  const plan = buildActionPlan(rnd);
  const query = devAuthToken
    ? `?dev=1&devToken=${encodeURIComponent(devAuthToken)}`
    : '?dev=1';

  try {
    await page.goto(`${BASE_URL}/${query}`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page, { hasDevToken: Boolean(devAuthToken) });

    const totalSteps = plan.type === 'random'
      ? actionCount
      : Math.min(actionCount, plan.actions.length);

    for (let step = 0; step < totalSteps; step += 1) {
      const action = plan.type === 'random'
        ? pick(plan.actions, rnd)
        : plan.actions[step];

      executedNames.push(action.name);

      try {
        if (VERBOSE) {
          process.stdout.write(`[beta-sim] scenario=${id} step=${step} action=${action.name}\n`);
        }
        await action.run(page, rnd, id, step);
      } catch (error) {
        actionErrors.push({
          step,
          action: action.name,
          message: compactError(error),
        });
      }

      await sleep(40 + Math.floor(rnd() * 100));
    }
  } finally {
    await context.close();
  }

  return {
    scenarioId: id,
    mobile,
    errors,
    actionErrors,
    signature: executedNames.join(' > '),
  };
};

const main = async () => {
  loadEnvLocal();
  const devAuthToken = await createDevAuthToken();
  const authMode = devAuthToken ? 'custom-token' : 'anonymous';

  const serverCommand = process.platform === 'win32'
    ? {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', `pnpm exec vite --host 127.0.0.1 --port ${PORT} --strictPort`],
      }
    : {
        command: 'pnpm',
        args: ['exec', 'vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
      };

  const server = spawn(serverCommand.command, serverCommand.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serverLogs = [];
  const capture = (chunk) => {
    if (serverLogs.length > 1200) return;
    serverLogs.push(String(chunk));
  };
  server.stdout.on('data', capture);
  server.stderr.on('data', capture);

  try {
    await waitForServer(BASE_URL);
    process.stdout.write(`[beta-sim] devAuthMode=${authMode}\n`);

    const browser = await chromium.launch({ headless: true });
    const runs = [];
    const usedSignatures = new Set();

    for (let i = 1; i <= USERS; i += 1) {
      let result = null;
      let retry = 0;
      while (retry < 16) {
        const scenarioId = i * 100 + retry;
        result = await runSingleScenario(browser, scenarioId, ACTIONS_PER_USER, {
          devAuthToken,
        });

        if (MODE === 'journey-random') {
          if (usedSignatures.has(result.signature)) {
            retry += 1;
            continue;
          }
          usedSignatures.add(result.signature);
        }
        break;
      }

      if (!result) {
        throw new Error(`failed to generate unique scenario for index=${i}`);
      }

      runs.push(result);
      if (i % 10 === 0) {
        process.stdout.write(`[beta-sim] completed ${i}/${USERS} scenarios\n`);
      }
    }

    await browser.close();

    const issues = new Map();
    for (const run of runs) {
      for (const err of run.errors) {
        const key = fingerprint(`${err.type}: ${err.message}`);
        issues.set(key, (issues.get(key) ?? 0) + 1);
      }
      for (const err of run.actionErrors) {
        const key = fingerprint(`action:${err.action}:${err.message}`);
        issues.set(key, (issues.get(key) ?? 0) + 1);
      }
    }

    const summary = {
      mode: MODE,
      devAuthMode: authMode,
      users: USERS,
      actionsPerUser: ACTIONS_PER_USER,
      totalScenarios: runs.length,
      uniqueScenarioSignatures: new Set(runs.map((r) => r.signature)).size,
      scenariosWithErrors: runs.filter((r) => r.errors.length > 0 || r.actionErrors.length > 0).length,
      totalErrors:
        runs.reduce((acc, r) => acc + r.errors.length, 0)
        + runs.reduce((acc, r) => acc + r.actionErrors.length, 0),
      topIssueFingerprints: [...issues.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([message, count]) => ({ message, count })),
    };

    const report = { summary, runs };
    const reportDir = path.join(process.cwd(), 'reports');
    await mkdir(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'beta-sim-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    process.stdout.write(
      `[beta-sim] mode=${MODE}, users=${USERS}, actions=${ACTIONS_PER_USER}\n`
      + `[beta-sim] report written: ${reportPath}\n`
      + `[beta-sim] uniqueScenarioSignatures=${summary.uniqueScenarioSignatures}\n`
      + `[beta-sim] scenariosWithErrors=${summary.scenariosWithErrors}, totalErrors=${summary.totalErrors}\n`,
    );

    if (summary.scenariosWithErrors > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  }
};

main().catch((error) => {
  process.stderr.write(`[beta-sim] fatal: ${compactError(error)}\n`);
  process.exit(1);
});
