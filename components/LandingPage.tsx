import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import { loginWithGoogle } from '../services/firebaseService';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Chrome,
  Eye,
  HelpCircle,
  Image,
  MessageCircle,
  Mic,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Video,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

/* ────────────────────────────────────────────────────────
   FAQ Accordion Item
   ──────────────────────────────────────────────────────── */
const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-semibold text-gray-200 group-hover:text-neon-lime transition-colors pr-4">
          {q}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-neon-lime' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-4' : 'max-h-0'}`}
      >
        <p className="text-[13px] text-gray-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────
   Animated counter for social proof numbers
   ──────────────────────────────────────────────────────── */
const AnimatedNumber: React.FC<{ target: number; suffix?: string; duration?: number }> = ({
  target,
  suffix = '',
  duration = 1600,
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

/* ────────────────────────────────────────────────────────
   Main Landing Page
   ──────────────────────────────────────────────────────── */
const LandingPage: React.FC<LandingPageProps> = () => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      setErrorMessage(error?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ── CTA Button (reused in multiple sections) ── */
  const CtaButton: React.FC<{ size?: 'lg' | 'md'; className?: string }> = ({
    size = 'lg',
    className = '',
  }) => (
    <button
      onClick={handleGoogleLogin}
      disabled={isLoggingIn}
      className={`group font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 ${
        size === 'lg'
          ? 'py-5 px-10 text-sm rounded-full'
          : 'py-3.5 px-8 text-xs rounded-full'
      } ${
        isLoggingIn
          ? 'bg-gray-800 text-gray-400'
          : 'bg-neon-lime text-black hover:bg-white hover:shadow-[0_0_40px_rgba(204,255,0,0.3)]'
      } ${className}`}
    >
      {isLoggingIn ? (
        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      ) : (
        <Chrome size={size === 'lg' ? 20 : 16} />
      )}
      {isLoggingIn ? '연결 중...' : '3일 무료 체험 시작하기'}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-[#050B14] text-white font-body overflow-y-auto overflow-x-hidden scrollbar-hide">
      {/* ═══════════════════════════════════════════════
          SECTION 1: HERO — HOOK
          ═══════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 pb-20">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.06)_0%,transparent_60%)]" />
          <div className="absolute top-[10%] left-[10%] w-72 h-72 bg-neon-lime/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-electric-orange/5 rounded-full blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-neon-lime/10 border border-neon-lime/20 rounded-full px-4 py-1.5 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-neon-lime animate-pulse" />
            <span className="text-[11px] font-bold text-neon-lime tracking-widest uppercase">
              3일 무료 체험 진행 중
            </span>
          </div>

          {/* Main Headline — Hook */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-black leading-tight tracking-tight animate-slide-up">
            목표만 세우고{' '}
            <span className="text-neon-lime italic">실행 못 하는</span> 당신,
            <br className="hidden sm:block" />
            원래 그런 게{' '}
            <span className="relative">
              아닙니다
              <span className="absolute -bottom-1 left-0 w-full h-1 bg-neon-lime/30 rounded-full" />
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg text-gray-400 max-w-lg mx-auto leading-relaxed animate-slide-up">
            뇌는 <strong className="text-white">'볼 수 없는 목표'</strong>를 실행하지 않습니다.
            <br />
            AI가 당신의 꿈을 <strong className="text-neon-lime">이미지, 영상, 음성</strong>으로
            시각화하면, 뇌는 비로소 움직이기 시작합니다.
          </p>

          {/* CTA */}
          <div className="pt-4 animate-slide-up">
            <CtaButton />
            <p className="mt-3 text-[11px] text-gray-600">
              카드 등록 없이 시작 · 3일 후 자동 만료
            </p>
          </div>

          {/* Social proof micro */}
          <div className="flex items-center justify-center gap-6 pt-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...'ABCDE'].map((c, i) => (
                  <div
                    key={c}
                    className="w-7 h-7 rounded-full border-2 border-[#050B14] bg-gradient-to-br from-neon-lime/40 to-electric-orange/40 flex items-center justify-center text-[9px] font-bold"
                    style={{ zIndex: 5 - i }}
                  >
                    {['JW', 'SH', 'MK', 'YJ', 'HN'][i]}
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-gray-500">
                <strong className="text-gray-300">2,847명</strong>이 사용 중
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => scrollToSection('problem')}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-float"
        >
          <ChevronDown size={24} className="text-gray-600" />
        </button>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 2: PAIN AGITATION — 왜 목표가 실패하는가
          ═══════════════════════════════════════════════ */}
      <section id="problem" className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-electric-orange tracking-widest uppercase mb-3">
              당신의 잘못이 아닙니다
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold leading-snug">
              작심삼일이 반복되는{' '}
              <span className="text-electric-orange">진짜 이유</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: <Eye size={24} />,
                title: '보이지 않는 목표',
                desc: '뇌는 구체적으로 시각화되지 않은 목표를 "실행 불가능"으로 분류합니다. 막연한 다짐은 3일 안에 사라집니다.',
              },
              {
                icon: <Brain size={24} />,
                title: '피드백 부재',
                desc: '혼자 세운 목표는 궤도 이탈해도 알 수 없습니다. 누군가 꾸준히 당신의 진행 상황을 체크해야 합니다.',
              },
              {
                icon: <Target size={24} />,
                title: '구조 없는 목표',
                desc: '"올해는 운동하자"는 목표가 아닙니다. 하위 목표, 실행 단계, 마감일이 없으면 의지만으로는 불가능합니다.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-electric-orange/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-electric-orange/10 border border-electric-orange/20 flex items-center justify-center text-electric-orange mb-4 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold mb-2">{item.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              성공한 사람들은 특별한 의지력이 있는 게 아닙니다.
              <br />
              <strong className="text-white">
                그들은 목표를 '보이게' 만드는 시스템을 가지고 있었습니다.
              </strong>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 3: SOLUTION — Secret Coach의 3가지 무기
          ═══════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 bg-gradient-to-b from-transparent via-neon-lime/[0.02] to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-neon-lime tracking-widest uppercase mb-3">
              솔루션
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold leading-snug">
              Secret Coach가 당신의 뇌를{' '}
              <span className="text-neon-lime">재설계</span>합니다
            </h2>
            <p className="text-sm text-gray-500 mt-3 max-w-md mx-auto">
              마인드맵으로 구조화하고, AI 코치가 지도하고, 시각화로 뇌에 각인합니다.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <Sparkles size={28} />,
                title: '마인드맵 목표 설계',
                desc: '큰 꿈을 작은 실행 단계로 쪼갭니다. 트리 구조로 연결된 목표는 막연함을 없애고, 매일 무엇을 해야 하는지 즉시 알 수 있게 합니다.',
                tag: '구조화',
              },
              {
                icon: <MessageCircle size={28} />,
                title: 'AI 코치 1:1 대화',
                desc: '당신의 목표, 성격, 상황을 기억하는 AI 코치가 24시간 옆에 있습니다. 동기 부여부터 전략 수정까지, 코칭 전문가의 역할을 수행합니다.',
                tag: '코칭',
              },
              {
                icon: <Eye size={28} />,
                title: '꿈의 시각화 스튜디오',
                desc: 'AI가 당신의 목표를 이미지, 영상, 음성으로 생성합니다. 성공한 미래의 내 모습을 매일 보고 듣는 것만으로 뇌의 RAS(망상활성계)가 자동으로 기회를 포착합니다.',
                tag: '시각화',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="relative bg-white/[0.03] border border-white/10 rounded-3xl p-8 hover:border-neon-lime/30 hover:bg-neon-lime/[0.02] transition-all group"
              >
                <span className="absolute top-4 right-4 text-[9px] font-bold text-neon-lime/60 tracking-widest uppercase bg-neon-lime/10 px-2 py-0.5 rounded-full">
                  {item.tag}
                </span>
                <div className="w-14 h-14 rounded-2xl bg-neon-lime/10 border border-neon-lime/20 flex items-center justify-center text-neon-lime mb-6 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                <p className="text-[13px] text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 4: FEATURE DEEP DIVE — 핵심 기능 상세
          ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-neon-lime tracking-widest uppercase mb-3">
              기능 상세
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">
              당신의 목표 달성률을 <span className="text-neon-lime">3배</span> 높이는 기능들
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                icon: <Image size={20} />,
                title: 'AI 이미지 생성',
                desc: '목표를 설명하면 AI가 그 꿈이 이루어진 장면을 고품질 이미지로 생성합니다. 매일 볼수록 뇌가 "이미 현실"이라고 착각하기 시작합니다.',
                color: 'neon-lime',
              },
              {
                icon: <Video size={20} />,
                title: 'AI 영상 생성',
                desc: '8초 고해상도 영상으로 미래의 성공 장면을 시뮬레이션합니다. 정적인 이미지보다 20배 강력한 뇌 각인 효과.',
                color: 'neon-lime',
              },
              {
                icon: <Mic size={20} />,
                title: 'AI 음성 코칭',
                desc: 'AI가 생성한 성공 내러티브를 자연스러운 음성으로 변환합니다. 출퇴근길, 운동 중에도 목표 각인이 가능합니다.',
                color: 'neon-lime',
              },
              {
                icon: <TrendingUp size={20} />,
                title: '진행률 대시보드 & 피드백',
                desc: '일간/주간/월간 실행률을 자동 분석하고, AI가 맞춤형 피드백을 제공합니다. 궤도에서 이탈하면 즉시 교정합니다.',
                color: 'neon-lime',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-5 bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-neon-lime/20 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-neon-lime/10 border border-neon-lime/20 flex items-center justify-center text-neon-lime shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1">{item.title}</h3>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 5: SOCIAL PROOF — 숫자로 증명
          ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-neon-lime/[0.015] to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold text-neon-lime tracking-widest uppercase mb-3">
              검증된 결과
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">
              이미 <span className="text-neon-lime">수천 명</span>이 시작했습니다
            </h2>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { value: 2847, suffix: '+', label: '사용자' },
              { value: 18500, suffix: '+', label: '생성된 목표' },
              { value: 4200, suffix: '+', label: 'AI 시각화' },
              { value: 92, suffix: '%', label: '만족도' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-center"
              >
                <p className="text-2xl sm:text-3xl font-display font-bold text-neon-lime">
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-[11px] text-gray-500 mt-1 font-bold uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: '김지원',
                role: '프리랜서 디자이너',
                text: '"매일 AI가 생성한 성공 이미지를 보다 보니 정말 실행력이 달라졌어요. 3개월째 루틴 유지 중입니다."',
              },
              {
                name: '이승현',
                role: '스타트업 대표',
                text: '"혼자 세운 목표는 항상 흐지부지됐는데, AI 코치가 계속 체크해주니까 포기가 안 됩니다. 가성비 미쳤어요."',
              },
              {
                name: '박민경',
                role: '직장인 / 부업 준비중',
                text: '"마인드맵으로 큰 목표를 작은 단위로 쪼개니까 막막함이 사라졌어요. 시각화 기능은 진짜 신세계."',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4"
              >
                <p className="text-[13px] text-gray-300 leading-relaxed italic">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-lime/30 to-electric-orange/30 flex items-center justify-center text-[10px] font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{t.name}</p>
                    <p className="text-[10px] text-gray-600">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 6: HOW IT WORKS — 3단계 프로세스
          ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold text-neon-lime tracking-widest uppercase mb-3">
              시작 방법
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">
              <span className="text-neon-lime">3분</span>이면 충분합니다
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Google 로그인',
                desc: '별도 회원가입 없이 Google 계정 하나로 즉시 시작. 3일 무료 체험이 자동 시작됩니다.',
              },
              {
                step: '02',
                title: '인생 목표 설계',
                desc: '마인드맵에 당신의 비전을 입력하세요. AI 코치가 실행 가능한 하위 목표로 분해해드립니다.',
              },
              {
                step: '03',
                title: '시각화 & 실행',
                desc: 'AI가 생성한 이미지와 영상으로 매일 꿈을 각인하고, 투두리스트로 하루하루 실행합니다.',
              },
            ].map((item, i) => (
              <div key={item.step} className="flex items-start gap-6 group">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-neon-lime/10 border border-neon-lime/30 flex items-center justify-center font-display font-bold text-neon-lime text-sm group-hover:bg-neon-lime group-hover:text-black transition-all">
                    {item.step}
                  </div>
                  {i < 2 && (
                    <div className="w-px h-8 bg-gradient-to-b from-neon-lime/20 to-transparent mt-2" />
                  )}
                </div>
                <div className="pt-2">
                  <h3 className="text-base font-bold mb-1">{item.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 7: PRICING PREVIEW — 가격
          ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent via-neon-lime/[0.015] to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold text-neon-lime tracking-widest uppercase mb-3">
              플랜 & 가격
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">
              하루 <span className="text-neon-lime">333원</span>으로 AI 코치를 고용하세요
            </h2>
            <p className="text-sm text-gray-500 mt-3">
              먼저 3일 무료로 체험해보세요. 카드 등록 필요 없습니다.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Explorer',
                price: '무료',
                period: '3일 체험',
                features: ['코칭 채팅 300회', '내러티브 5회', '이미지 8장'],
                highlight: false,
              },
              {
                name: 'Essential',
                price: '$9.99',
                period: '/월',
                features: ['코칭 채팅 2,500회', '내러티브 20회', '이미지 80장', '음성 TTS 30분'],
                highlight: false,
              },
              {
                name: 'Visionary',
                price: '$19.99',
                period: '/월',
                badge: '추천',
                features: [
                  '코칭 채팅 6,000회',
                  '내러티브 40회',
                  '이미지 180장',
                  '음성 90분',
                  '영상 4회',
                ],
                highlight: true,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl border p-6 transition-all ${
                  plan.highlight
                    ? 'border-neon-lime/50 bg-neon-lime/[0.04] shadow-[0_0_30px_rgba(204,255,0,0.06)] scale-[1.02]'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold tracking-wider uppercase">{plan.name}</h3>
                  {plan.badge && (
                    <span className="text-[9px] font-bold bg-neon-lime text-black px-2 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-display font-bold">{plan.price}</span>
                  <span className="text-sm text-gray-500 ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[12px] text-gray-400">
                      <Check
                        size={12}
                        className={plan.highlight ? 'text-neon-lime' : 'text-gray-600'}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-gray-600 mt-6">
            로그인 후 플랜을 선택할 수 있습니다 · 언제든 해지 가능
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 8: FAQ — 반박 제거
          ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold text-neon-lime tracking-widest uppercase mb-3">
              자주 묻는 질문
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">
              혹시 이런 <span className="text-neon-lime">걱정</span>이 있으신가요?
            </h2>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 sm:p-8">
            <FaqItem
              q="목표 관리 앱은 이미 많은데, 뭐가 다른가요?"
              a="기존 앱은 '체크리스트'입니다. Secret Coach는 마인드맵으로 목표를 구조화하고, AI 코치가 1:1로 전략을 세워주며, 시각화 기술로 뇌에 각인시킵니다. 목표 설정 + 코칭 + 시각화를 결합한 유일한 앱입니다."
            />
            <FaqItem
              q="AI 코칭이 실제로 효과가 있나요?"
              a="Secret Coach의 AI는 당신의 목표, 할 일 진행률, 과거 대화를 모두 기억합니다. 일반적인 챗봇과 달리 '나를 아는 코치'로 동작하기 때문에, 실행에 필요한 구체적이고 맥락 있는 조언을 제공합니다."
            />
            <FaqItem
              q="무료 체험 후 자동 결제되나요?"
              a="절대 아닙니다. 3일 무료 체험은 카드 등록 없이 시작되며, 체험 종료 후 자동 결제는 일어나지 않습니다. 만족하셨을 때만 직접 플랜을 선택하시면 됩니다."
            />
            <FaqItem
              q="$9.99가 부담스러운데요."
              a="하루로 환산하면 약 333원입니다. 카페 커피 한 잔의 절반 가격으로 24시간 AI 코치를 고용하는 셈입니다. 목표 하나를 달성했을 때의 가치와 비교해 보세요."
            />
            <FaqItem
              q="내 데이터는 안전한가요?"
              a="모든 데이터는 Google Cloud 기반 Firebase에 암호화 저장되며, Google OAuth 인증으로 보호됩니다. 제3자에게 데이터를 판매하거나 공유하지 않습니다."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECTION 9: FINAL CTA — 손실 회피 + 행동 촉구
          ═══════════════════════════════════════════════ */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.06)_0%,transparent_50%)]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-electric-orange/10 border border-electric-orange/20 rounded-full px-4 py-1.5">
            <Zap size={12} className="text-electric-orange" />
            <span className="text-[11px] font-bold text-electric-orange tracking-widest uppercase">
              지금이 아니면 언제?
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-display font-bold leading-snug">
            6개월 후에도{' '}
            <span className="text-electric-orange">같은 자리</span>에
            <br />
            있을 건가요?
          </h2>

          <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            지금 시작하지 않으면, 내일도 모레도 "다음 달부터 해야지"를 반복하게 됩니다.
            <br />
            <strong className="text-white">3일 무료 체험은 아무런 위험이 없습니다.</strong>
            <br />
            잃을 것은 없고, 얻을 것은 당신의 미래입니다.
          </p>

          <CtaButton />

          {errorMessage && (
            <div className="max-w-sm mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-shake">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-200 font-mono leading-tight">{errorMessage}</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════ */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-neon-lime" />
            <span className="text-sm font-display font-bold tracking-tight">
              SECRET <span className="text-neon-lime">COACH</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <a
              className="hover:text-neon-lime transition-colors"
              href="/terms"
              target="_blank"
              rel="noreferrer"
            >
              이용약관
            </a>
            <span className="opacity-30">|</span>
            <a
              className="hover:text-neon-lime transition-colors"
              href="/privacy"
              target="_blank"
              rel="noreferrer"
            >
              개인정보처리방침
            </a>
            <span className="opacity-30">|</span>
            <a
              className="hover:text-neon-lime transition-colors"
              href="/refund"
              target="_blank"
              rel="noreferrer"
            >
              환불정책
            </a>
          </div>

          <button
            onClick={() => setShowSetupGuide(true)}
            className="text-[10px] font-bold text-gray-700 hover:text-neon-lime flex items-center gap-1.5 transition-colors"
          >
            <Settings size={12} /> 도메인 설정
          </button>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════
          SETUP GUIDE MODAL (kept from original)
          ═══════════════════════════════════════════════ */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#0a0a10] border border-white/10 rounded-[40px] p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-neon-lime/10 rounded-2xl">
                <HelpCircle className="text-neon-lime" size={24} />
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                className="text-gray-500 hover:text-white"
              >
                <Settings size={20} />
              </button>
            </div>

            <h3 className="text-xl font-display font-bold">인증 도메인 가이드</h3>

            <div className="space-y-4 bg-white/5 p-5 rounded-2xl">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Origin not allowed 오류가 나오면 아래 주소를 Firebase Console 인증 도메인에
                추가하세요.
              </p>
              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  복사할 주소
                </p>
                <code className="block bg-black p-3 rounded text-neon-lime font-mono text-xs overflow-x-auto whitespace-nowrap">
                  {window.location.origin}
                </code>
              </div>
            </div>

            <button
              onClick={() => setShowSetupGuide(false)}
              className="w-full py-4 bg-neon-lime text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all"
            >
              확인 완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
