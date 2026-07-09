// ============================================================
// Yene QR — 404 Not Found page
// Marked force-dynamic to avoid prerendering the page during
// `next build`. The root layout's ThemeProvider (next-themes)
// calls useContext during static export of _not-found, which
// throws "Cannot read properties of null (reading 'useContext')"
// and aborts the build. Skipping static generation sidesteps
// that without changing runtime behavior.
// ============================================================
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        color: '#111827',
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>404</h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            background: '#3b82f6',
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
