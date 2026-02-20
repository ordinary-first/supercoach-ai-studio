import React, { useState, useEffect, useRef } from 'react';
import type { UserProfile } from '../types';
import { loginWithGoogle } from '../services/firebaseService';
import {
  ChevronDown, Chrome, Target, MessageCircle, Sparkles,
  Brain, Zap, Eye, Check, Star, ArrowRight, Shield,
  HelpCircle, Settings, AlertTriangle, Lock,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

// ─── Hooks ───────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCounter(target: number, dur = 2000, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let t0: number;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, dur]);
  return val;
}

// ─── Data ────────────────────────────────────────────────

const PAINS = [
  {
    icon: Brain, title: '구조화 부재',
    desc: '목표가 머릿속에서 둥둥 떠다닙니다. 체계적으로 정리하지 않으면 뇌는 그것을 "해야 할 일"로 인식하지 못합니다.',
  },
  {
    icon: MessageCircle, title: '피드백 부재',
    desc: '혼자서는 궤도를 벗어나도 모릅니다. 방향을 잡아줄 누군가가 없으면 동기는 3일 만에 사라집니다.',
  },
  {
    icon: Eye, title: '동기 소멸',
    desc: '목표를 "느끼지" 못하면 행동하지 않습니다. 추상적인 목표는 뇌의 보상 회로를 활성화하지 못합니다.',
  },
];

const SOLUTIONS = [
  {
    icon: Target, title: 'AI 마인드맵',
    desc: '목표를 시각적 트리로 구조화합니다. 뇌가 "보이는 것"을 더 잘 실행합니다. 하위 목표, 일정, 우선순위를 한눈에.',
    grad: 'from-emerald-500/20',
  },
  {
    icon: Zap, title: '24/7 AI 코치',
    desc: '행동과학 기반 AI가 매일 당신의 진행을 확인하고, 막힐 때 구체적 방향을 잡아줍니다. 새벽 2시에도.',
    grad: 'from-sky-500/20',
  },
  {
    icon: Sparkles, title: '꿈 시각화',
    desc: 'AI가 당신의 목표를 이미지, 영상, 음성으로 변환합니다. 매일 보고 듣고 느끼면, 뇌가 이미 달성한 것처럼 작동합니다.',
    grad: 'from-violet-500/20',
  },
];

const STATS = [
  { value: 2847, suffix: '+', label: '사용자' },
  { value: 15000, suffix: '+', label: '설정된 목표' },
  { value: 87, suffix: '%', label: '목표 달성률' },
];

const REVIEWS = [
  { name: '김민수', role: '스타트업 대표', text: '매일 AI 코치와 대화하면서 목표가 선명해졌습니다. 3개월 만에 매출 200% 성장했어요.', rating: 5 },
  { name: '이서연', role: '프리랜서 디자이너', text: '마인드맵으로 프로젝트를 관리하니 작업 효율이 확 올랐어요. 시각화 기능이 특히 좋습니다.', rating: 5 },
  { name: '박지훈', role: '대학원생', text: '논문 쓰면서 번아웃이 심했는데, AI 코치의 일일 피드백이 정말 도움됐습니다.', rating: 5 },
];

const STEPS = [
  { n: '01', title: '목표를 입력하세요', desc: '마인드맵에 목표를 추가하면 AI가 자동으로 하위 목표를 구조화합니다.' },
  { n: '02', title: 'AI와 대화하세요', desc: '매일 AI 코치와 대화하며 진행 상황을 점검하고 다음 행동을 결정합니다.' },
  { n: '03', title: '성장을 눈으로 보세요', desc: 'AI가 만든 이미지와 영상으로 목표 달성의 미래를 매일 시각화합니다.' },
];

const PLANS = [
  {
    name: 'Explorer', price: '무료', period: '3일 체험',
    features: ['기본 마인드맵', 'AI 채팅 3회/일', '목표 3개', '기본 피드백'],
    cta: '무료 체험 시작', pop: false,
  },
  {
    name: 'Essential', price: '$9.99', period: '/월', badge: '인기', sub: '하루 333원',
    features: ['무제한 마인드맵', '무제한 AI 채팅', '일일·주간 피드백', '기본 시각화', '목표 무제한'],
    cta: 'Essential 시작하기', pop: true,
  },
  {
    name: 'Visionary', price: '$19.99', period: '/월',
    features: ['Essential 전체 기능', 'AI 이미지 생성', 'AI 영상 생성', 'AI 음성 생성', '고급 분석 리포트'],
    cta: 'Visionary 시작하기', pop: false,
  },
];

