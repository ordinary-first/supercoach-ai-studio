import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../../types';
import { loginWithGoogle } from '../../services/firebaseService';
import { StickyNav } from './StickyNav';
import { HeroSection } from './HeroSection';
import { VideoShowcase } from './VideoShowcase';
import { EmpathyNarrativeSection } from './EmpathyNarrativeSection';
import { PsychologyFeaturesSection } from './PsychologyFeaturesSection';
import { MoonStorySection } from './MoonStorySection';
import { FinalCTA } from './FinalCTA';

interface MarketingLandingPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

function MarketingLandingPage({ onLoginSuccess: _onLoginSuccess }: MarketingLandingPageProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const original = {
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
      document.body.style.overflow = original.bodyOverflow;
      document.body.style.position = original.bodyPosition;
      document.body.style.width = original.bodyWidth;
      document.body.style.height = original.bodyHeight;
      document.documentElement.style.position = original.htmlPosition;
      document.documentElement.style.overflow = original.htmlOverflow;
      document.documentElement.style.width = original.htmlWidth;
      document.documentElement.style.height = original.htmlHeight;
    };
  }, []);

  const handleLogin = async (): Promise<void> => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02050b] font-body text-white" style={{ scrollBehavior: 'smooth' }}>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,#03060c_0%,#050b14_35%,#02050b_100%)]" />
        <StickyNav onCTAClick={handleLogin} isLoggingIn={isLoggingIn} />
        <main className="relative z-10">
          <HeroSection onCTAClick={handleLogin} isLoggingIn={isLoggingIn} />
          <VideoShowcase />
          <EmpathyNarrativeSection />
          <PsychologyFeaturesSection />
          <MoonStorySection />
          <FinalCTA onCTAClick={handleLogin} isLoggingIn={isLoggingIn} />
        </main>
      </div>
    </div>
  );
}

export { MarketingLandingPage };
export default MarketingLandingPage;
