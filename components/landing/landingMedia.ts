export type LandingMediaKey =
  | 'hero-impact'
  | 'mindmap-decompose'
  | 'todo-conquer'
  | 'future-self-visualization'
  | 'feedback-coverflow'
  | 'coach-chat';

export interface LandingMediaAsset {
  srcMp4?: string;
  srcWebm?: string;
  poster?: string;
  alt: string;
  aspectRatio: string;
  fallbackLabel: string;
}

const toPublicAssetUrl = (key: string): string | undefined => {
  const base = (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (!base) return undefined;
  return `${base}/${key}`;
};

const createMediaAsset = (
  videoKey: string,
  posterKey: string,
  alt: string,
  aspectRatio: string,
  fallbackLabel: string,
): LandingMediaAsset => ({
  srcMp4: toPublicAssetUrl(videoKey),
  srcWebm: undefined,
  poster: toPublicAssetUrl(posterKey),
  alt,
  aspectRatio,
  fallbackLabel,
});

export const landingMedia: Record<LandingMediaKey, LandingMediaAsset> = {
  'hero-impact': createMediaAsset(
    'landing/videos/hero-impact.mp4',
    'landing/posters/hero-impact.jpg',
    'Secret Coach hero product impact reel',
    '1080 / 2328',
    'Hero Impact Reel',
  ),
  'mindmap-decompose': createMediaAsset(
    'landing/videos/mindmap-decompose.mp4',
    'landing/posters/mindmap-decompose.jpg',
    'AI decomposes a mind map into next goals',
    '10 / 16',
    'Mind Map Decompose',
  ),
  'todo-conquer': createMediaAsset(
    'landing/videos/todo-conquer.mp4',
    'landing/posters/todo-conquer.jpg',
    'Todo completion counter animating upward',
    '10 / 16',
    'Victory Frame Todo',
  ),
  'future-self-visualization': createMediaAsset(
    'landing/videos/future-self-visualization.mp4',
    'landing/posters/future-self-visualization.jpg',
    'Future self visualization sequence',
    '10 / 16',
    'Future Self Visualization',
  ),
  'feedback-coverflow': createMediaAsset(
    'landing/videos/feedback-coverflow.mp4',
    'landing/posters/feedback-coverflow.jpg',
    'Weekly feedback cards in cover flow motion',
    '10 / 16',
    'Feedback Album',
  ),
  'coach-chat': createMediaAsset(
    'landing/videos/coach-chat.mp4',
    'landing/posters/coach-chat.jpg',
    'AI coach praising the user in evening feedback chat',
    '10 / 16',
    'Coach Chat',
  ),
};
