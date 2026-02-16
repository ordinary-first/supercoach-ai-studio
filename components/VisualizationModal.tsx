import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  ArrowLeft,
  ImagePlus,
  FileText,
  Image as ImageIcon,
  Film,
  Headphones,
  Wand2,
  Loader2,
  Play,
  Pause,
  Repeat,
  X,
  Save,
  Trash2,
  Clock,
} from 'lucide-react';
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
import { useFocusTrap } from '../hooks/useFocusTrap';

interface VisualizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  nodes: GoalNode[];
}

type GenerationStatus = 'idle' | 'completed' | 'failed';
type SavedVideoStatus = 'idle' | 'pending' | 'ready' | 'failed';

type ErrorMeta = {
  code?: string;
  message?: string;
  requestId?: string;
};

interface VisualizationResult {
  inputText: string;
  text?: string;
  imageUrl?: string;
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

const VIDEO_DURATION_SEC = 4;
const LONG_PRESS_DELETE_MS = 800;

const getActiveUserId = (profile: UserProfile | null): string | null => {
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
  const code = error.code ? `코드: ${error.code}` : '';
  const requestId = error.requestId ? `요청ID: ${error.requestId}` : '';
  const details = [code, requestId].filter(Boolean).join(', ');
  return details ? `${prefix} (${details})` : prefix;
};

const sanitizeFirestoreString = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  let normalized = value;
  try {
    normalized = new TextDecoder().decode(new TextEncoder().encode(value));
  } catch {
    normalized = value;
  }
  const cleaned = normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
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

const toResultFromSaved = (item: SavedVisualization): VisualizationResult => ({
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

const toStatusClass = (status: string): string => {
  if (status === 'completed' || status === 'ready') return 'bg-green-500/15 text-green-300 border-green-500/20';
  if (status === 'failed') return 'bg-red-500/15 text-red-300 border-red-500/20';
  if (status === 'pending') return 'bg-yellow-500/15 text-yellow-200 border-yellow-500/20';
  return 'bg-white/5 text-gray-400 border-white/10';
};

const VisualizationModal: React.FC<VisualizationModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  nodes,
}) => {
  const focusTrapRef = useFocusTrap(isOpen);
  const activeUserId = getActiveUserId(userProfile);

  const [viewMode, setViewMode] = useState<'create' | 'result'>('create');
  const [inputText, setInputText] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [settings, setSettings] = useState({ text: true, image: true, video: false, audio: true });
  const [visualImageQuality, setVisualImageQuality] = useState<'medium' | 'high'>('medium');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPendingVideo, setIsCheckingPendingVideo] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [currentResult, setCurrentResult] = useState<VisualizationResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedVisualization[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMessages = useCallback(() => {
    setErrorMessage('');
    setInfoMessage('');
  }, []);

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
      }
      sourceNodeRef.current = null;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.currentTime = 0;
      htmlAudioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback((loop: boolean) => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
      }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.loop = loop;
    source.connect(audioCtxRef.current.destination);
    source.onended = () => {
      if (!source.loop) setIsPlaying(false);
    };
    source.start();
    sourceNodeRef.current = source;
    setIsPlaying(true);
  }, []);

  const prepareAudioFromPcm = useCallback(async (base64: string) => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }
    const maybeWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = window.AudioContext || maybeWebkit.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor({ sampleRate: 24000 });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) bytes[i] = binaryString.charCodeAt(i);

    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioCtxRef.current.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) channelData[i] = dataInt16[i] / 32768.0;

    audioBufferRef.current = buffer;
    playAudio(true);
  }, [playAudio]);

  const prepareAudioFromUrl = useCallback(async (audioUrl: string) => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.loop = isLooping;
    audio.onended = () => {
      if (!audio.loop) setIsPlaying(false);
    };
    htmlAudioRef.current = audio;
    setIsPlaying(false);
  }, [isLooping]);
  const refreshPendingVideo = useCallback(async (target: VisualizationResult) => {
    if (!activeUserId || !target.videoId || target.videoStatus !== 'pending') return;

    setIsCheckingPendingVideo(true);
    clearMessages();
    try {
      const result = await pollVideoStatus(target.videoId, activeUserId, VIDEO_DURATION_SEC);
      if (result.videoUrl) {
        const updates = { videoUrl: result.videoUrl, videoStatus: 'ready' as const, videoId: target.videoId };
        setCurrentResult((prev) => (prev ? { ...prev, ...updates } : prev));
        setSavedItems((prev) =>
          prev.map((item) => (item.id === target.visualizationId ? { ...item, ...updates } : item)),
        );
        if (target.visualizationId) await updateVisualization(activeUserId, target.visualizationId, updates);
        setInfoMessage('영상 생성이 완료되었습니다.');
        return;
      }

      if (result.status === 'failed') {
        const videoError = {
          code: result.errorCode,
          message: result.errorMessage,
          requestId: result.requestId,
        };
        setCurrentResult((prev) => (prev ? { ...prev, videoStatus: 'failed', videoError } : prev));
        if (target.visualizationId) {
          await updateVisualization(activeUserId, target.visualizationId, {
            videoStatus: 'failed',
            videoId: target.videoId,
          });
        }
        setErrorMessage(formatErrorMeta('영상 생성이 실패했습니다.', videoError));
        return;
      }

      setInfoMessage('영상 생성이 아직 진행 중입니다. 잠시 후 다시 확인해 주세요.');
    } catch (error: unknown) {
      setErrorMessage(formatErrorMeta('영상 상태 확인에 실패했습니다.', toErrorMeta(error)));
    } finally {
      setIsCheckingPendingVideo(false);
    }
  }, [activeUserId, clearMessages]);

  useEffect(() => {
    if (!isOpen || !activeUserId) {
      setSavedItems([]);
      return;
    }

    let cancelled = false;
    loadVisualizations(activeUserId)
      .then((items) => {
        if (!cancelled) setSavedItems(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(formatErrorMeta('저장된 시각화를 불러오지 못했습니다.', toErrorMeta(error)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setViewMode('create');
      clearMessages();
    } else {
      stopAudio();
    }
  }, [clearMessages, isOpen, stopAudio]);

  useEffect(() => {
    return () => {
      stopAudio();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [stopAudio]);

  useEffect(() => {
    if (viewMode !== 'result' || !currentResult) return;

    stopAudio();
    if (currentResult.audioUrl) {
      prepareAudioFromUrl(currentResult.audioUrl).catch(() => {
        setErrorMessage('오디오 재생 준비에 실패했습니다.');
      });
      return;
    }
    if (currentResult.audioData) {
      prepareAudioFromPcm(currentResult.audioData).catch(() => {
        setErrorMessage('오디오 재생 준비에 실패했습니다.');
      });
    }
  }, [currentResult, prepareAudioFromPcm, prepareAudioFromUrl, stopAudio, viewMode]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsSaved(false);
    clearMessages();

    const result: VisualizationResult = {
      inputText,
      textStatus: 'idle',
      imageStatus: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle',
    };

    try {
      const goalContext = nodes.map((node) => `- ${node.text}`).join('\n');
      const fullPrompt = inputText || goalContext;
      const generationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (settings.text) {
        setGeneratingStep('텍스트 생성 중...');
        result.text = await generateSuccessNarrative(fullPrompt, userProfile);
        result.textStatus = result.text ? 'completed' : 'failed';
      }

      if (settings.image) {
        setGeneratingStep('이미지 생성 중...');
        const imageResult = await generateVisualizationImage(
          fullPrompt,
          referenceImages,
          userProfile,
          visualImageQuality,
          activeUserId,
          generationId,
        );
        if (imageResult.status === 'completed' && imageResult.imageUrl) {
          result.imageUrl = imageResult.imageUrl;
          result.imageStatus = 'completed';
        } else {
          result.imageStatus = 'failed';
          result.imageError = {
            code: imageResult.errorCode,
            message: imageResult.errorMessage,
            requestId: imageResult.requestId,
          };
        }
      }

      if (settings.audio) {
        setGeneratingStep('오디오 생성 중...');
        const speechResult = await generateSpeech(
          result.text || fullPrompt,
          activeUserId,
          generationId,
        );
        if (speechResult.status === 'completed' && (speechResult.audioUrl || speechResult.audioData)) {
          result.audioUrl = speechResult.audioUrl;
          result.audioData = speechResult.audioData;
          result.audioStatus = 'completed';
        } else {
          result.audioStatus = 'failed';
          result.audioError = {
            code: speechResult.errorCode,
            message: speechResult.errorMessage,
            requestId: speechResult.requestId,
          };
        }
      }

      if (settings.video) {
        setGeneratingStep('영상 생성 중...');
        const videoResult = await generateVideo(fullPrompt, userProfile, VIDEO_DURATION_SEC);
        result.videoId = videoResult.videoId;
        result.videoUrl = videoResult.videoUrl;
        result.videoError = {
          code: videoResult.errorCode,
          message: videoResult.errorMessage,
          requestId: videoResult.requestId,
        };

        if (videoResult.videoUrl) result.videoStatus = 'ready';
        else if (videoResult.status === 'queued' || videoResult.status === 'in_progress') result.videoStatus = 'pending';
        else result.videoStatus = 'failed';
      }

      if (result.imageStatus === 'failed') {
        setErrorMessage((prev) =>
          prev
            ? `${prev} ${formatErrorMeta('이미지 생성 실패.', result.imageError)}`
            : formatErrorMeta('이미지 생성 실패.', result.imageError),
        );
      }
      if (result.audioStatus === 'failed') {
        setErrorMessage((prev) =>
          prev
            ? `${prev} ${formatErrorMeta('오디오 생성 실패.', result.audioError)}`
            : formatErrorMeta('오디오 생성 실패.', result.audioError),
        );
      }
      if (result.videoStatus === 'pending') {
        setInfoMessage('영상 생성 대기 중입니다. 저장 후 나중에 다시 확인할 수 있습니다.');
      }
      if (result.videoStatus === 'failed') {
        setErrorMessage((prev) =>
          prev
            ? `${prev} ${formatErrorMeta('영상 생성 실패.', result.videoError)}`
            : formatErrorMeta('영상 생성 실패.', result.videoError),
        );
      }

      setCurrentResult(result);
      setViewMode('result');
    } catch (error: unknown) {
      setErrorMessage(formatErrorMeta('시각화 생성 중 오류가 발생했습니다.', toErrorMeta(error)));
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleSave = async () => {
    if (!currentResult || isSaved || isSaving) return;
    if (!activeUserId) {
      setErrorMessage('로그인 후 저장할 수 있습니다.');
      return;
    }

    setIsSaving(true);
    clearMessages();

    try {
      const visualizationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let imageUrl = currentResult.imageUrl;
      if (imageUrl?.startsWith('data:')) {
        imageUrl = await uploadVisualizationAsset('image', activeUserId, visualizationId, {
          dataUrl: imageUrl,
        });
      }

      let audioUrl = currentResult.audioUrl;
      if (!audioUrl && currentResult.audioData) {
        audioUrl = await uploadVisualizationAsset('audio', activeUserId, visualizationId, {
          audioData: currentResult.audioData,
        });
      }

      let videoUrl = currentResult.videoUrl;
      if (videoUrl?.startsWith('data:')) {
        videoUrl = await uploadVisualizationAsset('video', activeUserId, visualizationId, {
          dataUrl: videoUrl,
        });
      }

      const payload: VisualizationWriteInput = {
        inputText:
          sanitizeFirestoreString(currentResult.inputText) ||
          sanitizeFirestoreString(currentResult.text) ||
          'Visualization',
      };
      const cleanText = sanitizeFirestoreString(currentResult.text)?.slice(0, 50000);
      const cleanImageUrl = sanitizeStorageUrl(imageUrl);
      const cleanAudioUrl = sanitizeStorageUrl(audioUrl);
      const cleanVideoUrl = sanitizeStorageUrl(videoUrl);
      const cleanVideoId = sanitizeVideoId(currentResult.videoId);
      if (cleanText) payload.text = cleanText;
      if (cleanImageUrl) payload.imageUrl = cleanImageUrl;
      if (cleanAudioUrl) payload.audioUrl = cleanAudioUrl;
      if (cleanVideoUrl) payload.videoUrl = cleanVideoUrl;
      if (cleanVideoId) payload.videoId = cleanVideoId;
      const persistedVideoStatus = videoUrl ? 'ready' : toPersistedVideoStatus(currentResult.videoStatus);
      if (persistedVideoStatus) payload.videoStatus = persistedVideoStatus;

      let saved: SavedVisualization;
      try {
        saved = await saveVisualization(activeUserId, payload);
      } catch (primaryError: unknown) {
        const primaryMeta = toErrorMeta(primaryError);
        try {
          saved = await saveVisualizationViaApi(payload, visualizationId);
          setInfoMessage(formatErrorMeta('클라이언트 저장 실패 후 서버 경로로 저장했습니다.', primaryMeta));
        } catch (fallbackError: unknown) {
          const fallbackMeta = toErrorMeta(fallbackError);
          setErrorMessage(
            `${formatErrorMeta('시각화 저장에 실패했습니다.', primaryMeta)} ${formatErrorMeta(
              '서버 fallback 저장도 실패했습니다.',
              fallbackMeta,
            )}`,
          );
          return;
        }
      }

      setSavedItems((prev) => [saved, ...prev]);
      setCurrentResult((prev) =>
        prev
          ? {
              ...prev,
              visualizationId: saved.id,
              imageUrl,
              audioUrl,
              videoUrl,
              videoStatus: persistedVideoStatus || prev.videoStatus,
            }
          : prev,
      );
      setIsSaved(true);

      if (persistedVideoStatus === 'pending') {
        setInfoMessage('영상은 아직 생성 중입니다. 저장 후 다시 열어 상태를 확인하세요.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSaved = (item: SavedVisualization) => {
    stopAudio();
    clearMessages();
    const loaded = toResultFromSaved(item);
    setCurrentResult(loaded);
    setIsSaved(true);
    setViewMode('result');
    if (loaded.videoStatus === 'pending' && loaded.videoId) {
      setInfoMessage('영상 생성 대기 상태입니다. 자동으로 상태를 확인합니다.');
      void refreshPendingVideo(loaded);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    if (!activeUserId) return;
    try {
      await deleteVisualization(activeUserId, id);
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error: unknown) {
      setErrorMessage(formatErrorMeta('저장 항목 삭제에 실패했습니다.', toErrorMeta(error)));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setReferenceImages((prev) => {
        const next = [...prev];
        if (index < next.length) next[index] = dataUrl;
        else next.push(dataUrl);
        return next;
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  if (!isOpen) return null;

  const hasAudio = Boolean(currentResult?.audioData || currentResult?.audioUrl);
  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-deep-space flex flex-col">
      <header className="h-14 md:h-20 px-4 md:px-6 border-b border-white/5 flex items-center justify-between">
        {viewMode === 'result' ? (
          <button onClick={() => setViewMode('create')} className="p-2 rounded-full bg-white/5">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={18} className="text-neon-lime" />
            <span className="font-bold">시각화 스튜디오</span>
          </div>
        )}
        {viewMode === 'result' ? (
          <button
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className="px-3 py-1.5 rounded-full text-sm bg-neon-lime text-black disabled:opacity-60"
          >
            <Save size={14} className="inline mr-1" />
            {isSaving ? '저장 중...' : isSaved ? '저장 완료' : '저장'}
          </button>
        ) : (
          <button onClick={onClose} className="p-2 rounded-full bg-white/5">
            <X size={18} />
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-[120px]">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
          {infoMessage && (
            <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/10 p-3 text-sm text-neon-lime">
              {infoMessage}
            </div>
          )}

          {viewMode === 'create' ? (
            <>
              <textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="원하는 장면이나 감정을 구체적으로 입력해 주세요."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm"
              />

              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="relative aspect-square rounded-xl border border-white/10 overflow-hidden">
                    {referenceImages[index] ? (
                      <>
                        <img src={referenceImages[index]} alt={`참고 이미지 ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() =>
                            setReferenceImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))
                          }
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className="w-full h-full flex flex-col items-center justify-center text-gray-500"
                      >
                        <ImagePlus size={20} />
                        <span className="text-xs mt-1">추가</span>
                      </button>
                    )}
                    <input
                      ref={(element) => {
                        fileInputRefs.current[index] = element;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleFileChange(event, index)}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'text' as const, label: '텍스트', icon: FileText },
                  { key: 'image' as const, label: '이미지', icon: ImageIcon },
                  { key: 'video' as const, label: '영상', icon: Film },
                  { key: 'audio' as const, label: '오디오', icon: Headphones },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`px-3 py-2 rounded-full text-xs flex items-center gap-1 ${
                      settings[key] ? 'bg-neon-lime text-black' : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {settings.image && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setVisualImageQuality('medium')}
                    className={`px-3 py-1 rounded-full text-xs ${
                      visualImageQuality === 'medium' ? 'bg-neon-lime text-black' : 'bg-white/5'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setVisualImageQuality('high')}
                    className={`px-3 py-1 rounded-full text-xs ${
                      visualImageQuality === 'high' ? 'bg-neon-lime text-black' : 'bg-white/5'
                    }`}
                  >
                    High
                  </button>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 rounded-full bg-neon-lime text-black font-bold disabled:opacity-50"
              >
                {isGenerating ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {generatingStep || '생성 중...'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Wand2 size={16} />
                    생성하기
                  </span>
                )}
              </button>

              {savedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-bold">저장한 시각화</div>
                  <div className="flex gap-3 overflow-x-auto">
                    {savedItems.map((item) => (
                      <div
                        key={item.id}
                        className="relative w-36 flex-shrink-0 cursor-pointer"
                        onClick={() => handleLoadSaved(item)}
                        onTouchStart={() => {
                          longPressTimerRef.current = setTimeout(() => {
                            void handleDeleteSaved(item.id);
                          }, LONG_PRESS_DELETE_MS);
                        }}
                        onTouchEnd={() => {
                          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                        }}
                        onTouchCancel={() => {
                          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                        }}
                      >
                        <div className="aspect-[4/3] rounded-xl border border-white/10 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="saved visualization" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/5" />
                          )}
                        </div>
                        <p className="text-xs mt-1 truncate">{item.inputText || item.text || 'Visualization'}</p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                          <Clock size={10} />
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                        {item.videoStatus === 'pending' && (
                          <span className="absolute top-1 left-1 text-[10px] px-1 py-0.5 rounded bg-black/70 text-neon-lime">
                            영상 대기
                          </span>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteSaved(item.id);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 text-xs rounded border ${toStatusClass(currentResult?.textStatus || 'idle')}`}>텍스트: {currentResult?.textStatus || 'idle'}</span>
                <span className={`px-2 py-1 text-xs rounded border ${toStatusClass(currentResult?.imageStatus || 'idle')}`}>이미지: {currentResult?.imageStatus || 'idle'}</span>
                <span className={`px-2 py-1 text-xs rounded border ${toStatusClass(currentResult?.audioStatus || 'idle')}`}>오디오: {currentResult?.audioStatus || 'idle'}</span>
                <span className={`px-2 py-1 text-xs rounded border ${toStatusClass(currentResult?.videoStatus || 'idle')}`}>영상: {currentResult?.videoStatus || 'idle'}</span>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-black">
                {currentResult?.videoUrl ? (
                  <video src={currentResult.videoUrl} controls autoPlay loop muted playsInline className="w-full aspect-video object-cover" />
                ) : currentResult?.imageUrl ? (
                  <img src={currentResult.imageUrl} alt="시각화 이미지" className="w-full aspect-video object-cover" />
                ) : (
                  <div className="aspect-video flex items-center justify-center text-gray-600">
                    <ImageIcon size={36} />
                  </div>
                )}
              </div>
              {currentResult?.videoUrl && currentResult?.imageUrl && (
                <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/40">
                  <img src={currentResult.imageUrl} alt="생성 이미지" className="w-full aspect-video object-cover" />
                </div>
              )}

              {currentResult?.videoStatus === 'pending' && currentResult.videoId && (
                <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-3">
                  <span className="text-sm">영상 생성 대기 중입니다.</span>
                  <button
                    onClick={() => void refreshPendingVideo(currentResult)}
                    disabled={isCheckingPendingVideo}
                    className="px-3 py-1 rounded-full text-xs bg-neon-lime text-black disabled:opacity-50"
                  >
                    {isCheckingPendingVideo ? '확인 중...' : '지금 확인'}
                  </button>
                </div>
              )}

              {currentResult?.text && (
                <div className="p-4 rounded-xl border-l-2 border-neon-lime bg-white/5 whitespace-pre-wrap">
                  {currentResult.text}
                </div>
              )}

              {hasAudio && (
                <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                  <div className="text-sm">오디오 재생</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const nextLoop = !isLooping;
                        setIsLooping(nextLoop);
                        if (sourceNodeRef.current) sourceNodeRef.current.loop = nextLoop;
                        if (htmlAudioRef.current) htmlAudioRef.current.loop = nextLoop;
                      }}
                      className={`p-2 rounded-full ${isLooping ? 'bg-neon-lime text-black' : 'bg-white/10'}`}
                    >
                      <Repeat size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (currentResult?.audioUrl && !currentResult.audioData && htmlAudioRef.current) {
                          if (isPlaying) {
                            htmlAudioRef.current.pause();
                            setIsPlaying(false);
                          } else {
                            try {
                              htmlAudioRef.current.loop = isLooping;
                              await htmlAudioRef.current.play();
                              setIsPlaying(true);
                            } catch {
                              setErrorMessage('오디오 재생에 실패했습니다.');
                            }
                          }
                          return;
                        }
                        if (isPlaying) stopAudio();
                        else playAudio(isLooping);
                      }}
                      className="p-2 rounded-full bg-white text-black"
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default VisualizationModal;
