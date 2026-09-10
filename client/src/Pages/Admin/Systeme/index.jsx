import { useState } from "react"
import { Activity } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import OngletSante from "./sections/OngletSante"
import OngletEvenements from "./sections/OngletEvenements"
import OngletPlanification from "./sections/OngletPlanification"

/* ─────────────────────────────────────────────────────────────────────
   Page Santé du système — /admin/systeme (super_admin, doc v3 §20).

   Point de vérité unique pour savoir si l'infrastructure tourne :
   « aucun email envoyé ce matin » se diagnostique ici sans SSH.

   TROIS onglets depuis l'audit 4 (observabilité, Lot 6 / Lot 4) :
   1. Santé          — 7 indicateurs /system/health (dont les VRAIES
                       profondeurs broker LLEN — H.3 — et la santé
                       DÉRIVÉE des fournisseurs email/IA — O.4) ;
   2. Événements      — journal des échecs de tasks /system/events
                       (G.1 : échecs digests, emails, IA, en base,
                       purge 90 j) ;
   3. Planification   — vue lecture seule du beat /system/schedule
                       (F.2 : heures locales/UTC, files, kill-switchs).

   ⚠️ Aucun polling sur toute la page : l'inspection Celery coûte ~2 s
   (doc §20) et le journal système est alimenté par les échecs seulement
   (volume faible par construction). Rafraîchissement manuel partout.
   ───────────────────────────────────────────────────────────────────── */

const PageSysteme = () => {
  const [onglet, setOnglet] = useState("sante")
  // Filtres de l'onglet Événements, remontés ici pour survivre aux
  // changements d'onglet (un TabsContent démonté perdrait son état).
  const [filtresEvenements, setFiltresEvenements] = useState({
    source: "",
    severity: "",
    days: 7,
    page: 1,
  })

  const changerFiltresEvenements = (partiels) =>
    setFiltresEvenements((anciens) => ({ ...anciens, ...partiels }))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
        <Activity className="size-5 text-primary" aria-hidden /> Santé du système
      </h1>

      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList aria-label="Vues du système">
          <TabsTrigger value="sante">Santé</TabsTrigger>
          <TabsTrigger value="evenements">Événements système</TabsTrigger>
          <TabsTrigger value="planification">Planification</TabsTrigger>
        </TabsList>

        <TabsContent value="sante" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletSante />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="evenements" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletEvenements
              source={filtresEvenements.source}
              severity={filtresEvenements.severity}
              days={filtresEvenements.days}
              page={filtresEvenements.page}
              onChangement={changerFiltresEvenements}
            />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="planification" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletPlanification />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PageSysteme
