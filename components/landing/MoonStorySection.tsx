import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { landingContent } from './landingContent';

const DEFAULT_VISIBLE_PARAGRAPHS = 4;

export const MoonStorySection: React.FC = () => {
  const { language } = useTranslation();
  const copy = landingContent[language].moonStory;
  const [isExpanded, setIsExpanded] = useState(false);

  const paragraphs = useMemo(
    () => (isExpanded ? copy.paragraphs : copy.paragraphs.slice(0, DEFAULT_VISIBLE_PARAGRAPHS)),
    [copy.paragraphs, isExpanded],
  );

  return (
    <section className="relative px-5 py-24 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="relative rounded-[40px] border border-[#d7e5ff]/12 bg-[linear-gradient(145deg,rgba(11,18,32,0.9),rgba(17,25,42,0.84),rgba(20,34,31,0.72))] px-6 py-8 text-white shadow-[0_40px_120px_-70px_rgba(0,0,0,0.95)] backdrop-blur-xl md:px-12 md:py-14">
          <div className="absolute inset-[1px] rounded-[39px] border border-white/6" />
          <div className="absolute inset-0 rounded-[40px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(168,240,211,0.08),transparent_28%)]" />
          <p className="relative font-body text-[0.72rem] uppercase tracking-[0.34em] text-[#d8e4fb]/54">
            {copy.eyebrow}
          </p>
          <h2 className="relative mt-5 max-w-4xl text-balance font-display text-4xl font-semibold tracking-[-0.06em] text-white md:text-6xl md:leading-[1.02]">
            {copy.title}
          </h2>
          <p className="relative mt-5 max-w-2xl text-base leading-relaxed text-[#d6e2fb]/62 md:text-lg">
            {copy.intro}
          </p>

          <div className="relative mt-12 space-y-6">
            {paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="max-w-3xl text-pretty text-lg leading-relaxed tracking-[-0.01em] text-[#eef3fb]/82 md:text-[1.18rem]"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="relative mt-10 flex flex-col items-start gap-6 border-t border-white/10 pt-8">
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="rounded-full border border-[#d7e5ff]/18 bg-[linear-gradient(135deg,rgba(151,187,255,0.12),rgba(255,255,255,0.04))] px-5 py-3 text-sm font-medium tracking-[-0.01em] text-white transition-colors duration-200 hover:bg-white/[0.08]"
            >
              {isExpanded ? copy.collapseLabel : copy.expandLabel}
            </button>

            <p className="font-display text-lg tracking-[-0.03em] text-[#d6e2fb]/62">
              {copy.signature}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
