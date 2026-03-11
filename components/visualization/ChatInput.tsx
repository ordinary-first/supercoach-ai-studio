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
import { useTranslation } from '../../i18n/useTranslation';

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
  const { language, t } = useTranslation();
  const [text, setText] = useState('');
  const [showQualityPopup, setShowQualityPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const nav = navigator as unknown as {
      virtualKeyboard?: {
        overlaysContent: boolean;
        boundingRect: DOMRect;
        addEventListener: (event: string, fn: () => void) => void;
        removeEventListener: (event: string, fn: () => void) => void;
      };
    };

    if (!nav.virtualKeyboard) return;

    nav.virtualKeyboard.overlaysContent = true;
    const onChange = () => {
      setKeyboardHeight(Math.round(nav.virtualKeyboard!.boundingRect.height));
    };

    nav.virtualKeyboard.addEventListener('geometrychange', onChange);
    return () => nav.virtualKeyboard!.removeEventListener('geometrychange', onChange);
  }, []);

  const handleToggle = useCallback(
    (key: keyof ChatInputProps['settings']) => {
      onSettingsChange({ ...settings, [key]: !settings[key] });
      if (key === 'image' && !settings.image) setShowQualityPopup(true);
    },
    [onSettingsChange, settings],
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [onSend, text]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const handleFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') onImageAttach(reader.result);
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [onImageAttach],
  );

  const hasText = text.trim().length > 0;

  return (
    <div
      className="apple-glass-header flex flex-col gap-2 px-3 pb-3 pt-2"
      style={keyboardHeight > 0
        ? {
          position: 'fixed',
          bottom: `${keyboardHeight}px`,
          left: 0,
          right: 0,
          zIndex: 60,
          paddingBottom: 12,
        }
        : undefined}
    >
      {referenceImages.length > 0 && (
        <div className="flex gap-2 px-1">
          {referenceImages.map((src, index) => (
            <div key={`ref-${index}`} className="relative w-10 h-10 rounded-lg overflow-hidden">
              <img src={src} alt={t.visualization.refImageAlt} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-th-overlay/70 text-th-text-inverse
                  flex items-center justify-center border border-th-border/20"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between h-10">
        <div className="flex items-center gap-5">
          {TOGGLE_ITEMS.map(({ key, Icon }) => {
            const active = settings[key];
            return (
              <div key={key} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleToggle(key)}
                  className={`transition-transform duration-150 ${active ? 'text-th-accent scale-105' : 'text-th-text-tertiary hover:text-th-text'
                    }`}
                >
                  <Icon size={20} />
                </button>
                {active && <div className="absolute bottom-[-4px] w-1 h-1 rounded-full bg-th-accent" />}

                {key === 'image' && showQualityPopup && settings.image && (
                  <div className="apple-glass-panel absolute bottom-full mb-2 flex gap-1 rounded-xl p-1.5 z-50 shadow-xl">
                    {(['medium', 'high'] as const).map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => {
                          onImageQualityChange(quality);
                          setShowQualityPopup(false);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${imageQuality === quality ? 'bg-th-accent text-th-text-inverse' : 'text-th-text-secondary hover:bg-th-surface'
                          }`}
                      >
                        {quality === 'medium'
                          ? language === 'ko' ? '보통' : 'Medium'
                          : language === 'ko' ? '고화질' : 'High'}
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
          className="flex items-center gap-1.5 h-8 rounded-full bg-th-accent px-3.5 text-[13px]
            font-bold text-white active:scale-[0.97] transition-transform shadow-sm"
          style={{ textShadow: '0 1px 2px rgba(4, 18, 38, 0.32)' }}
        >
          {isGenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Sparkles size={12} />
              <span>{t.visualization.generateButton}</span>
            </>
          )}
        </button>
      </div>

      <div className="apple-card flex items-end gap-2 rounded-[22px] px-3 py-2 min-h-11 shadow-sm border-th-border/30">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-th-text-tertiary hover:text-th-text mb-0.5"
        >
          <Paperclip size={20} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t.visualization.scenePlaceholder}
          rows={1}
          className="flex-1 resize-none bg-transparent border-none outline-none text-sm leading-6
            text-th-text placeholder:text-th-text-muted max-h-[120px]"
        />

        <button
          type="button"
          onClick={handleSend}
          className={`w-7 h-7 rounded-full mb-0.5 flex items-center justify-center transition-colors ${hasText ? 'bg-th-accent text-white shadow-sm' : 'bg-th-surface border border-th-border text-th-text-tertiary'
            }`}
          style={hasText ? { textShadow: '0 1px 2px rgba(4, 18, 38, 0.32)' } : undefined}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
