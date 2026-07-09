// Root page — middleware handles the redirect to /login or /dashboard.
// This page is just a fallback (e.g. if JS is disabled).

export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}
