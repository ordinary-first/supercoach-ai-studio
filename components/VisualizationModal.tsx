import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Sparkles, ArrowLeft, ImagePlus, FileText, Image as ImageIcon,
    Film, Headphones, Wand2, Loader2, Play, Pause, Repeat, X, Save, Trash2, Clock
} from 'lucide-react';
import { UserProfile, GoalNode } from '../types';
import {
    generateGoalImage, generateSuccessNarrative, generateSpeech,
    generateVideo, generateVisualizationImage
} from '../services/aiService';
import { getUserId } from '../services/firebaseService';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SavedVisualization {
    id: string;
    timestamp: number;
    inputText: string;
    text?: string;
    imageUrl?: string;
    audioData?: string;
    videoUrl?: string;
}

interface VisualizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: UserProfile | null;
    nodes: GoalNode[];
}

const STORAGE_KEY_BASE = 'secretcoach_saved_vis';
const STORAGE_KEY_LEGACY = STORAGE_KEY_BASE;

function getStorageKey(userId: string | null): string {
    if (typeof userId === 'string' && userId.trim().length > 0) {
        return `${STORAGE_KEY_BASE}_${userId}`;
    }
    return `${STORAGE_KEY_BASE}_anon`;
}

const VisualizationModal: React.FC<VisualizationModalProps> = ({ isOpen, onClose, userProfile, nodes }) => {
    const focusTrapRef = useFocusTrap(isOpen);

    // View state
    const [viewMode, setViewMode] = useState<'create' | 'result'>('create');

    // Create form state
    const [inputText, setInputText] = useState('');
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [settings, setSettings] = useState({ text: true, image: true, video: false, audio: true });

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingStep, setGeneratingStep] = useState('');

    // Result state
    const [currentResult, setCurrentResult] = useState<{
        inputText: string;
        text?: string;
        imageUrl?: string;
        audioData?: string;
        videoUrl?: string;
    } | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    // Saved gallery (localStorage)
    const [savedItems, setSavedItems] = useState<SavedVisualization[]>([]);

    // Audio refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(true);

    // File input refs for reference images
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);

    // Long press state for saved items
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const storageKey = getStorageKey(getUserId());

    // Load saved items from localStorage (scoped by uid)
    useEffect(() => {
        try {
            // One-time migration: legacy unscoped key -> current scoped key (only if empty).
            const existing = localStorage.getItem(storageKey);
            if (!existing) {
                const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
                if (legacy) {
                    localStorage.setItem(storageKey, legacy);
                    localStorage.removeItem(STORAGE_KEY_LEGACY);
                }
            }

            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as SavedVisualization[];
                setSavedItems(parsed);
            } else {
                setSavedItems([]);
            }
        } catch (e) {
            console.error('Failed to load saved visualizations:', e);
        }
    }, [storageKey]);

    // Reset viewMode to 'create' when opening
    useEffect(() => {
        if (isOpen) {
            setViewMode('create');
        }
    }, [isOpen]);

    // Stop audio on close
    useEffect(() => {
        if (!isOpen) {
            stopAudio();
        }
    }, [isOpen]);

    // Prepare audio when result has audioData
    useEffect(() => {
        if (currentResult?.audioData && viewMode === 'result') {
            prepareAudio(currentResult.audioData);
        }
    }, [currentResult, viewMode]);

    // --- AUDIO LOGIC (preserved from original) ---
    const prepareAudio = async (base64: string) => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const ctx = audioCtxRef.current;

            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const dataInt16 = new Int16Array(bytes.buffer);
            const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }

            audioBufferRef.current = buffer;
            playAudio(true);
        } catch (e) {
            console.error('Audio Preparation Error', e);
        }
    };

    const playAudio = (loop: boolean) => {
        if (!audioCtxRef.current || !audioBufferRef.current) return;

        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch (e) { /* ignore */ }
        }

        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
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
    };

    const stopAudio = () => {
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch (e) { /* ignore */ }
            sourceNodeRef.current = null;
        }
        setIsPlaying(false);
    };

    const togglePlayback = () => {
        if (isPlaying) stopAudio();
        else playAudio(isLooping);
    };

    const toggleLoop = () => {
        const newLoopState = !isLooping;
        setIsLooping(newLoopState);
        if (sourceNodeRef.current) {
            sourceNodeRef.current.loop = newLoopState;
        }
    };

    // --- REFERENCE IMAGE HANDLING ---
    const handleImageUpload = (index: number) => {
        fileInputRefs.current[index]?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setReferenceImages(prev => {
                const updated = [...prev];
                if (index < updated.length) {
                    updated[index] = base64;
                } else {
                    updated.push(base64);
                }
                return updated;
            });
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const removeReferenceImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    // --- SETTINGS TOGGLE ---
    const toggleSetting = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- GENERATION ---
    const handleGenerate = async () => {
        setIsGenerating(true);
        setIsSaved(false);
        const result: {
            inputText: string;
            text?: string;
            imageUrl?: string;
            audioData?: string;
            videoUrl?: string;
        } = { inputText };

        try {
            const goalContext = nodes.map(n => `- ${n.text}`).join('\n');
            const fullPrompt = inputText || goalContext;

            // 1. Text generation
            if (settings.text) {
                setGeneratingStep('글 생성 중...');
                result.text = await generateSuccessNarrative(fullPrompt, userProfile);
            }

            // 2. Image generation (with reference images support)
            if (settings.image) {
                setGeneratingStep('이미지 생성 중...');
                if (referenceImages.length > 0) {
                    result.imageUrl = await generateVisualizationImage(fullPrompt, referenceImages, userProfile);
                } else {
                    result.imageUrl = await generateGoalImage(fullPrompt, userProfile);
                }
            }

            // 3. Audio generation (needs text first)
            if (settings.audio) {
                setGeneratingStep('음성 생성 중...');
                const textForSpeech = result.text || fullPrompt;
                result.audioData = await generateSpeech(textForSpeech);
            }

            // 4. Video generation (slowest, last)
            if (settings.video) {
                setGeneratingStep('영상 생성 중... (1-2분 소요)');
                result.videoUrl = await generateVideo(fullPrompt, userProfile);
            }

            setCurrentResult(result);
            setViewMode('result');
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            setGeneratingStep('');
        }
    };

    // --- SAVE / DELETE ---
    const persistSavedItems = useCallback((items: SavedVisualization[]) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(items));
        } catch (e) {
            console.error('Failed to persist saved visualizations:', e);
        }
    }, [storageKey]);

    const handleSave = () => {
        if (!currentResult || isSaved) return;

        const newItem: SavedVisualization = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            inputText: currentResult.inputText,
            text: currentResult.text,
            imageUrl: currentResult.imageUrl,
            audioData: currentResult.audioData,
            videoUrl: currentResult.videoUrl,
        };

        const updated = [newItem, ...savedItems];
        setSavedItems(updated);
        persistSavedItems(updated);
        setIsSaved(true);
    };

    const handleDeleteSaved = (id: string) => {
        const updated = savedItems.filter(item => item.id !== id);
        setSavedItems(updated);
        persistSavedItems(updated);
    };

    const handleLoadSaved = (item: SavedVisualization) => {
        stopAudio();
        setCurrentResult({
            inputText: item.inputText,
            text: item.text,
            imageUrl: item.imageUrl,
            audioData: item.audioData,
            videoUrl: item.videoUrl,
        });
        setIsSaved(true);
        setViewMode('result');
    };

    // --- SWITCH VIEW ---
    const goBackToCreate = () => {
        stopAudio();
        setViewMode('create');
    };

    // --- FORMAT DATE ---
    const formatDate = (timestamp: number): string => {
        const d = new Date(timestamp);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    const isGenerateDisabled = isGenerating;

    // --- SETTING BUTTONS CONFIG ---
    const settingButtons = [
        { key: 'text' as const, label: '글', icon: FileText },
        { key: 'image' as const, label: '이미지', icon: ImageIcon },
        { key: 'video' as const, label: '영상', icon: Film },
        { key: 'audio' as const, label: '음성', icon: Headphones },
    ];

    return (
        <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-deep-space flex flex-col">
            {viewMode === 'create' ? (
                <>
                    {/* CREATE VIEW HEADER */}
                    <div className="flex-shrink-0 h-14 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <Sparkles size={20} className="text-neon-lime" />
                            <h1 className="text-lg md:text-xl font-display font-bold text-white tracking-tight">
                                시각화 스튜디오
                            </h1>
                        </div>
                        <div className="w-10" />
                    </div>

                    {/* CREATE VIEW CONTENT */}
                    <div className="flex-1 overflow-y-auto pb-[120px]">
                        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-8">

                            {/* 입력 섹션 */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-white tracking-wide">
                                    시각화 프롬프트
                                </label>
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="원하는 성공 시각화를 구체적으로 입력하세요... (예: 내가 새 차를 몰고 해변도로를 달리는 모습)"
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 p-4 text-sm leading-relaxed resize-none focus:outline-none focus:border-neon-lime/50 focus:ring-1 focus:ring-neon-lime/30 transition-all"
                                />
                            </div>

                            {/* 참고 이미지 섹션 */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-bold text-white tracking-wide">
                                        참고 이미지 (선택)
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        얼굴 사진, 원하는 차 등 최대 3장
                                    </p>
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
                                                    ref={(el) => { fileInputRefs.current[index] = el; }}
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

                            {/* 생성 설정 섹션 */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-white tracking-wide">
                                    생성 옵션
                                </label>
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
                            </div>

                            {/* 생성하기 버튼 */}
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

                            {/* 저장된 시각화 갤러리 */}
                            {savedItems.length > 0 && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-white tracking-wide">
                                        저장된 시각화
                                    </label>
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
                                                {/* Thumbnail */}
                                                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-white/10 mb-2">
                                                    {item.imageUrl ? (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt="시각화"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-neon-lime/10 to-electric-orange/10 flex items-center justify-center">
                                                            <Sparkles size={24} className="text-neon-lime/40" />
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Text + Date */}
                                                <p className="text-xs text-gray-300 truncate">
                                                    {item.inputText || item.text?.slice(0, 30) || '시각화'}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Clock size={10} className="text-gray-600" />
                                                    <span className="text-[10px] text-gray-600">
                                                        {formatDate(item.timestamp)}
                                                    </span>
                                                </div>
                                                {/* Delete button */}
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
                    {/* RESULT VIEW HEADER */}
                    <div className="flex-shrink-0 h-14 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/5">
                        <button
                            onClick={goBackToCreate}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-lg md:text-xl font-display font-bold text-white tracking-tight">
                            시각화 결과
                        </h1>
                        <button
                            onClick={handleSave}
                            disabled={isSaved}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                isSaved
                                    ? 'bg-white/5 text-neon-lime border border-neon-lime/30 cursor-default'
                                    : 'bg-neon-lime text-black hover:bg-white'
                            }`}
                        >
                            <Save size={16} />
                            <span>{isSaved ? '저장됨 \u2713' : '저장'}</span>
                        </button>
                    </div>

                    {/* RESULT VIEW CONTENT */}
                    <div className="flex-1 overflow-y-auto pb-[120px]">
                        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">

                            {/* Media Area */}
                            <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black group">
                                {currentResult?.videoUrl ? (
                                    <video
                                        src={currentResult.videoUrl}
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

                            {/* Text Area */}
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
                                            )
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Audio Controls */}
                            {currentResult?.audioData && (
                                <div className="flex items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md shadow-lg">
                                    <div className="p-3 bg-neon-lime/10 rounded-full text-neon-lime">
                                        <Headphones size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-white font-bold tracking-wider text-sm">
                                                수면 최면 모드
                                            </span>
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
                                        <div className="text-xs text-gray-500">
                                            바이노럴 비트 & NLP 잠재의식
                                        </div>
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
