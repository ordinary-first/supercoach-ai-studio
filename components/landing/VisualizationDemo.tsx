import React from 'react';
import { FileText, Image, Volume2, Video, ImagePlus, Play } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

// Fake audio waveform bar heights
const WAVEFORM_HEIGHTS = [4, 8, 16, 12, 20, 10, 24, 14, 18, 8, 22, 12, 16, 6, 20, 10, 14, 18, 8, 12];

export const VisualizationDemo: React.FC = () => {
  const { ref, isVisible } = useScrollReveal();
  const { language } = useTranslation();

  return (
    <section
      id="visualization"
      className="py-8 md:py-24 px-6"
      style={{ backgroundColor: '#050B14' }}
    >
      {/* Section header */}
      <div className="flex flex-col items-center text-center mb-5 md:mb-12 gap-2">
        <h2
          className="text-2xl md:text-5xl font-bold leading-tight"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {language === 'ko' ? (
            <>
              <span className="text-gray-300">성공을 미리 </span>
              <span style={{ color: '#5AA9FF' }}>경험하세요</span>
            </>
          ) : (
            <>
              <span className="text-gray-300">Experience success </span>
              <span style={{ color: '#5AA9FF' }}>before it happens</span>
            </>
          )}
        </h2>
        <p
          className="text-gray-400 text-sm md:text-base mt-2"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {language === 'ko' ? 'AI가 생성하는 4가지 감각의 미래 시각화' : 'AI-generated future visualization across 4 senses'}
        </p>
        <div
          className="w-12 h-0.5 rounded-full mt-2"
          style={{ backgroundColor: '#5AA9FF' }}
        />
      </div>

      {/* Demo card */}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`max-w-4xl mx-auto transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div
          className="rounded-2xl md:rounded-3xl p-4 md:p-8 border"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          {/* 2x2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

            {/* 1. 텍스트 */}
            <div
              className="rounded-2xl p-5 border flex flex-col gap-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,169,255,0.12)' }}
                >
                  <FileText size={16} style={{ color: '#5AA9FF' }} />
                </div>
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: '#5AA9FF',
                    backgroundColor: 'rgba(90,169,255,0.12)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {language === 'ko' ? '텍스트' : 'Text'}
                </span>
                <span
                  className="text-xs text-gray-500 ml-auto"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {language === 'ko' ? 'AI 성공 내러티브' : 'AI Success Narrative'}
                </span>
              </div>
              <p
                className="text-sm text-gray-300 italic leading-relaxed"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {language === 'ko'
                  ? '"나는 6개월 후, 마침내 그 목표를 이뤘다. 매일 쌓아온 작은 습관들이 결국 큰 변화를 만들어냈다..."'
                  : '"Six months later, I finally achieved that goal. The small habits I built each day ultimately created a massive transformation..."'}
              </p>
            </div>

            {/* 2. 이미지 */}
            <div
              className="rounded-2xl p-5 border flex flex-col gap-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,169,255,0.12)' }}
                >
                  <Image size={16} style={{ color: '#5AA9FF' }} />
                </div>
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: '#5AA9FF',
                    backgroundColor: 'rgba(90,169,255,0.12)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {language === 'ko' ? '이미지' : 'Image'}
                </span>
                <span
                  className="text-xs text-gray-500 ml-auto"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {language === 'ko' ? 'AI 생성 이미지' : 'AI Generated Image'}
                </span>
              </div>
              {/* Placeholder with gradient + icon */}
              <div
                className="flex-1 min-h-20 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(90,169,255,0.08) 0%, transparent 100%)',
                  border: '1px dashed rgba(90,169,255,0.24)',
                }}
              >
                <ImagePlus size={28} style={{ color: 'rgba(90,169,255,0.45)' }} />
              </div>
            </div>

            {/* 3. 음성 */}
            <div
              className="rounded-2xl p-5 border flex flex-col gap-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,169,255,0.12)' }}
                >
                  <Volume2 size={16} style={{ color: '#5AA9FF' }} />
                </div>
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: '#5AA9FF',
                    backgroundColor: 'rgba(90,169,255,0.12)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {language === 'ko' ? '음성' : 'Audio'}
                </span>
                <span
                  className="text-xs text-gray-500 ml-auto"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {language === 'ko' ? 'AI 나레이션' : 'AI Narration'}
                </span>
              </div>
              {/* Fake waveform */}
              <div className="flex items-center gap-0.5 px-1 h-10">
                {WAVEFORM_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: `${h}px`,
                      backgroundColor: 'rgba(90,169,255,0.7)',
                      minWidth: '3px',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 4. 영상 */}
            <div
              className="rounded-2xl p-5 border flex flex-col gap-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(90,169,255,0.12)' }}
                >
                  <Video size={16} style={{ color: '#5AA9FF' }} />
                </div>
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    color: '#5AA9FF',
                    backgroundColor: 'rgba(90,169,255,0.12)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {language === 'ko' ? '영상' : 'Video'}
                </span>
                <span
                  className="text-xs text-gray-500 ml-auto"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {language === 'ko' ? 'AI 비전 영상' : 'AI Vision Video'}
                </span>
              </div>
              {/* Play button placeholder */}
              <div
                className="flex-1 min-h-20 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,77,0,0.05) 0%, transparent 100%)',
                  border: '1px dashed rgba(255,77,0,0.2)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,77,0,0.15)', border: '1px solid rgba(255,77,0,0.3)' }}
                >
                  <Play size={18} style={{ color: 'rgba(255,77,0,0.8)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tech badge */}
        <div className="flex justify-center mt-5">
          <span
            className="text-xs text-gray-500 px-4 py-1.5 rounded-full border"
            style={{
              fontFamily: 'Inter, sans-serif',
              borderColor: 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            Powered by GPT-image-1.5 &amp; Sora-2
          </span>
        </div>
      </div>
    </section>
  );
};
