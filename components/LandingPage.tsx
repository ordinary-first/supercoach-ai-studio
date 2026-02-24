import React, { useState } from 'react';
import type { UserProfile } from '../types';
import { loginWithGoogle } from '../services/firebaseService';
import { AlertTriangle, Chrome, HelpCircle, Settings, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

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

  return (
    <div className="fixed inset-0 bg-th-base flex items-center justify-center font-body text-th-text overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.08)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        <div className="mb-8 text-center animate-fade-in">
          <h1 className="text-5xl font-display font-black tracking-tighter italic">
            SUPER <span className="text-th-accent">COACH</span>
          </h1>
          <p className="text-[10px] text-th-text-tertiary tracking-[0.3em] uppercase mt-2 font-bold flex items-center justify-center gap-2">
            <ShieldCheck size={12} className="text-th-accent" /> Neural Goal Setting System
          </p>
        </div>

        <div className="w-full bg-th-surface backdrop-blur-3xl border border-th-border rounded-[40px] p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-[10px] font-bold text-th-accent uppercase tracking-widest">
              System Authorization
            </h2>
            <p className="text-[11px] text-th-text-secondary">
              Google 계정으로 로그인해 목표 데이터를 클라우드에 저장하세요.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full py-5 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50 ${
                isLoggingIn
                  ? 'bg-gray-800 text-th-text-secondary'
                  : 'bg-white text-black hover:bg-th-accent hover:shadow-[0_0_20px_var(--shadow-glow)]'
              }`}
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Chrome size={20} />
              )}
              {isLoggingIn ? 'Redirecting...' : 'Google Login'}
            </button>

            <p className="text-[9px] text-th-text-muted text-center px-4">
              로그인 후 데이터는 계정 기준으로 Firestore/R2에 저장됩니다.
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-shake">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-200 font-mono leading-tight">{errorMessage}</p>
            </div>
          )}

          <div className="pt-4 border-t border-th-border-subtle">
            <p className="text-[9px] text-th-text-tertiary text-center leading-relaxed">
              로그인 시 브라우저는 Firebase 인증 상태를 유지합니다.
              <br />
              사용자 데이터는 로컬이 아닌 백엔드에 저장됩니다.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[9px] font-bold text-th-text-tertiary uppercase tracking-widest">
              <a className="hover:text-th-accent transition-colors" href="/terms" target="_blank" rel="noreferrer">Terms</a>
              <span className="opacity-40">|</span>
              <a className="hover:text-th-accent transition-colors" href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
              <span className="opacity-40">|</span>
              <a className="hover:text-th-accent transition-colors" href="/refund" target="_blank" rel="noreferrer">Refunds</a>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSetupGuide(true)}
          className="mt-8 text-[10px] font-bold text-th-text-muted hover:text-th-accent flex items-center justify-center gap-2 uppercase tracking-widest transition-colors"
        >
          <Settings size={14} /> Domain Check
        </button>
      </div>

      {showSetupGuide && (
        <div className="fixed inset-0 z-[100] bg-th-elevated backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-th-card border border-th-border rounded-[40px] p-8 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-th-accent-muted rounded-2xl">
                <HelpCircle className="text-th-accent" size={24} />
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                className="text-th-text-tertiary hover:text-th-text"
              >
                <Settings size={20} />
              </button>
            </div>

            <h3 className="text-xl font-display font-bold">인증 도메인 가이드</h3>

            <div className="space-y-4 bg-th-surface p-5 rounded-2xl">
              <p className="text-[11px] text-th-text-secondary leading-relaxed">
                Origin not allowed 오류가 나오면 아래 주소를 Firebase Console 인증 도메인에
                추가하세요.
              </p>
              <div className="space-y-2">
                <p className="text-[10px] text-th-text-secondary font-bold uppercase tracking-wider">복사할 주소</p>
                <code className="block bg-th-base p-3 rounded text-th-accent font-mono text-xs overflow-x-auto whitespace-nowrap">
                  {window.location.origin}
                </code>
              </div>
            </div>

            <button
              onClick={() => setShowSetupGuide(false)}
              className="w-full py-4 bg-th-accent text-th-text-inverse rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all"
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
