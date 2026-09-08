import { ErrorBoundary } from "react-error-boundary"
import { Settings2, Zap } from "lucide-react"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import CompteursParametres from "./sections/CompteursParametres"
import TableauParametres from "./sections/TableauParametres"

/* ─────────────────────────────────────────────────────────────────────
   Page Paramètres du site — /admin/parametres (super_admin, doc v3 §18).

   Configuration éditable sans déploiement (heure d'envoi, textes,
   coordonnées). Depuis le cycle 18, les valeurs sont CONSOMMÉES au
   runtime (résolveur site_settings → Settings, fallback env) : ce
   qui s'édite ici pilote VRAIMENT le site — confirmation d'email,
   TTL des liens, expéditeur, support, sujet des mails.

   Sections : compteurs P1-P4 (sélection validée) + table groupée à
   édition inline (dirty-tracking, sauvegarde groupée POST /bulk ou
   unitaire PUT /{key} upsert) + dialog création de clé.
   ───────────────────────────────────────────────────────────────────── */

const ParametresAdmin = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    {/* ─── En-tête ─── */}
    <section aria-label="En-tête paramètres" className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Settings2 className="size-5 text-primary" aria-hidden />
          Paramètres du site
        </h1>
        <p className="text-xs text-muted-foreground">
          Configuration éditable sans déploiement — confirmation d'email, expéditeur, support…
        </p>
      </div>
      <p className="flex items-center gap-1.5 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
        <Zap className="size-3.5" aria-hidden />
        Appliqué en direct au site (consommé au runtime)
      </p>
    </section>

    {/* ─── Compteurs P1-P4 ─── */}
    <ErrorBoundary FallbackComponent={AdminSectionFallback}>
      <CompteursParametres />
    </ErrorBoundary>

    {/* ─── Table (recherche, groupes, édition inline, bulk) ─── */}
    <ErrorBoundary FallbackComponent={AdminSectionFallback}>
      <TableauParametres />
    </ErrorBoundary>
  </div>
)

export default ParametresAdmin
