"use client";
export const dynamic = "force-dynamic";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", color: "#1e293b" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#64748b", marginBottom: "1rem" }}>An unexpected error occurred. You can try again, or contact support if the problem persists.</p>
          <pre style={{ background: "#f1f5f9", padding: "0.75rem", borderRadius: "0.375rem", fontSize: "0.8125rem", overflow: "auto", marginBottom: "1rem" }}>
            {error.message}{error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
          <button onClick={reset} style={{ background: "#0f172a", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
