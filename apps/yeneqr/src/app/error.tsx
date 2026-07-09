'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  const isRenderLoop = error?.message?.includes('Too many re-renders');

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
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Application Error
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {isRenderLoop
            ? 'A rendering error occurred. Try clearing browser data and reloading.'
            : 'An unexpected error occurred. Please try again.'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
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
            onClick={() => {
              try {
                localStorage.removeItem('yeneqr_language');
              } catch {}
              window.location.reload();
            }}
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
            Clear Data & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
