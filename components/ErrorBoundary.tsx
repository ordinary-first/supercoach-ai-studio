import React, { Component, ErrorInfo, ReactNode } from 'react';
import ko from '../i18n/ko';

interface Props {
  children: ReactNode;
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
      return (
        <div className="fixed inset-0 bg-deep-space flex flex-col items-center justify-center text-white font-body p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-4xl">⚠</span>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-wider text-white">SYSTEM ERROR</h1>
            <p className="text-sm text-gray-400">{ko.error.unexpectedError}</p>
            {this.state.error && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                <p className="text-xs text-red-400 font-mono break-all">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-bold hover:bg-white/10 transition-all"
              >
                {ko.error.retry}
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-neon-lime text-black rounded-full text-sm font-bold hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all"
              >
                {ko.error.refresh}
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
