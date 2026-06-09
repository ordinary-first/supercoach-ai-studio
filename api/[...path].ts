import type { VercelRequest, VercelResponse } from '@vercel/node';

import cancelSubscription from '../server/api/cancel-subscription.js';
import changePlan from '../server/api/change-plan.js';
import chat from '../server/api/chat.js';
import createCheckout from '../server/api/create-checkout.js';
import decomposeGoal from '../server/api/decompose-goal.js';
import dreamChat from '../server/api/dream-chat.js';
import generateFeedback from '../server/api/generate-feedback.js';
import generateImage from '../server/api/generate-image.js';
import generateNarrative from '../server/api/generate-narrative.js';
import generateSpeech from '../server/api/generate-speech.js';
import generateVideo from '../server/api/generate-video.js';
import polarWebhook from '../server/api/polar-webhook.js';
import pushReminders from '../server/api/push-reminders.js';
import revenuecatWebhook from '../server/api/revenuecat-webhook.js';
import saveVisualization from '../server/api/save-visualization.js';
import syncSubscription from '../server/api/sync-subscription.js';
import uploadNodeImage from '../server/api/upload-node-image.js';
import uploadProfileGalleryImage from '../server/api/upload-profile-gallery-image.js';
import uploadVisualizationAsset from '../server/api/upload-visualization-asset.js';
import verifyCheckout from '../server/api/verify-checkout.js';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

const handlers: Record<string, ApiHandler> = {
  'cancel-subscription': cancelSubscription,
  'change-plan': changePlan,
  chat,
  'create-checkout': createCheckout,
  'decompose-goal': decomposeGoal,
  'dream-chat': dreamChat,
  'generate-feedback': generateFeedback,
  'generate-image': generateImage,
  'generate-narrative': generateNarrative,
  'generate-speech': generateSpeech,
  'generate-video': generateVideo,
  'polar-webhook': polarWebhook,
  'push-reminders': pushReminders,
  'revenuecat-webhook': revenuecatWebhook,
  'save-visualization': saveVisualization,
  'sync-subscription': syncSubscription,
  'upload-node-image': uploadNodeImage,
  'upload-profile-gallery-image': uploadProfileGalleryImage,
  'upload-visualization-asset': uploadVisualizationAsset,
  'verify-checkout': verifyCheckout,
};

const routeName = (req: VercelRequest): string => {
  const raw = req.query.path;
  if (Array.isArray(raw)) return raw.join('/');
  if (typeof raw === 'string') return raw;

  const path = new URL(req.url ?? '/', 'https://secretcoach.ai').pathname;
  return path.replace(/^\/api\/?/, '');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = routeName(req);
  const route = handlers[name];

  if (!route) {
    return res.status(404).json({ error: 'API route not found', route: name || null });
  }

  return route(req, res);
}
