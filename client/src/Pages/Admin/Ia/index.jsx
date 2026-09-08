import { ErrorBoundary } from "react-error-boundary"
import { BrainCircuit } from "lucide-react"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { useFiltresIaAdmin, FiltresIaAdminProvider } from "@/contexts/FiltresIaAdmin.context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletPilotage from "./sections/OngletPilotage"
import OngletStats from "./sections/OngletStats"
import SectionCles from "./sections/SectionCles"
import SectionAlertes from "./sections/SectionAlertes"
import SectionSuggestions from "./sections/SectionSuggestions"

/* ─────────────────────────────────────────────────────────────────────
   Page Normalisation IA — /admin/ia (super_admin, doc v3 §19).

   Le pipeline tourne en autonomie (sweep Celery toutes les 5 min) :
   cette page sert à surveiller et intervenir, pas à faire tourner le
   système.

   DEUX onglets synchronisés à l'URL (décision utilisateur cycle 19 —
   les statistiques vivent dans un onglet à part) :
   - Pilotage : queue + lancement + jobs + clés API + alertes +
     suggestions (chaque section porte son ErrorBoundary) ;
   - Statistiques : compteurs IA1-IA6 + charts C1-C5 (un seul appel
     GET /stats?days=30).
   ───────────────────────────────────────────────────────────────────── */

const IaAdmin = () => {
  const { onglet, setOnglet } = useFiltresIaAdmin()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ─── En-tête ─── */}
      <section aria-label="En-tête normalisation IA" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
            <BrainCircuit className="size-5 text-primary" aria-hidden />
            Normalisation IA
          </h1>
          <p className="text-xs text-muted-foreground">
            Nettoyage et tagging automatiques des offres brutes — la boucle de revue des suggestions de
            filière se ferme ici. Le pipeline tourne seul (sweep toutes les 5 min).
          </p>
        </div>
      </section>

      {/* ─── Onglets (synchronisés URL) ─── */}
      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="pilotage">Pilotage</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="pilotage" className="mt-4 flex flex-col gap-8">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletPilotage />
          </ErrorBoundary>
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <SectionCles />
          </ErrorBoundary>
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <SectionAlertes />
          </ErrorBoundary>
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <SectionSuggestions />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletStats />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const PageIa = () => (
  <FiltresIaAdminProvider>
    <IaAdmin />
  </FiltresIaAdminProvider>
)

export default PageIa
