
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { loginWithGoogle, loginAsGuest } from '../services/firebaseService';
import { ShieldCheck, Chrome, AlertTriangle, Settings, HelpCircle, UserX, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      // onAuthStateChanged in App.tsx will handle the profile update
    } catch (e: any) {
      setErrorMessage(e.message || "로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestEntry = () => {
    const guest = loginAsGuest();
    onLoginSuccess(guest as any);
  };

  return (
    <div className="fixed inset-0 bg-[#050B14] flex items-center justify-center font-body text-white overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(204,255,0,0.08)_0%,transparent_70%)]"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        <div className="mb-8 text-center animate-fade-in">
            <h1 className="text-5xl font-display font-black tracking-tighter italic">
                SUPER <span className="text-neon-lime">COACH</span>
            </h1>
            <p className="text-[10px] text-gray-500 tracking-[0.3em] uppercase mt-2 font-bold flex items-center justify-center gap-2">
                <ShieldCheck size={12} className="text-neon-lime" /> Neural Goal Setting System
            </p>
        </div>

        <div className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-1 mb-2">
              <h2 className="text-[10px] font-bold text-neon-lime uppercase tracking-widest">System Authorization</h2>
              <p className="text-[11px] text-gray-400">당신의 비전을 현실로 바꿀 코칭이 시작됩니다.</p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className={`w-full py-5 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50 ${
                  isLoggingIn ? 'bg-gray-800 text-gray-400' : 'bg-white text-black hover:bg-neon-lime hover:shadow-[0_0_20px_rgba(204,255,0,0.3)]'
                }`}
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <Chrome size={20} />
                )}
                {isLoggingIn ? 'Redirecting...' : '구글 계정으로 로그인'}
              </button>

              <button 
                onClick={handleGuestEntry}
                className="w-full py-4 rounded-full font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
              >
                <UserX size={16} />
                게스트 모드로 시작하기
              </button>
            </div>

            {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-shake">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-200 font-mono leading-tight">{errorMessage}</p>
                </div>
            )}

            <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] text-gray-500 text-center leading-relaxed">
                  로그인 시 브라우저가 Google 인증 페이지로 이동합니다.<br/>
                  완료 후 자동으로 다시 돌아오게 됩니다.
                </p>
            </div>
        </div>

        <button 
            onClick={() => setShowSetupGuide(true)}
            className="mt-8 text-[10px] font-bold text-gray-600 hover:text-neon-lime flex items-center justify-center gap-2 uppercase tracking-widest transition-colors"
        >
            <Settings size={14} /> Domain Check
        </button>
      </div>

      {showSetupGuide && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-[#0a0a10] border border-white/10 rounded-[40px] p-8 max-w-md w-full space-y-6 shadow-2xl">
                  <div className="flex justify-between items-start">
                      <div className="p-3 bg-neon-lime/10 rounded-2xl">
                          <HelpCircle className="text-neon-lime" size={24} />
                      </div>
                      <button onClick={() => setShowSetupGuide(false)} className="text-gray-500 hover:text-white">
                          <Settings size={20} />
                      </button>
                  </div>
                  
                  <h3 className="text-xl font-display font-bold">인증 도메인 가이드</h3>
                  
                  <div className="space-y-4 bg-white/5 p-5 rounded-2xl">
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        'Origin not allowed' 에러가 발생한다면, 아래 주소를 Firebase Console의 <b>승인된 도메인</b> 리스트에 추가해야 합니다.
                      </p>
                      <div className="space-y-2">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">복사할 주소</p>
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
