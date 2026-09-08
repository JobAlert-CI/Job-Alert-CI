import { ErrorBoundary } from "react-error-boundary"
import { FileClock } from "lucide-react"
import { useFiltresLogsAdmin, FiltresLogsAdminProvider } from "@/contexts/FiltresLogsAdmin.context"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletEvents from "./sections/OngletEvents"
import OngletContacts from "./sections/OngletContacts"
import OngletEmailsTx from "./sections/OngletEmailsTx"

/* ─────────────────────────────────────────────────────────────────────
   Page Logs & emails — /admin/logs (super_admin, doc v3 §17).

   Journal des erreurs & emails transactionnels, diagnostic technique
   transverse : 3 onglets synchronisés à l'URL (param `onglet`) :
   - Événements techniques (ingestion scraping, niveaux info/warning/error) ;
   - Messages de contact (boîte de réception du site public, statuts
     changés inline, spam assignable depuis le cycle 17) ;
   - Emails transactionnels (6 motifs, recherche destinataire ilike,
     badge « échecs aujourd'hui » — signal opérationnel Resend).

   Chaque onglet porte ses compteurs + charts (sélection validée
   cycle 17 : E1-E6, C1-C5, M1-M6) et son ErrorBoundary. Les listes
   sont plates sans total → pagination heuristique honnête.
   ───────────────────────────────────────────────────────────────────── */

const LogsAdmin = () => {
  const { onglet, setOnglet } = useFiltresLogsAdmin()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ─── En-tête ─── */}
      <section aria-label="En-tête logs" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
            <FileClock className="size-5 text-primary" aria-hidden />
            Journal des erreurs & emails transactionnels
          </h1>
          <p className="text-xs text-muted-foreground">
            Diagnostic technique transverse — incidents de scraping, boîte de réception du site public et
            suivi des emails transactionnels (inscriptions, désinscriptions).
          </p>
        </div>
      </section>

      {/* ─── Onglets (synchronisés URL) ─── */}
      <Tabs value={onglet} onValueChange={setOnglet}>
        <TabsList>
          <TabsTrigger value="events">Événements techniques</TabsTrigger>
          <TabsTrigger value="contacts">Messages de contact</TabsTrigger>
          <TabsTrigger value="emails">Emails transactionnels</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletEvents />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletContacts />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <ErrorBoundary FallbackComponent={AdminSectionFallback}>
            <OngletEmailsTx />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const PageLogs = () => (
  <FiltresLogsAdminProvider>
    <LogsAdmin />
  </FiltresLogsAdminProvider>
)

export default PageLogs
