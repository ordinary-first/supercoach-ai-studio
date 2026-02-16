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
  generateVisualizationImage,
  uploadVisualizationAsset,
} from '../services/aiService';
import {
  deleteVisualization,
  getUserId,
  loadVisualizations,
  saveVisualization,
  SavedVisualization,
} from '../services/firebaseService';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface VisualizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  nodes: GoalNode[];
}

interface VisualizationResult {
  inputText: string;
  text?: string;
  imageUrl?: string;
  audioData?: string;
  audioUrl?: string;
  videoUrl?: string;
}

const getActiveUserId = (profile: UserProfile | null): string | null => {
  return getUserId() || profile?.googleId || null;
};

const VisualizationModal: React.FC<VisualizationModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  nodes,
}) => {
  const focusTrapRef = useFocusTrap(isOpen);

  const [viewMode, setViewMode] = useState<'create' | 'result'>('create');
  const [inputText, setInputText] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [settings, setSettings] = useState({ text: true, image: true, video: false, audio: true });
  const [visualImageQuality, setVisualImageQuality] = useState<'medium' | 'high'>('medium');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingStep, setGeneratingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  const activeUserId = getActiveUserId(userProfile);

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
      audioCtxRef.current.resume().catch(() => {
        // no-op
      });
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
    const WindowWithWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = window.AudioContext || WindowWithWebkit.webkitAudioContext;
    if (!AudioCtor) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtor({ sampleRate: 24000 });
    }

    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
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
    const WindowWithWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtor = window.AudioContext || WindowWithWebkit.webkitAudioContext;
    if (!AudioCtor) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtor();
    }

    const response = await fetch(audioUrl);
    if (!response.ok) return;

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer.slice(0));
    audioBufferRef.current = audioBuffer;
    playAudio(true);
  }, [playAudio]);

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
    if (isOpen) {
      setViewMode('create');
      setErrorMessage('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopAudio();
    }
  }, [isOpen, stopAudio]);

  useEffect(() => {
    if (viewMode !== 'result' || !currentResult) return;

    stopAudio();
    if (currentResult.audioData) {
      prepareAudioFromPcm(currentResult.audioData).catch(() => {
        setErrorMessage('오디오 재생 준비에 실패했습니다.');
      });
      return;
    }

    if (currentResult.audioUrl) {
      prepareAudioFromUrl(currentResult.audioUrl).catch(() => {
        setErrorMessage('오디오 재생 준비에 실패했습니다.');
      });
    }
  }, [currentResult, prepareAudioFromPcm, prepareAudioFromUrl, stopAudio, viewMode]);

  const handleImageUpload = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
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
    e.target.value = '';
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsSaved(false);
    setErrorMessage('');

    const result: VisualizationResult = { inputText };

    try {
      const goalContext = nodes.map((n) => `- ${n.text}`).join('\n');
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
        setGeneratingStep('음성 생성 중...');
        const textForSpeech = result.text || fullPrompt;
        result.audioData = await generateSpeech(textForSpeech);
      }

      if (settings.video) {
        setGeneratingStep('영상 생성 중... (1-2분 소요)');
        result.videoUrl = await generateVideo(fullPrompt, userProfile);
      }

      if (settings.image && !result.imageUrl) {
        setErrorMessage('이미지 생성이 완료되지 않았습니다. 다시 시도해주세요.');
      }
      if (settings.video && !result.videoUrl) {
        setErrorMessage((prev) =>
          prev
            ? `${prev} 영상도 준비되지 않았습니다.`
            : '영상이 아직 준비되지 않았습니다. 잠시 후 다시 생성해주세요.',
        );
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
    setErrorMessage('');

    try {
      const visualizationId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let imageUrl = currentResult.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
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
      if (videoUrl && videoUrl.startsWith('data:')) {
        videoUrl = await uploadVisualizationAsset('video', activeUserId, visualizationId, {
          dataUrl: videoUrl,
        });
      }

      const saved = await saveVisualization(activeUserId, {
        inputText: currentResult.inputText,
        text: currentResult.text,
        imageUrl,
        audioUrl,
        videoUrl,
      });

      setSavedItems((prev) => [saved, ...prev]);
      setCurrentResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          imageUrl,
          audioUrl,
          videoUrl,
        };
      });
      setIsSaved(true);
    } catch {
      setErrorMessage('시각화 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
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

  const handleLoadSaved = (item: SavedVisualization) => {
    stopAudio();
    setCurrentResult({
      inputText: item.inputText,
      text: item.text,
      imageUrl: item.imageUrl,
      audioUrl: item.audioUrl,
      videoUrl: item.videoUrl,
    });
    setIsSaved(true);
    setViewMode('result');
  };

  const togglePlayback = () => {
    if (isPlaying) stopAudio();
    else playAudio(isLooping);
  };

  const toggleLoop = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (sourceNodeRef.current) {
      sourceNodeRef.current.loop = nextLoop;
    }
  };

  const goBackToCreate = () => {
    stopAudio();
    setViewMode('create');
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const settingButtons = [
    { key: 'text' as const, label: '글', icon: FileText },
    { key: 'image' as const, label: '이미지', icon: ImageIcon },
    { key: 'video' as const, label: '영상', icon: Film },
    { key: 'audio' as const, label: '음성', icon: Headphones },
  ];

  const hasAudio = Boolean(currentResult?.audioData || currentResult?.audioUrl);

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-deep-space flex flex-col">
      {viewMode === 'create' ? (
        <>
          <div className="flex-shrink-0 h-14 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-neon-lime" />
              <h1 className="text-lg md:text-xl font-display font-bold text-white tracking-tight">
                시각화 스튜디오
              </h1>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all flex items-center justify-center"
              aria-label="Close visualization"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-[120px]">
            <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-8">
              {errorMessage && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-bold text-white tracking-wide">시각화 프롬프트</label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="원하는 성공 장면을 구체적으로 입력하세요..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 p-4 text-sm leading-relaxed resize-none focus:outline-none focus:border-neon-lime/50 focus:ring-1 focus:ring-neon-lime/30 transition-all"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-white tracking-wide">
                    참고 이미지 (선택)
                  </label>
                  <p className="text-xs text-gray-500 mt-1">분위기 참고용 이미지를 최대 3장 업로드</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((index) => {
                    const hasImage = index < referenceImages.length;
                    return (
                      <div key={index} className="relative aspect-square">
                        {hasImage ? (
                          <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/10">
                            <img
                              src={referenceImages[index]}
                              alt={`참고 이미지 ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => removeReferenceImage(index)}
                              className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-full text-white hover:bg-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleImageUpload(index)}
                            className="w-full h-full rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-white/20 hover:text-gray-400 transition-all"
                          >
                            <ImagePlus size={24} />
                            <span className="text-xs">추가</span>
                          </button>
                        )}
                        <input
                          ref={(el) => {
                            fileInputRefs.current[index] = el;
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, index)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-white tracking-wide">생성 옵션</label>
                <div className="flex flex-wrap gap-2">
                  {settingButtons.map(({ key, label, icon: Icon }) => {
                    const isActive = settings[key];
                    return (
                      <button
                        key={key}
                        onClick={() => toggleSetting(key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                          isActive
                            ? 'bg-neon-lime text-black'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                {settings.image && (
                  <div className="pt-1">
                    <p className="text-xs font-bold text-gray-300 mb-2">Image quality</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVisualImageQuality('medium')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          visualImageQuality === 'medium'
                            ? 'bg-neon-lime text-black'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        Medium
                      </button>
                      <button
                        onClick={() => setVisualImageQuality('high')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          visualImageQuality === 'high'
                            ? 'bg-neon-lime text-black'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        High
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-3 bg-neon-lime text-black font-bold rounded-full py-4 text-base hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>{generatingStep || '생성 중...'}</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    <span>생성하기</span>
                  </>
                )}
              </button>

              {savedItems.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-white tracking-wide">저장한 시각화</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {savedItems.map((item) => (
                      <div
                        key={item.id}
                        className="relative flex-shrink-0 w-40 cursor-pointer group"
                        onClick={() => handleLoadSaved(item)}
                        onTouchStart={() => {
                          longPressTimerRef.current = setTimeout(() => {
                            handleDeleteSaved(item.id);
                          }, 800);
                        }}
                        onTouchEnd={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                        onTouchCancel={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                      >
                        <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-white/10 mb-2">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt="Visualization thumbnail"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-neon-lime/10 to-electric-orange/10 flex items-center justify-center">
                              <Sparkles size={24} className="text-neon-lime/40" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 truncate">
                          {item.inputText || item.text?.slice(0, 30) || 'Visualization'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={10} className="text-gray-600" />
                          <span className="text-[10px] text-gray-600">{formatDate(item.timestamp)}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSaved(item.id);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-full text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex-shrink-0 h-14 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/5">
            <button
              onClick={goBackToCreate}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg md:text-xl font-display font-bold text-white tracking-tight">시각화 결과</h1>
            <button
              onClick={handleSave}
              disabled={isSaved || isSaving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                isSaved
                  ? 'bg-white/5 text-neon-lime border border-neon-lime/30 cursor-default'
                  : 'bg-neon-lime text-black hover:bg-white'
              }`}
            >
              <Save size={16} />
              <span>{isSaving ? '저장 중...' : isSaved ? '저장 완료' : '저장'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-[120px]">
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
              {errorMessage && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              )}

              <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black group">
                {currentResult?.videoUrl ? (
                  <video
                    src={currentResult.videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full aspect-video object-cover"
                  />
                ) : currentResult?.imageUrl ? (
                  <img
                    src={currentResult.imageUrl}
                    alt="시각화 이미지"
                    className="w-full aspect-video object-cover transition-transform duration-[60s] ease-linear transform scale-100 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-neon-lime/5 to-electric-orange/5">
                    <div className="text-center space-y-2">
                      <ImageIcon size={48} className="text-gray-700 mx-auto" />
                      <p className="text-sm text-gray-600">미디어 없음</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              </div>

              {currentResult?.text && (
                <div className="bg-white/5 border-l-2 border-neon-lime rounded-r-xl p-6">
                  <p className="text-base md:text-lg leading-loose text-gray-200 font-body whitespace-pre-wrap">
                    {currentResult.text.split('**').map((chunk, i) =>
                      i % 2 === 1 ? (
                        <strong key={i} className="text-white bg-neon-lime/20 px-1">
                          {chunk}
                        </strong>
                      ) : (
                        <React.Fragment key={i}>{chunk}</React.Fragment>
                      ),
                    )}
                  </p>
                </div>
              )}

              {hasAudio && (
                <div className="flex items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md shadow-lg">
                  <div className="p-3 bg-neon-lime/10 rounded-full text-neon-lime">
                    <Headphones size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-bold tracking-wider text-sm">몰입 음성 모드</span>
                      <div className="flex items-center gap-2">
                        {isPlaying && (
                          <span className="flex gap-0.5 h-3 items-end">
                            <span className="w-1 bg-neon-lime animate-[pulse_1s_ease-in-out_infinite] h-full" />
                            <span className="w-1 bg-neon-lime animate-[pulse_1.5s_ease-in-out_infinite] h-2/3" />
                            <span className="w-1 bg-neon-lime animate-[pulse_0.8s_ease-in-out_infinite] h-full" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">바이노럴 비트 + NLP 최적화</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleLoop}
                      className={`p-3 rounded-full border transition-all ${
                        isLooping
                          ? 'bg-neon-lime text-black border-neon-lime'
                          : 'bg-transparent text-gray-400 border-gray-600 hover:text-white'
                      }`}
                      title={isLooping ? '무한 반복 켜짐' : '무한 반복 꺼짐'}
                    >
                      <Repeat size={20} />
                    </button>

                    <button
                      onClick={togglePlayback}
                      className="p-4 bg-white text-black rounded-full hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                    >
                      {isPlaying ? (
                        <Pause size={24} fill="black" />
                      ) : (
                        <Play size={24} fill="black" className="ml-1" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VisualizationModal;
