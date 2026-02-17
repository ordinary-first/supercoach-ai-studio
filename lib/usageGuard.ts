import { getAdminDb } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

type Resource =
  | 'chatMessages'
  | 'narrativeCalls'
  | 'imageCredits'
  | 'audioMinutes'
  | 'videoGenerations';

type PlanTier = 'explorer' | 'essential' | 'visionary' | 'master';

const PLAN_LIMITS: Record<PlanTier, Record<Resource, number>> = {
  explorer: {
    chatMessages: 300,
    narrativeCalls: 5,
    imageCredits: 8,
    audioMinutes: 0,
    videoGenerations: 0,
  },
  essential: {
    chatMessages: 2500,
    narrativeCalls: 20,
    imageCredits: 80,
    audioMinutes: 30,
    videoGenerations: 0,
  },
  visionary: {
    chatMessages: 6000,
    narrativeCalls: 40,
    imageCredits: 180,
    audioMinutes: 90,
    videoGenerations: 4,
  },
  master: {
    chatMessages: 15000,
    narrativeCalls: 80,
    imageCredits: 450,
    audioMinutes: 240,
    videoGenerations: 12,
  },
};

interface UsageResult {
  allowed: boolean;
  current: number;
  limit: number;
  trialExpired?: boolean;
}

const getMonthKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export async function checkAndIncrement(
  userId: string,
  resource: Resource,
  amount = 1,
): Promise<UsageResult> {
  if (!userId) return { allowed: false, current: 0, limit: 0 };

  const db = getAdminDb();
  const monthKey = getMonthKey();

  const profileSnap = await db
    .doc(`users/${userId}/profile/main`)
    .get();
  const rawPlan = profileSnap.data()?.billingPlan;
  const plan: PlanTier =
    rawPlan === 'essential' || rawPlan === 'visionary' || rawPlan === 'master'
      ? rawPlan
      : 'explorer';

  // 트라이얼 만료 체크 (무료 플랜만)
  const TRIAL_MS = 3 * 24 * 60 * 60 * 1000;
  if (plan === 'explorer') {
    const createdAt = profileSnap.data()?.createdAt;
    if (createdAt && Date.now() > createdAt + TRIAL_MS) {
      return { allowed: false, current: 0, limit: 0, trialExpired: true };
    }
  }

  const limit = PLAN_LIMITS[plan][resource];
  if (limit <= 0) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const usageRef = db.doc(`users/${userId}/usage/${monthKey}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const current: number = snap.data()?.[resource] ?? 0;

    if (current + amount > limit) {
      return { allowed: false, current, limit };
    }

    tx.set(
      usageRef,
      { [resource]: FieldValue.increment(amount), updatedAt: Date.now() },
      { merge: true },
    );

    return { allowed: true, current: current + amount, limit };
  });

  return result;
}

export function limitExceededResponse(
  resource: Resource,
  result: UsageResult,
) {
  if (result.trialExpired) {
    return {
      error: 'TRIAL_EXPIRED',
      resource,
      message: '무료 체험 기간이 종료되었습니다. 플랜을 업그레이드해 주세요.',
    };
  }
  return {
    error: 'LIMIT_EXCEEDED',
    resource,
    current: result.current,
    limit: result.limit,
    message: `월간 ${resource} 사용량을 초과했습니다 (${result.current}/${result.limit})`,
  };
}
