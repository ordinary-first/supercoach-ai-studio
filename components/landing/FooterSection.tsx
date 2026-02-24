import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

export const FooterSection: React.FC = () => {
  const appVersion =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
  const { language } = useTranslation();

  return (
    <footer
      className="border-t border-white/10 py-12 px-6"
      style={{ backgroundColor: '#050B14', fontFamily: 'Inter, sans-serif' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

          {/* Product */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Product
            </p>
            <p className="text-xs text-gray-600">{language === 'ko' ? '기능' : 'Features'}</p>
            <p className="text-xs text-gray-600">{language === 'ko' ? '가격' : 'Pricing'}</p>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Legal
            </p>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors duration-150 w-fit"
            >
              Terms
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors duration-150 w-fit"
            >
              Privacy
            </a>
            <a
              href="/refund"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors duration-150 w-fit"
            >
              Refund
            </a>
          </div>

          {/* Copyright */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Company
            </p>
            <p className="text-xs text-gray-600">
              &copy; 2026 Secret Coach. All rights reserved.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-gray-700">
            Built with Neural Precision.
          </p>
          {appVersion && (
            <p className="text-xs text-gray-700">v{appVersion}</p>
          )}
        </div>
      </div>
    </footer>
  );
};

// Prevent TS errors for Vite define global
declare const __APP_VERSION__: string;
