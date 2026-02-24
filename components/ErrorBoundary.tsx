import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getTranslations } from '../i18n/index';
import type { AppLanguage } from '../i18n/types';

interface Props {
  children: ReactNode;
  language?: AppLanguage;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const t = getTranslations(this.props.language || 'ko');
      return (
        <div className="fixed inset-0 bg-th-base flex flex-col items-center justify-center text-th-text font-body p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-4xl">⚠</span>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-wider text-th-text">{t.errorBoundary.title}</h1>
            <p className="text-sm text-th-text-secondary">{t.errorBoundary.message}</p>
            {this.state.error && (
              <div className="bg-th-surface border border-th-border rounded-xl p-4 text-left">
                <p className="text-xs text-red-400 font-mono break-all">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-th-surface border border-th-border rounded-full text-sm font-bold hover:bg-th-surface-hover transition-all"
              >
                {t.errorBoundary.retry}
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-th-accent text-th-text-inverse rounded-full text-sm font-bold hover:shadow-[0_0_20px_var(--shadow-glow)] transition-all"
              >
                {t.errorBoundary.refresh}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
