import { useState, useCallback, useEffect, useRef } from 'react';
import { UserProfile, GoalNode } from '../types';
import {
  generateSuccessNarrative,
  generateSpeech,
  generateVideo,
  pollVideoStatus,
  generateVisualizationImage,
  uploadVisualizationAsset,
} from '../services/aiService';
import {
  deleteVisualization,
  getUserId,
  loadVisualizations,
  saveVisualization,
  saveVisualizationViaApi,
  SavedVisualization,
  VisualizationWriteInput,
  updateVisualization,
} from '../services/firebaseService';
import { useTranslation } from '../i18n/useTranslation';

// ---------- Types ----------

export type GenerationStatus = 'idle' | 'completed' | 'failed';
export type SavedVideoStatus = 'idle' | 'pending' | 'ready' | 'failed';

export type ErrorMeta = {
  code?: string;
  message?: string;
  requestId?: string;
};

export interface VisualizationResult {
  inputText: string;
  text?: string;
  imageUrl?: string;
  imageDataUrl?: string;
  audioData?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoId?: string;
  visualizationId?: string;
  textStatus: GenerationStatus;
  imageStatus: GenerationStatus;
  audioStatus: GenerationStatus;
  videoStatus: SavedVideoStatus;
  imageError?: ErrorMeta;
  audioError?: ErrorMeta;
  videoError?: ErrorMeta;
}

export interface GenerationSettings {
  text: boolean;
  image: boolean;
  video: boolean;
  audio: boolean;
}

// ---------- Utils ----------

const VIDEO_DURATION_SEC = 4;

export const getActiveUserId = (profile: UserProfile | null): string | null => {
  return getUserId() || profile?.googleId || null;
};

const toErrorMeta = (error: unknown): ErrorMeta => {
  if (!error || typeof error !== 'object') return {};
  const source = error as Record<string, unknown>;
  return {
    code: typeof source.code === 'string' ? source.code : undefined,
    message: typeof source.message === 'string' ? source.message : undefined,
    requestId: typeof source.requestId === 'string' ? source.requestId : undefined,
  };
};

const formatErrorMeta = (prefix: string, error?: ErrorMeta): string => {
  if (!error) return prefix;
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (error.code) parts.push(`Code: ${error.code}`);
  if (error.requestId) parts.push(`ID: ${error.requestId}`);
  return parts.length ? `${prefix} [${parts.join(' | ')}]` : prefix;
};

export const sanitizeFirestoreString = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  let normalized = value;
  try {
    normalized = new TextDecoder().decode(new TextEncoder().encode(value));
  } catch { normalized = value; }
  const cleaned = normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .trim();
  return cleaned || undefined;
};

const sanitizeStorageUrl = (value?: string): string | undefined => {
  const clean = sanitizeFirestoreString(value);
  if (!clean) return undefined;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return undefined;
  return clean.slice(0, 4000);
};

const sanitizeVideoId = (value?: string): string | undefined => {
  const clean = sanitizeFirestoreString(value);
  if (!clean) return undefined;
  return clean.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
};

export const toResultFromSaved = (item: SavedVisualization): VisualizationResult => ({
  visualizationId: item.id,
  inputText: item.inputText,
  text: item.text,
  imageUrl: item.imageUrl,
  audioUrl: item.audioUrl,
  videoUrl: item.videoUrl,
  videoId: item.videoId,
  textStatus: item.text ? 'completed' : 'idle',
  imageStatus: item.imageUrl ? 'completed' : 'idle',
  audioStatus: item.audioUrl ? 'completed' : 'idle',
  videoStatus: item.videoUrl ? 'ready' : item.videoStatus || 'idle',
});

const toPersistedVideoStatus = (
  status: SavedVideoStatus,
): 'pending' | 'ready' | 'failed' | undefined => {
  if (status === 'pending') return 'pending';
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  return undefined;
};

// ---------- Hook ----------

interface GenerationPipelineOptions {
  userProfile: UserProfile | null;
  nodes: GoalNode[];
  isOpen: boolean;
}