const FAQS = [
  { q: '다른 목표 앱과 뭐가 다른가요?', a: 'AI 마인드맵 + AI 코칭 + 꿈 시각화(이미지/영상/음성)를 결합한 앱은 Secret Coach가 유일합니다. 단순 할 일 목록이 아니라, 뇌과학에 기반한 목표 달성 시스템입니다.' },
  { q: 'AI 코칭이 진짜 효과 있나요?', a: '행동과학 연구에 따르면, 정기적인 피드백과 시각화는 목표 달성 확률을 42% 높입니다. Secret Coach는 이 원리를 AI로 자동화하여 매일 실행합니다.' },
  { q: '가격이 부담되지 않나요?', a: 'Essential 플랜은 하루 333원입니다. 커피 한 잔보다 저렴한 가격으로 24시간 개인 AI 코치를 고용하는 셈입니다. 3일 무료 체험으로 먼저 경험해보세요.' },
  { q: '나중에 시작해도 되지 않나요?', a: '"나중에"는 오지 않습니다. 지금 시작하지 않으면 6개월 후에도 같은 자리에 있을 확률이 높습니다. 3일 무료 체험은 위험이 제로입니다.' },
  { q: '개인정보는 안전한가요?', a: 'Google Firebase 인증을 사용하며, 모든 데이터는 암호화되어 저장됩니다. 당신의 목표 데이터는 본인만 접근할 수 있습니다.' },
];

// ─── Constellation nodes for ambient background ──────────

const NODES = [
  { l: '12%', t: '15%', s: 5, d: '0s', dur: '7s' },
  { l: '83%', t: '10%', s: 3, d: '1.5s', dur: '9s' },
  { l: '7%', t: '52%', s: 4, d: '0.5s', dur: '6s' },
  { l: '76%', t: '45%', s: 7, d: '2s', dur: '8s' },
  { l: '48%', t: '25%', s: 3, d: '3s', dur: '10s' },
  { l: '91%', t: '70%', s: 4, d: '1s', dur: '7s' },
  { l: '24%', t: '78%', s: 3, d: '2.5s', dur: '8s' },
];

// ─── Sub-components ──────────────────────────────────────

const Anim: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {children}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

