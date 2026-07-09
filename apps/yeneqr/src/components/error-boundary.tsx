'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that catches rendering errors (like React error #310
 * "Too many re-renders") and displays a recovery UI instead of crashing.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearData = () => {
    // Clear potentially corrupted localStorage data
    try {
      localStorage.removeItem('yeneqr_language');
      localStorage.removeItem('yeneqr_token');
      localStorage.removeItem('yeneqr_user');
      localStorage.removeItem('yeneqr_restaurants');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRenderLoop = this.state.error?.message?.includes('Too many re-renders');

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '480px',
            padding: '2rem',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '24px',
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {isRenderLoop
                ? 'The application encountered a rendering issue. This is usually caused by corrupted browser data. Try clearing app data and reloading.'
                : 'An unexpected error occurred while rendering the page. Please try again.'}
            </p>

            {this.state.error && (
              <details style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <summary style={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  marginBottom: '0.5rem',
                }}>
                  Error details
                </summary>
                <pre style={{
                  fontSize: '0.7rem',
                  color: '#ef4444',
                  background: '#fef2f2',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '120px',
                }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Reload Page
              </button>
              {isRenderLoop && (
                <button
                  onClick={this.handleClearData}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    background: '#fef2f2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Clear Data & Reload
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