export function useGenerationPipeline({ userProfile, nodes, isOpen }: GenerationPipelineOptions) {
  const { t } = useTranslation();
  const activeUserId = getActiveUserId(userProfile);
  const isDevSession =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has('dev');
  const mountedRef = useRef(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPendingVideo, setIsCheckingPendingVideo] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [currentResult, setCurrentResult] = useState<VisualizationResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedVisualization[]>([]);

  const clearMessages = useCallback(() => {
    setErrorMessage('');
    setInfoMessage('');
  }, []);

  // Ref for auto-save from handleGenerate (avoids circular dep)
  const saveRef = useRef<(r: VisualizationResult) => Promise<void>>();

  // Load saved items on open
  useEffect(() => {
    if (!isOpen || !activeUserId || isDevSession) {
      setSavedItems([]);
      return;
    }
    let cancelled = false;
    loadVisualizations(activeUserId)
      .then((items) => { if (!cancelled) setSavedItems(items); })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(formatErrorMeta(t.visualization.loadFailed, toErrorMeta(error)));
      });
    return () => { cancelled = true; };
  }, [activeUserId, isOpen, t.visualization.loadFailed, isDevSession]);

  // Reset on close
  useEffect(() => {
    if (isOpen) clearMessages();
  }, [clearMessages, isOpen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshPendingVideo = useCallback(async (target: VisualizationResult) => {
    if (isDevSession) return;
    if (!activeUserId || !target.videoId || target.videoStatus !== 'pending') return;
    setIsCheckingPendingVideo(true);
    clearMessages();
    try {
      const result = await pollVideoStatus(target.videoId, activeUserId, VIDEO_DURATION_SEC);
      if (result.videoUrl) {
        const updates = { videoUrl: result.videoUrl, videoStatus: 'ready' as const, videoId: target.videoId };
        setCurrentResult((prev) => (prev ? { ...prev, ...updates } : prev));
        setSavedItems((prev) => prev.map((item) => (item.id === target.visualizationId ? { ...item, ...updates } : item)));
        if (target.visualizationId) await updateVisualization(activeUserId, target.visualizationId, updates);
        setInfoMessage(t.visualization.videoComplete);
        return;
      }
      if (result.status === 'failed') {
        const videoError = { code: result.errorCode, message: result.errorMessage, requestId: result.requestId };
        setCurrentResult((prev) => (prev ? { ...prev, videoStatus: 'failed', videoError } : prev));
        if (target.visualizationId) {
          await updateVisualization(activeUserId, target.visualizationId, { videoStatus: 'failed', videoId: target.videoId });
        }
        setErrorMessage(formatErrorMeta(t.visualization.videoFailed, videoError));
        return;
      }
      setInfoMessage(t.visualization.videoStillProcessing);
    } catch (error: unknown) {
      setErrorMessage(formatErrorMeta(t.visualization.videoCheckFailed, toErrorMeta(error)));
    } finally {
      setIsCheckingPendingVideo(false);
    }
  }, [activeUserId, clearMessages, t, isDevSession]);

  const handleGenerate = useCallback(async (
    inputText: string,
    settings: GenerationSettings,
    referenceImages: string[],
    imageQuality: 'medium' | 'high',
  ) => {
    setIsGenerating(true);
    setIsSaved(false);
    clearMessages();

    let wakeLock: WakeLockSentinel | null = null;
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* unsupported */ }

    const result: VisualizationResult = {
      inputText,
      textStatus: 'idle',
      imageStatus: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle',
    };

    try {
      const goalContext = nodes.map((n) => `- ${n.text}`).join('\n');
      const fullPrompt = inputText || goalContext;
      const generationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (settings.text) {
        setGeneratingStep(t.visualization.stepText);
        result.text = await generateSuccessNarrative(fullPrompt, userProfile, activeUserId);
        result.textStatus = result.text ? 'completed' : 'failed';
        if (mountedRef.current) setCurrentResult({ ...result });
      }

      if (settings.image) {
        setGeneratingStep(t.visualization.stepImage);
        const imageResult = await generateVisualizationImage(fullPrompt, referenceImages, userProfile, imageQuality, activeUserId, generationId);
        if (imageResult.status === 'completed' && imageResult.imageUrl) {
          result.imageUrl = imageResult.imageUrl;
          result.imageDataUrl = imageResult.imageDataUrl;
          result.imageStatus = 'completed';
        } else {
          result.imageStatus = 'failed';
          result.imageError = { code: imageResult.errorCode, message: imageResult.errorMessage, requestId: imageResult.requestId };
        }
        if (mountedRef.current) setCurrentResult({ ...result });
      }

      if (settings.audio) {
        setGeneratingStep(t.visualization.stepAudio);
        const speechResult = await generateSpeech(result.text || fullPrompt, activeUserId, generationId);
        if (speechResult.status === 'completed' && (speechResult.audioUrl || speechResult.audioData)) {
          result.audioUrl = speechResult.audioUrl;
          result.audioData = speechResult.audioData;
          result.audioStatus = 'completed';
        } else {
          result.audioStatus = 'failed';
          result.audioError = { code: speechResult.errorCode, message: speechResult.errorMessage, requestId: speechResult.requestId };
        }
        if (mountedRef.current) setCurrentResult({ ...result });
      }

      if (settings.video) {
        setGeneratingStep(t.visualization.stepVideo);
        const videoResult = await generateVideo(fullPrompt, userProfile, VIDEO_DURATION_SEC);
        result.videoId = videoResult.videoId;
        result.videoUrl = videoResult.videoUrl;
        result.videoError = { code: videoResult.errorCode, message: videoResult.errorMessage, requestId: videoResult.requestId };
        if (videoResult.videoUrl) result.videoStatus = 'ready';
        else if (videoResult.status === 'queued' || videoResult.status === 'in_progress') result.videoStatus = 'pending';
        else result.videoStatus = 'failed';
        if (mountedRef.current) setCurrentResult({ ...result });
      }

      // Aggregate error/info messages
      if (result.imageStatus === 'failed') {
        setErrorMessage((prev) => prev ? `${prev} ${formatErrorMeta(t.visualization.imageFailed, result.imageError)}` : formatErrorMeta(t.visualization.imageFailed, result.imageError));
      }
      if (result.audioStatus === 'failed') {
        setErrorMessage((prev) => prev ? `${prev} ${formatErrorMeta(t.visualization.audioFailed, result.audioError)}` : formatErrorMeta(t.visualization.audioFailed, result.audioError));
      }
      if (result.videoStatus === 'pending') setInfoMessage(t.visualization.videoQueued);
      if (result.videoStatus === 'failed') {
        setErrorMessage((prev) => prev ? `${prev} ${formatErrorMeta(t.visualization.videoGenFailed, result.videoError)}` : formatErrorMeta(t.visualization.videoGenFailed, result.videoError));
      }

      setCurrentResult(result);

      // 자동 저장
      if (result.text || result.imageUrl || result.audioUrl || result.videoUrl) {
        void saveRef.current?.(result);
      }

      return result;
    } catch (error: unknown) {
      setErrorMessage(formatErrorMeta(t.visualization.generationError, toErrorMeta(error)));
      return null;
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
      if (wakeLock) { try { await wakeLock.release(); } catch { /* ignore */ } }
    }
  }, [activeUserId, clearMessages, nodes, t, userProfile]);

  const handleSave = useCallback(async (resultToSave?: VisualizationResult | null) => {
    const target = resultToSave ?? currentResult;
    if (!target || isSaving) return;

    if (isDevSession) {
      const localSaved: SavedVisualization = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        inputText: target.inputText || 'Visualization',
        text: target.text,
        imageUrl: target.imageUrl,
        audioUrl: target.audioUrl,
        videoUrl: target.videoUrl,
        videoId: target.videoId,
        videoStatus: toPersistedVideoStatus(target.videoStatus),
        updatedAt: Date.now(),
      };
      setSavedItems((prev) => [localSaved, ...prev]);
      setCurrentResult((prev) =>
        prev ? { ...prev, visualizationId: localSaved.id } : prev,
      );
      setIsSaved(true);
      return;
    }

    if (!activeUserId) {
      setErrorMessage(t.visualization.loginRequired);
      return;
    }
    setIsSaving(true);
    setInfoMessage('');

    try {
      const visualizationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let imageUrl = target.imageUrl;
      if (imageUrl?.startsWith('data:')) {
        imageUrl = await uploadVisualizationAsset('image', activeUserId, visualizationId, { dataUrl: imageUrl });
      }

      let audioUrl = target.audioUrl;
      if (!audioUrl && target.audioData) {
        audioUrl = await uploadVisualizationAsset('audio', activeUserId, visualizationId, { audioData: target.audioData });
      }

      let videoUrl = target.videoUrl;
      if (videoUrl?.startsWith('data:')) {
        videoUrl = await uploadVisualizationAsset('video', activeUserId, visualizationId, { dataUrl: videoUrl });
      }

      const payload: VisualizationWriteInput = {
        inputText: sanitizeFirestoreString(target.inputText) || sanitizeFirestoreString(target.text) || 'Visualization',
      };
      const cleanText = sanitizeFirestoreString(target.text)?.slice(0, 50000);
      const cleanImageUrl = sanitizeStorageUrl(imageUrl);
      const cleanAudioUrl = sanitizeStorageUrl(audioUrl);
      const cleanVideoUrl = sanitizeStorageUrl(videoUrl);
      const cleanVideoId = sanitizeVideoId(target.videoId);
      if (cleanText) payload.text = cleanText;
      if (cleanImageUrl) payload.imageUrl = cleanImageUrl;
      if (cleanAudioUrl) payload.audioUrl = cleanAudioUrl;
      if (cleanVideoUrl) payload.videoUrl = cleanVideoUrl;
      if (cleanVideoId) payload.videoId = cleanVideoId;
      const persistedVideoStatus = videoUrl ? 'ready' : toPersistedVideoStatus(target.videoStatus);
      if (persistedVideoStatus) payload.videoStatus = persistedVideoStatus;

      let saved: SavedVisualization;
      try {
        saved = await saveVisualization(activeUserId, payload);
      } catch (primaryError: unknown) {
        const primaryMeta = toErrorMeta(primaryError);
        try {
          saved = await saveVisualizationViaApi(payload, visualizationId);
          setInfoMessage(formatErrorMeta(t.visualization.saveFallback, primaryMeta));
        } catch (fallbackError: unknown) {
          const fallbackMeta = toErrorMeta(fallbackError);
          setErrorMessage(`${formatErrorMeta(t.visualization.saveFailed, primaryMeta)} ${formatErrorMeta(t.visualization.serverFallbackFailed, fallbackMeta)}`);
          return;
        }
      }

      setSavedItems((prev) => [saved, ...prev]);
      setCurrentResult((prev) => prev ? { ...prev, visualizationId: saved.id, imageUrl, audioUrl, videoUrl, videoStatus: persistedVideoStatus || prev.videoStatus } : prev);
      setIsSaved(true);
      if (persistedVideoStatus === 'pending') setInfoMessage(t.visualization.videoSavePending);
    } finally {
      setIsSaving(false);
    }
  }, [activeUserId, currentResult, isSaving, t, isDevSession]);

  // Keep saveRef in sync for auto-save from handleGenerate
  saveRef.current = handleSave as (r: VisualizationResult) => Promise<void>;

  const handleLoadSaved = useCallback((item: SavedVisualization) => {
    clearMessages();
    const loaded = toResultFromSaved(item);
    setCurrentResult(loaded);
    setIsSaved(true);
    if (loaded.videoStatus === 'pending' && loaded.videoId) {
      setInfoMessage(t.visualization.videoLoadPending);
      void refreshPendingVideo(loaded);
    }
    return loaded;
  }, [clearMessages, refreshPendingVideo, t]);

  const handleDeleteSaved = useCallback(async (id: string) => {
    if (isDevSession) {
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    if (!activeUserId) return;
    try {
      await deleteVisualization(activeUserId, id);
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error: unknown) {
      setErrorMessage(formatErrorMeta(t.visualization.deleteFailed, toErrorMeta(error)));
    }
  }, [activeUserId, t, isDevSession]);

  return {
    // State
    isGenerating,
    isSaving,
    isCheckingPendingVideo,
    generatingStep,
    errorMessage,
    infoMessage,
    currentResult,
    isSaved,
    savedItems,
    activeUserId,
    // Actions
    handleGenerate,
    handleSave,
    handleLoadSaved,
    handleDeleteSaved,
    refreshPendingVideo,
    clearMessages,
    setCurrentResult,
    setErrorMessage,
    setInfoMessage,
  };
}
