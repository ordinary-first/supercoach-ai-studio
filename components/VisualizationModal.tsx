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
} from 'lucide-react';
import { UserProfile, GoalNode } from '../types';
import {
  generateSuccessNarrative,
  generateSpeech,
  generateVideo,
  pollVideoStatus,
  generateVisualizationImage,
  uploadVisualizationAsset,
  type VideoGenerationResult,
} from '../services/aiService';
import {
  deleteVisualization,
  getUserId,
  loadVisualizations,
  saveVisualization,
  SavedVisualization,
  updateVisualization,
} from '../services/firebaseService';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface VisualizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  nodes: GoalNode[];
}

type SavedVideoStatus = 'pending' | 'ready' | 'failed';

interface VisualizationResult {
  inputText: string;
  text?: string;
  imageUrl?: string;
  audioData?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoId?: string;
  videoStatus?: SavedVideoStatus;
  visualizationId?: string;
}

const VIDEO_DURATION_SEC = 4;
const LONG_PRESS_DELETE_MS = 800;

const getActiveUserId = (profile: UserProfile | null): string | null => {
  return getUserId() || profile?.googleId || null;
};

const sanitizePayload = <T extends Record<string, unknown>>(payload: T): Partial<T> => {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    return { ...acc, [key]: value };
  }, {} as Partial<T>);
};

const toSavedVideoStatus = (video: VideoGenerationResult): SavedVideoStatus => {
  if (video.videoUrl) return 'ready';
  if (video.status === 'failed') return 'failed';
  if (video.videoId) return 'pending';
  return 'failed';
};