const LandingPage: React.FC<LandingPageProps> = () => {
  const { t } = useTranslation();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sv = useInView(0.3);
  const c0 = useCounter(STATS[0].value, 2000, sv.visible);
  const c1 = useCounter(STATS[1].value, 2500, sv.visible);
  const c2 = useCounter(STATS[2].value, 1500, sv.visible);
  const counts = [c0, c1, c2];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fn = () => setScrolled(el.scrollTop > 60);
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, []);

  const login = async () => {
    setErrorMessage(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.landing.loginError;
      setErrorMessage(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const toTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div ref={scrollRef} className="fixed inset-0 bg-deep-space text-white overflow-y-auto overflow-x-hidden font-body scroll-smooth">

      {/* ═══ Ambient Background ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[#CCFF00]/[0.04] blur-[150px]" />
        <div className="absolute bottom-[8%] right-[8%] w-[400px] h-[400px] rounded-full bg-sky-500/[0.03] blur-[120px]" />
        {NODES.map((n, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#CCFF00]/30 animate-float"
            style={{
              left: n.l, top: n.t, width: n.s, height: n.s,
              animationDelay: n.d, animationDuration: n.dur,
              boxShadow: `0 0 ${n.s * 4}px rgba(204,255,0,0.2)`,
            }}
          />
        ))}
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* ═══ Nav ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-deep-space/80 backdrop-blur-xl border-b border-white/5' : ''
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={toTop} className="flex items-center gap-1.5">
            <span className="text-lg font-display font-black tracking-tighter">
              SUPER<span className="text-[#CCFF00]">COACH</span>
            </span>
          </button>
          <button
            onClick={login}
            disabled={isLoggingIn}
            className="px-5 py-2.5 bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#CCFF00] hover:text-black transition-all duration-300"
          >
            시작하기
          </button>
        </div>
      </nav>

      {/* ═══ 1. Hero ═══ */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <Anim>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              2,847명이 이미 시작했습니다
            </div>
          </Anim>

          <Anim delay={150}>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-extrabold leading-[1.1] tracking-tight mb-6">
              목표만 세우고
              <br />
              실행 못 하는 당신,
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(to right, #CCFF00, #34D399)' }}
              >
                원래 그런 게 아닙니다
              </span>
            </h1>
          </Anim>

          <Anim delay={300}>
            <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
              AI 코치가 당신의 목표를 구조화하고,
              <br className="hidden sm:block" />
              매일 코칭하고, 꿈을 눈으로 보여줍니다.
            </p>
          </Anim>

          <Anim delay={450}>
            <button
              onClick={login}
              disabled={isLoggingIn}
              className="group px-8 py-4 bg-[#CCFF00] text-black font-bold text-sm uppercase tracking-widest rounded-full hover:shadow-[0_0_40px_rgba(204,255,0,0.3)] transition-all duration-300 active:scale-95 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <span className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  접속 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  3일 무료로 시작하기
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
            <p className="text-[11px] text-gray-600 mt-4 flex items-center justify-center gap-1.5">
              <Lock size={10} /> 신용카드 필요 없음 · 3분이면 완료
            </p>
          </Anim>

          {errorMessage && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 max-w-md mx-auto animate-shake">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 leading-tight text-left">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30 animate-bounce">
          <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500">Scroll</span>
          <ChevronDown size={14} className="text-gray-500" />
        </div>
      </section>

      {/* ═══ 2. Pain Points ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Anim>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">
                작심삼일이 반복되는 <span className="text-[#CCFF00]">진짜 이유</span>
              </h2>
              <p className="text-gray-500 text-sm">의지력의 문제가 아닙니다. 시스템의 문제입니다.</p>
            </div>
          </Anim>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PAINS.map((p, i) => (
              <Anim key={i} delay={i * 120}>
                <div className="group p-7 rounded-3xl bg-white/[0.03] border border-white/[0.06] hover:border-red-500/20 transition-all duration-500 h-full">
                  <div className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
                    <p.icon size={20} className="text-red-400" />
                  </div>
                  <h3 className="text-lg font-heading font-bold mb-3">{p.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{p.desc}</p>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. Solution ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Anim>
            <div className="text-center mb-16">
              <p className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest mb-3">Solution</p>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold">
                Secret Coach의 3가지 무기
              </h2>
            </div>
          </Anim>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SOLUTIONS.map((s, i) => (
              <Anim key={i} delay={i * 120}>
                <div className="group relative p-7 rounded-3xl bg-white/[0.03] border border-white/[0.06] hover:border-[#CCFF00]/20 transition-all duration-500 overflow-hidden h-full">
                  <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${s.grad} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative z-10">
                    <div className="w-11 h-11 rounded-2xl bg-[#CCFF00]/10 flex items-center justify-center mb-5">
                      <s.icon size={20} className="text-[#CCFF00]" />
                    </div>
                    <h3 className="text-lg font-heading font-bold mb-3">{s.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. Social Proof ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div ref={sv.ref} className="grid grid-cols-3 gap-4 mb-20">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-5xl font-heading font-extrabold text-[#CCFF00]">
                  {counts[i].toLocaleString()}{s.suffix}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          <Anim>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-center mb-12">
              사용자들의 이야기
            </h2>
          </Anim>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <Anim key={i} delay={i * 120}>
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.06] h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: r.rating }).map((_, j) => (
                      <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed flex-1 mb-5">&ldquo;{r.text}&rdquo;</p>
                  <div>
                    <p className="text-sm font-bold">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.role}</p>
                  </div>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. How It Works ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <Anim>
            <div className="text-center mb-16">
              <p className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold">3분이면 충분합니다</h2>
            </div>
          </Anim>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* 연결선 (데스크톱만) */}
            <div className="hidden md:block absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-[2px] bg-gradient-to-r from-[#CCFF00]/20 via-[#CCFF00]/10 to-[#CCFF00]/20" />
            {STEPS.map((s, i) => (
              <Anim key={i} delay={i * 150}>
                <div className="text-center relative z-10">
                  <div className="w-14 h-14 rounded-full border-2 border-[#CCFF00]/30 bg-deep-space flex items-center justify-center mx-auto mb-5">
                    <span className="text-lg font-heading font-bold text-[#CCFF00]">{s.n}</span>
                  </div>
                  <h3 className="text-lg font-heading font-bold mb-3">{s.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. Pricing ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Anim>
            <div className="text-center mb-16">
              <p className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-3xl sm:text-4xl font-heading font-bold">당신에게 맞는 플랜</h2>
            </div>
          </Anim>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {PLANS.map((p, i) => (
              <Anim key={i} delay={i * 120}>
                <div className={`relative p-7 rounded-3xl border transition-all duration-500 ${
                  p.pop
                    ? 'bg-[#CCFF00]/[0.05] border-[#CCFF00]/30 shadow-[0_0_60px_rgba(204,255,0,0.06)]'
                    : 'bg-white/[0.03] border-white/[0.06]'
                }`}>
                  {p.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#CCFF00] text-black text-[10px] font-bold uppercase tracking-widest rounded-full">
                      {p.badge}
                    </div>
                  )}
                  <h3 className="text-lg font-heading font-bold mb-1">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-heading font-extrabold">{p.price}</span>
                    <span className="text-sm text-gray-500">{p.period}</span>
                  </div>
                  {'sub' in p && p.sub ? (
                    <p className="text-xs text-[#CCFF00]/70 mb-5">{p.sub}</p>
                  ) : (
                    <div className="mb-5" />
                  )}
                  <ul className="space-y-3 mb-7">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-gray-300">
                        <Check size={14} className={p.pop ? 'text-[#CCFF00]' : 'text-gray-500'} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={login}
                    disabled={isLoggingIn}
                    className={`w-full py-3.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                      p.pop
                        ? 'bg-[#CCFF00] text-black hover:shadow-[0_0_30px_rgba(204,255,0,0.3)]'
                        : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {p.cta}
                  </button>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. FAQ ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-2xl mx-auto">
          <Anim>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-12">
              자주 묻는 질문
            </h2>
          </Anim>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <Anim key={i} delay={i * 80}>
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="text-sm font-bold pr-4">{f.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-gray-500 shrink-0 transition-transform duration-300 ${
                        openFaq === i ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      openFaq === i ? 'max-h-48 opacity-100 pb-5' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p className="px-6 text-sm text-gray-400 leading-relaxed">{f.a}</p>
                  </div>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. Final CTA ═══ */}
      <section className="relative py-24 sm:py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Anim>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold leading-tight mb-6">
              6개월 후에도
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(to right, #CCFF00, #34D399)' }}
              >
                같은 자리에 있을 건가요?
              </span>
            </h2>
            <p className="text-gray-400 text-base mb-10">
              지금 시작하세요. 3일 무료, 위험 없습니다.
            </p>
            <button
              onClick={login}
              disabled={isLoggingIn}
              className="group px-10 py-5 bg-[#CCFF00] text-black font-bold text-sm uppercase tracking-widest rounded-full hover:shadow-[0_0_60px_rgba(204,255,0,0.3)] transition-all duration-300 active:scale-95"
            >
              <span className="flex items-center gap-2">
                무료로 시작하기
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Anim>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-display font-bold tracking-tight text-gray-500">
            SUPER<span className="text-[#CCFF00]/50">COACH</span>
          </span>
          <div className="flex items-center gap-4 text-[10px] text-gray-600 uppercase tracking-widest">
            <a href="/terms" target="_blank" rel="noreferrer" className="hover:text-gray-400 transition-colors">Terms</a>
            <span className="opacity-30">·</span>
            <a href="/privacy" target="_blank" rel="noreferrer" className="hover:text-gray-400 transition-colors">Privacy</a>
            <span className="opacity-30">·</span>
            <a href="/refund" target="_blank" rel="noreferrer" className="hover:text-gray-400 transition-colors">Refund</a>
            <span className="opacity-30">·</span>
            <button onClick={() => setShowSetupGuide(true)} className="hover:text-gray-400 transition-colors">Domain</button>
          </div>
          <p className="text-[10px] text-gray-700">© 2025 Secret Coach</p>
        </div>
      </footer>

      {/* ═══ Domain Setup Modal ═══ */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#0a0a10] border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-[#CCFF00]/10 rounded-2xl">
                <HelpCircle className="text-[#CCFF00]" size={24} />
              </div>
              <button onClick={() => setShowSetupGuide(false)} className="text-gray-500 hover:text-white">
                <Settings size={20} />
              </button>
            </div>
            <h3 className="text-xl font-heading font-bold">{t.landing.authDomainGuide}</h3>
            <div className="space-y-4 bg-white/5 p-5 rounded-2xl">
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.landing.authDomainHint}
              </p>
              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.landing.copyAddress}</p>
                <code className="block bg-black p-3 rounded text-[#CCFF00] font-mono text-xs overflow-x-auto whitespace-nowrap">
                  {window.location.origin}
                </code>
              </div>
            </div>
            <button
              onClick={() => setShowSetupGuide(false)}
              className="w-full py-4 bg-[#CCFF00] text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all"
            >
              {t.landing.confirmed}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
