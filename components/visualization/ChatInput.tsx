import {
  type FC,
  type ChangeEvent,
  type KeyboardEvent,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  FileText,
  Image as ImageIcon,
  Headphones,
  Film,
  Sparkles,
  Send,
  Paperclip,
  Loader2,
  X,
} from 'lucide-react';

interface ChatInputProps {
  settings: { text: boolean; image: boolean; video: boolean; audio: boolean };
  onSettingsChange: (s: ChatInputProps['settings']) => void;
  imageQuality: 'medium' | 'high';
  onImageQualityChange: (q: 'medium' | 'high') => void;
  onSend: (text: string) => void;
  onGenerate: () => void;
  onImageAttach: (dataUrl: string) => void;
  isGenerating: boolean;
  referenceImages: string[];
  onRemoveImage: (index: number) => void;
}

const TOGGLE_ITEMS = [
  { key: 'text' as const, Icon: FileText },
  { key: 'image' as const, Icon: ImageIcon },
  { key: 'audio' as const, Icon: Headphones },
  { key: 'video' as const, Icon: Film },
] as const;

const ChatInput: FC<ChatInputProps> = ({
  settings,
  onSettingsChange,
  imageQuality,
  onImageQualityChange,
  onSend,
  onGenerate,
  onImageAttach,
  isGenerating,
  referenceImages,
  onRemoveImage,
}) => {
  const [text, setText] = useState('');
  const [showQualityPopup, setShowQualityPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mobile keyboard height via VirtualKeyboard API (overlays-content 모드)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const nav = navigator as unknown as {
      virtualKeyboard?: {
        overlaysContent: boolean;
        boundingRect: DOMRect;
        addEventListener: (e: string, fn: () => void) => void;
        removeEventListener: (e: string, fn: () => void) => void;
      };
    };
    if (!nav.virtualKeyboard) return;
    nav.virtualKeyboard.overlaysContent = true;
    const onChange = () =>
      setKeyboardHeight(
        Math.round(nav.virtualKeyboard!.boundingRect.height),
      );
    nav.virtualKeyboard.addEventListener('geometrychange', onChange);
    return () =>
      nav.virtualKeyboard!.removeEventListener('geometrychange', onChange);
  }, []);

  const handleToggle = useCallback(
    (key: keyof ChatInputProps['settings']) => {
      onSettingsChange({ ...settings, [key]: !settings[key] });
      if (key === 'image' && !settings.image) {
        setShowQualityPopup(true);
      }
    },
    [settings, onSettingsChange],
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImageAttach(reader.result);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [onImageAttach],
  );

  const hasText = text.trim().length > 0;

  return (
    <div
      className="flex flex-col gap-2 px-3 pb-3 pt-2"
      style={keyboardHeight > 0 ? {
        position: 'fixed',
        bottom: `${keyboardHeight}px`,
        left: 0,
        right: 0,
        zIndex: 60,
        background: '#141414',
        paddingBottom: 12,
      } : undefined}
    >
      {/* Reference image thumbnails */}
      {referenceImages.length > 0 && (
        <div className="flex gap-2 px-1">
          {referenceImages.map((src, i) => (
            <div key={`ref-${i}`} className="relative w-10 h-10 rounded-lg overflow-hidden">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center
                  justify-center cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.7)' }}
              >
                <X size={10} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Top row: toggles + generate button */}
      <div className="flex items-center justify-between" style={{ height: 40 }}>
        <div className="flex items-center" style={{ gap: 20 }}>
          {TOGGLE_ITEMS.map(({ key, Icon }) => {
            const active = settings[key];
            return (
              <div key={key} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleToggle(key)}
                  className="cursor-pointer bg-transparent border-none p-0"
                  style={{
                    color: active ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
                    transition: 'transform 150ms ease, color 150ms ease',
                  }}
                  onPointerDown={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)';
                  }}
                  onPointerUp={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                  onPointerLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  <Icon size={20} />
                </button>
                {active && (
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: 'var(--accent)',
                      bottom: -4,
                    }}
                  />
                )}

                {/* Image quality popup */}
                {key === 'image' && showQualityPopup && settings.image && (
                  <div
                    className="absolute bottom-full mb-2 flex gap-1 rounded-xl shadow-lg z-50"
                    style={{ background: '#1E1E1E', padding: '6px 8px' }}
                  >
                    {(['medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          onImageQualityChange(q);
                          setShowQualityPopup(false);
                        }}
                        className="text-xs px-2 py-1 rounded-lg cursor-pointer border-none"
                        style={{
                          background:
                            imageQuality === q
                              ? 'rgba(255,255,255,0.15)'
                              : 'transparent',
                          color: 'rgba(255,255,255,0.8)',
                        }}
                      >
                        {q === 'medium' ? 'Medium' : 'High'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 h-8 rounded-full cursor-pointer border-none"
          style={{
            background: 'var(--accent)',
            padding: '0 14px',
            fontSize: 13,
            fontWeight: 700,
            color: '#1a1a1a',
            transition: 'transform 80ms ease',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
          onPointerLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          {isGenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Sparkles size={12} />
              <span>생성하기</span>
            </>
          )}
        </button>
      </div>

      {/* Bottom row: input area */}
      <div
        className="flex items-end gap-2"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22,
          padding: '8px 12px',
          minHeight: 44,
        }}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer bg-transparent border-none p-0 flex-shrink-0 mb-0.5"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="장면을 더 구체적으로 묘사해보세요..."
          rows={1}
          className="flex-1 resize-none bg-transparent border-none outline-none"
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.5,
            maxHeight: 120,
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          className="flex-shrink-0 flex items-center justify-center rounded-full
            cursor-pointer border-none mb-0.5"
          style={{
            width: 28,
            height: 28,
            background: hasText ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
            transition: 'background 150ms ease',
          }}
        >
          <Send
            size={14}
            color={hasText ? '#1a1a1a' : 'rgba(255,255,255,0.4)'}
          />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
