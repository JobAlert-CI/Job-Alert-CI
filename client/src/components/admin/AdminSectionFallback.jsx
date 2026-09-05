/* ─────────────────────────────────────────────────────────────────────
   Fallback d'ErrorBoundary par section admin (pattern SectionFallback
   des pages publiques, cf. src/Pages/Offres/index.jsx) : une section
   qui plante n'emporte jamais toute la page.
   ───────────────────────────────────────────────────────────────────── */

const AdminSectionFallback = ({ error, resetErrorBoundary }) => (
  <div
    role="alert"
    className="m-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center"
  >
    <p className="font-bold text-destructive">Une erreur est survenue dans cette section.</p>
    <p className="mt-2 text-sm text-muted-foreground">{error?.message}</p>
    <button
      type="button"
      onClick={resetErrorBoundary}
      className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      Réessayer
    </button>
  </div>
)

export default AdminSectionFallback
