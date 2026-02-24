import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../../types';
import { loginWithGoogle } from '../../services/firebaseService';

import { StickyNav } from './StickyNav';
import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { SolutionSection } from './SolutionSection';
import { FeatureShowcase } from './FeatureShowcase';
import { HowItWorks } from './HowItWorks';
import { VisualizationDemo } from './VisualizationDemo';
import { PricingSection } from './PricingSection';
import { FAQSection } from './FAQSection';
import { FinalCTA } from './FinalCTA';
import { FooterSection } from './FooterSection';

interface MarketingLandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

function MarketingLandingPage({ onLoginSuccess: _onLoginSuccess }: MarketingLandingPageProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 앱의 index.html이 html,body에 position:fixed + overflow:hidden을 설정함.
  // 랜딩 페이지에서는 스크롤이 필요하므로 마운트 시 해제하고 언마운트 시 복원.
  useEffect(() => {
    const orig = {
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyWidth: document.body.style.width,
      bodyHeight: document.body.style.height,
      htmlPosition: document.documentElement.style.position,
      htmlOverflow: document.documentElement.style.overflow,
      htmlWidth: document.documentElement.style.width,
      htmlHeight: document.documentElement.style.height,
    };

    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    document.body.style.width = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.position = 'static';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.width = 'auto';
    document.documentElement.style.height = 'auto';

    return () => {
      document.body.style.overflow = orig.bodyOverflow;
      document.body.style.position = orig.bodyPosition;
      document.body.style.width = orig.bodyWidth;
      document.body.style.height = orig.bodyHeight;
      document.documentElement.style.position = orig.htmlPosition;
      document.documentElement.style.overflow = orig.htmlOverflow;
      document.documentElement.style.width = orig.htmlWidth;
      document.documentElement.style.height = orig.htmlHeight;
    };
  }, []);

  // 로그인 완료는 App.tsx의 useAuth → onAuthStateChanged가 감지함.
  // onLoginSuccess prop은 App.tsx 인터페이스 호환성을 위해 유지.
  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#050B14] text-white font-body"
      style={{ scrollBehavior: 'smooth' }}
    >
      <StickyNav onCTAClick={handleLogin} />
      <HeroSection onCTAClick={handleLogin} />
      <ProblemSection />
      <SolutionSection />
      <FeatureShowcase />
      <HowItWorks />
      <VisualizationDemo />
      <PricingSection onPlanSelect={handleLogin} />
      <FAQSection />
      <FinalCTA onCTAClick={handleLogin} />
      <FooterSection />
    </div>
  );
}

export { MarketingLandingPage };
export default MarketingLandingPage;
