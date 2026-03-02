import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminMessaging } from '../lib/firebaseAdmin.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

type AlarmSlot = 'morning' | 'evening';

type HeaderValue = string | string[] | undefined;

interface LocalClock {
  dateKey: string;
  minuteOfDay: number;
}

const trim = (value: string | undefined): string => (value ?? '').trim();

const toHeaderString = (value: HeaderValue): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

const parseTimeToMinutes = (value: string | null, fallback: string): number => {
  const raw = value ?? fallback;
  const [hhRaw, mmRaw] = raw.split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return parseTimeToMinutes(fallback, fallback);
  }
  return Math.max(0, Math.min(23, hh)) * 60 + Math.max(0, Math.min(59, mm));
};

const getLocalClock = (date: Date, timeZone: string): LocalClock | null => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = map.year;
    const month = map.month;
    const day = map.day;
    const hour = Number(map.hour);
    const minute = Number(map.minute);

    if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    return {
      dateKey: `${year}-${month}-${day}`,
      minuteOfDay: hour * 60 + minute,
    };
  } catch {
    return null;
  }
};

const isDue = (
  nowMinute: number,
  targetMinute: number,
  alreadySentDate: string | null,
  dateKey: string,
): boolean => {
  if (alreadySentDate === dateKey) return false;
  const diff = nowMinute - targetMinute;
  return diff >= 0 && diff < 7;
};

const getAlarmMessage = (slot: AlarmSlot): { title: string; body: string } => {
  if (slot === 'morning') {
    return {
      title: 'SuperCoach 시작 체크인',
      body: '오늘 할 일을 함께 점검하고 조정해볼까요?',
    };
  }

  return {
    title: 'SuperCoach 하루 마무리 회고',
    body: '오늘의 완료를 함께 돌아보고, 다음 계획을 정리해요.',
  };
};

const sendAlarmPush = async (
  token: string,
  slot: AlarmSlot,
): Promise<void> => {
  const messaging = getAdminMessaging();
  const message = getAlarmMessage(slot);
  const link = `/?alarm=${slot}`;
  await messaging.send({
    token,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: {
      slot,
      tag: `alarm-${slot}`,
      link,
      title: message.title,
      body: message.body,
    },
    webpush: {
      fcmOptions: { link },
      notification: {
        title: message.title,
        body: message.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `alarm-${slot}`,
        data: { slot, link },
      },
    },
  });
};

const isInvalidTokenError = (error: unknown): boolean => {
  const code = String((error as { code?: string })?.code || '');
  return (
    code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token'
  );
};

const isCronAuthorized = (req: VercelRequest): boolean => {
  const expectedSecret = trim(process.env.CRON_SECRET);
  const authHeader = toHeaderString(req.headers.authorization);
  if (expectedSecret) {
    return authHeader === `Bearer ${expectedSecret}`;
  }

  if (toHeaderString(req.headers['x-vercel-cron']) === '1') {
    return true;
  }

  return process.env.NODE_ENV !== 'production';
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  try {
    const db = getAdminDb();
    const now = new Date();
    const usersSnap = await db.collection('users').get();

    let processedUsers = 0;
    let dueUsers = 0;
    let sentCount = 0;
    let invalidTokenCount = 0;

    for (const userDoc of usersSnap.docs) {
      processedUsers += 1;
      const uid = userDoc.id;
      const notifRef = db.doc(`users/${uid}/settings/notifications`);
      const notifSnap = await notifRef.get();
      if (!notifSnap.exists) continue;

      const raw = notifSnap.data() as Record<string, unknown>;
      const permission = asString(raw.notificationPermission);
      const token = asString(raw.fcmToken);
      if (permission !== 'granted' || !token) continue;

      const timeZone = asString(raw.timezone) || 'Asia/Seoul';
      const localClock = getLocalClock(now, timeZone);
      if (!localClock) continue;

      const morningEnabled = raw.morningEnabled === true;
      const eveningEnabled = raw.eveningEnabled === true;
      const morningMinute = parseTimeToMinutes(asString(raw.morningTime), '08:00');
      const eveningMinute = parseTimeToMinutes(asString(raw.eveningTime), '21:00');
      const lastMorningSentDate = asString(raw.lastMorningSentDate);
      const lastEveningSentDate = asString(raw.lastEveningSentDate);

      const shouldSendMorning = morningEnabled
        && isDue(
          localClock.minuteOfDay,
          morningMinute,
          lastMorningSentDate,
          localClock.dateKey,
        );
      const shouldSendEvening = eveningEnabled
        && isDue(
          localClock.minuteOfDay,
          eveningMinute,
          lastEveningSentDate,
          localClock.dateKey,
        );

      if (!shouldSendMorning && !shouldSendEvening) continue;
      dueUsers += 1;

      const updates: Record<string, unknown> = {
        updatedAt: Date.now(),
      };
      let tokenUsable = true;

      if (shouldSendMorning) {
        try {
          await sendAlarmPush(token, 'morning');
          sentCount += 1;
          updates.lastMorningSentDate = localClock.dateKey;
          updates.lastMorningSentAt = Date.now();
        } catch (error) {
          if (isInvalidTokenError(error)) {
            invalidTokenCount += 1;
            updates.fcmToken = '';
            tokenUsable = false;
          }
        }
      }

      if (shouldSendEvening && tokenUsable) {
        try {
          await sendAlarmPush(token, 'evening');
          sentCount += 1;
          updates.lastEveningSentDate = localClock.dateKey;
          updates.lastEveningSentAt = Date.now();
        } catch (error) {
          if (isInvalidTokenError(error)) {
            invalidTokenCount += 1;
            updates.fcmToken = '';
            tokenUsable = false;
          }
        }
      }

      await notifRef.set(updates, { merge: true });
    }

    return res.status(200).json({
      ok: true,
      processedUsers,
      dueUsers,
      sentCount,
      invalidTokenCount,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to process reminder push' });
  }
}