const toResultFromSaved = (item: SavedVisualization): VisualizationResult => ({
  visualizationId: item.id,
  inputText: item.inputText,
  text: item.text,
  imageUrl: item.imageUrl,
  audioUrl: item.audioUrl,
  videoUrl: item.videoUrl,
  videoId: item.videoId,
  videoStatus: item.videoStatus,
});

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
        // no-op
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback((loop: boolean) => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // no-op
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
    const maybeWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = window.AudioContext || maybeWebkit.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor({ sampleRate: 24000 });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioCtxRef.current.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i += 1) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    audioBufferRef.current = buffer;
    playAudio(true);
  }, [playAudio]);

  const prepareAudioFromUrl = useCallback(async (audioUrl: string) => {
    const maybeWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = window.AudioContext || maybeWebkit.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtor();

    const response = await fetch(audioUrl);
    if (!response.ok) return;
    const audioBuffer = await audioCtxRef.current.decodeAudioData(await response.arrayBuffer());
    audioBufferRef.current = audioBuffer;
    playAudio(true);
  }, [playAudio]);

  const refreshPendingVideo = useCallback(async (target: VisualizationResult) => {
    if (!activeUserId || !target.videoId || target.videoStatus !== 'pending') return;
    setIsCheckingPendingVideo(true);
    clearMessages();
    try {
      const result = await pollVideoStatus(target.videoId, activeUserId, VIDEO_DURATION_SEC);
      if (result.videoUrl) {
        const updates = { videoUrl: result.videoUrl, videoStatus: 'ready' as const, videoId: target.videoId };
        setCurrentResult((prev) => (prev ? { ...prev, ...updates } : prev));
        if (target.visualizationId) {
          await updateVisualization(activeUserId, target.visualizationId, updates);
          setSavedItems((prev) =>
            prev.map((item) => (item.id === target.visualizationId ? { ...item, ...updates } : item)),
          );
        }
        setInfoMessage('영상 생성이 완료되었습니다.');
      } else if (result.status === 'failed') {
        const updates = { videoStatus: 'failed' as const, videoId: target.videoId };
        setCurrentResult((prev) => (prev ? { ...prev, ...updates } : prev));
        if (target.visualizationId) {
          await updateVisualization(activeUserId, target.visualizationId, updates);
          setSavedItems((prev) =>
            prev.map((item) => (item.id === target.visualizationId ? { ...item, ...updates } : item)),
          );
        }
        setErrorMessage('영상 생성이 실패했습니다. 다시 생성해 주세요.');
      } else {
        setInfoMessage('영상 생성 대기 중입니다. 잠시 후 다시 확인해 주세요.');
      }
    } catch {
      setErrorMessage('영상 상태를 확인하지 못했습니다.');
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
      .catch(() => {
        if (!cancelled) setErrorMessage('저장된 시각화를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeUserId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setViewMode('create');
    clearMessages();
  }, [clearMessages, isOpen]);

  useEffect(() => {
    if (!isOpen) stopAudio();
  }, [isOpen, stopAudio]);

  useEffect(() => {
    return () => {
      stopAudio();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [stopAudio]);

  useEffect(() => {
    if (viewMode !== 'result' || !currentResult) return;
    stopAudio();
    if (currentResult.audioData) {
      prepareAudioFromPcm(currentResult.audioData).catch(() => setErrorMessage('오디오 재생 준비 실패'));
      return;
    }
    if (currentResult.audioUrl) {
      prepareAudioFromUrl(currentResult.audioUrl).catch(() => setErrorMessage('오디오 재생 준비 실패'));
    }
  }, [currentResult, prepareAudioFromPcm, prepareAudioFromUrl, stopAudio, viewMode]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsSaved(false);
    clearMessages();
    const result: VisualizationResult = { inputText };
    try {
      const goalContext = nodes.map((node) => `- ${node.text}`).join('\n');
      const fullPrompt = inputText || goalContext;

      if (settings.text) {
        setGeneratingStep('텍스트 생성 중...');
        result.text = await generateSuccessNarrative(fullPrompt, userProfile);
      }
      if (settings.image) {
        setGeneratingStep('이미지 생성 중...');
        result.imageUrl = await generateVisualizationImage(
          fullPrompt,
          referenceImages,
          userProfile,
          visualImageQuality,
        );
      }
      if (settings.audio) {
        setGeneratingStep('오디오 생성 중...');
        result.audioData = await generateSpeech(result.text || fullPrompt);
      }
      if (settings.video) {
        setGeneratingStep('영상 생성 중...');
        const video = await generateVideo(fullPrompt, userProfile, VIDEO_DURATION_SEC);
        result.videoUrl = video.videoUrl;
        result.videoId = video.videoId;
        result.videoStatus = toSavedVideoStatus(video);
      }

      if (settings.image && !result.imageUrl) {
        setErrorMessage('이미지 생성이 완료되지 않았습니다. 다시 시도해 주세요.');
      }
      if (settings.video && result.videoStatus === 'pending') {
        setInfoMessage('영상 생성 대기 중입니다. 저장 후 나중에 다시 확인할 수 있습니다.');
      }
      if (settings.video && result.videoStatus === 'failed') {
        setErrorMessage('영상 생성에 실패했습니다. 이미지/텍스트는 저장할 수 있습니다.');
      }
      setCurrentResult(result);
      setViewMode('result');
    } catch {
      setErrorMessage('시각화 생성 중 오류가 발생했습니다.');
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
        imageUrl = await uploadVisualizationAsset('image', activeUserId, visualizationId, { dataUrl: imageUrl });
      }
      let audioUrl = currentResult.audioUrl;
      if (!audioUrl && currentResult.audioData) {
        audioUrl = await uploadVisualizationAsset('audio', activeUserId, visualizationId, {
          audioData: currentResult.audioData,
        });
      }
      let videoUrl = currentResult.videoUrl;
      if (videoUrl?.startsWith('data:')) {
        videoUrl = await uploadVisualizationAsset('video', activeUserId, visualizationId, { dataUrl: videoUrl });
      }

      const videoStatus: SavedVideoStatus | undefined = videoUrl ? 'ready' : currentResult.videoStatus;
      const payload = sanitizePayload({
        inputText: currentResult.inputText,
        text: currentResult.text,
        imageUrl,
        audioUrl,
        videoUrl,
        videoId: currentResult.videoId,
        videoStatus,
      });
      const saved = await saveVisualization(activeUserId, payload);

      setSavedItems((prev) => [saved, ...prev]);
      setCurrentResult((prev) =>
        prev
          ? { ...prev, visualizationId: saved.id, imageUrl, audioUrl, videoUrl, videoStatus }
          : prev,
      );
      setIsSaved(true);
      if (videoStatus === 'pending') {
        setInfoMessage('영상은 아직 생성 중입니다. 저장 후 다시 열어 확인할 수 있습니다.');
      }
    } catch {
      setErrorMessage('시각화 저장에 실패했습니다.');
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
      setInfoMessage('영상 생성 대기 중입니다. 상태를 확인합니다...');
      void refreshPendingVideo(loaded);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    if (!activeUserId) return;
    try {
      await deleteVisualization(activeUserId, id);
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setErrorMessage('저장된 시각화를 삭제하지 못했습니다.');
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

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const hasAudio = Boolean(currentResult?.audioData || currentResult?.audioUrl);
  const isVideoPending = currentResult?.videoStatus === 'pending' && currentResult?.videoId;

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
          {errorMessage && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{errorMessage}</div>}
          {infoMessage && <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/10 p-3 text-sm text-neon-lime">{infoMessage}</div>}

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
                    onClick={() => toggleSetting(key)}
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

              {isVideoPending && (
                <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-3">
                  <span className="text-sm">영상 생성 대기 중입니다.</span>
                  <button
                    onClick={() => {
                      if (currentResult) void refreshPendingVideo(currentResult);
                    }}
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
                      }}
                      className={`p-2 rounded-full ${isLooping ? 'bg-neon-lime text-black' : 'bg-white/10'}`}
                    >
                      <Repeat size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (isPlaying) {
                          stopAudio();
                        } else {
                          playAudio(isLooping);
                        }
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
