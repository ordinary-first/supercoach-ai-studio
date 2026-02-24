import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: '무료 체험 후 자동 결제되나요?',
    answer:
      '아니요. 3일 체험 후 Explorer 무료 플랜으로 자동 전환됩니다. 유료 결제는 직접 업그레이드할 때만 발생합니다.',
  },
  {
    question: 'AI 코치가 정말 개인화되나요?',
    answer:
      '네. 단기·중기·장기 3단 기억 시스템으로 당신의 목표, 할 일, 성격, 대화 이력을 모두 기억합니다. 사용할수록 더 정확한 코칭을 제공합니다.',
  },
  {
    question: 'AI 코칭이 사람 코칭만큼 효과 있나요?',
    answer:
      '사람 코치의 강점(공감)과 AI의 강점(24시간, 데이터 축적, 일관성)은 다릅니다. Secret Coach는 "코치 대체"가 아니라 "매일 곁에 있는 보조 코치" 역할입니다. 사람 코치와 병행해도 시너지가 납니다.',
  },
  {
    question: '데이터는 안전한가요?',
    answer:
      'Firebase Authentication으로 계정을 보호하고, 모든 데이터는 Google Cloud Firestore와 Cloudflare R2에 암호화되어 저장됩니다.',
  },
  {
    question: '모바일에서도 사용할 수 있나요?',
    answer:
      '웹앱으로 모든 기기의 브라우저에서 사용 가능합니다. Android 네이티브 앱도 준비 중입니다.',
  },
  {
    question: '베타 특가가 끝나면 어떻게 되나요?',
    answer:
      '베타 기간 중 가입하신 분들은 현재 특가가 영구 유지됩니다. 정식 출시 후 가격이 인상되어도 베타 가입자는 락인(Lock-in) 혜택으로 보호됩니다.',
  },
  {
    question: '환불 정책이 어떻게 되나요?',
    answer:
      '구독 시작 후 14일 이내 전액 환불 가능합니다. 환불 정책 페이지에서 자세한 내용을 확인하세요.',
  },
  {
    question: '다른 목표 관리 앱과 뭐가 다른가요?',
    answer:
      'AI 코치(3단 기억 시스템) + 시각화 스튜디오(이미지/음성/영상 생성) + 마인드맵 통합은 Secret Coach만의 고유 기능입니다. 단순 할일 앱이 아닌 통합 목표 달성 시스템입니다.',
  },
];

interface AccordionItemProps {
  item: FAQItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ item, index, isOpen, onToggle }) => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-white/5 border border-white/10 rounded-2xl mb-3 overflow-hidden transition-all duration-700"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* Question row */}
      <button
        className="w-full p-5 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors rounded-2xl text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-white pr-4">{item.question}</span>
        <ChevronDown
          size={18}
          className="text-gray-400 shrink-0 transition-transform duration-300"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Answer */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? '400px' : '0px' }}
      >
        <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
};

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { ref: headingRef, isVisible: headingVisible } = useScrollReveal();

  const handleToggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section id="faq" className="py-12 md:py-24 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Heading */}
        <div
          ref={headingRef as React.RefObject<HTMLDivElement>}
          className="text-center mb-8 md:mb-12 transition-all duration-700"
          style={{
            opacity: headingVisible ? 1 : 0,
            transform: headingVisible ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          <h2 className="text-2xl md:text-5xl font-bold text-white">자주 묻는 질문</h2>
        </div>

        {/* Accordion */}
        <div>
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem
              key={index}
              item={item}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
