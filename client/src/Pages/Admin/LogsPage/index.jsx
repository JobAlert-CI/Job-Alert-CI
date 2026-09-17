import { AnimatePresence, motion } from "framer-motion"
import { FileClock, Mail, MessageSquare, Terminal } from "lucide-react"
import { useFiltresLogsAdmin, FiltresLogsAdminProvider } from "@/contexts/FiltresLogsAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletEvents from "./onglets/OngletEvents"
import OngletContacts from "./onglets/OngletContacts"
import OngletEmailsTx from "./onglets/OngletEmailsTx"
import HeroAdmin from "@/components/admin/HeroAdmin"
import Bloc, { VARIANTS_PAGE, VARIANTS_PANNEAU } from "@/components/admin/Bloc"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────
   Page Logs & emails — /admin/logs (super_admin, doc v3 §17).
   Journal des erreurs & emails transactionnels, diagnostic technique
   transverse : 3 onglets synchronisés à l'URL (param `onglet`).
   Chaque onglet porte ses compteurs + charts, son TRI PAR EN-TÊTE
   initialisé et son retour en haut du tableau au changement de page.
   Refonte : repère visuel de défilement des onglets sur mobile
   (fondu droit), transitions uniformes entre les vues.
   ───────────────────────────────────────────────────────────────────── */
const ONGLETS = [
  { valeur: "events", libelle: "Événements techniques", Icone: Terminal },
  { valeur: "contacts", libelle: "Messages de contact", Icone: MessageSquare },
  { valeur: "emails", libelle: "Emails transactionnels", Icone: Mail },
]

const LogsAdmin = () => {
  const { onglet, setOnglet } = useFiltresLogsAdmin()
  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Journal des erreurs & emails transactionnels"
        description="Diagnostic technique transverse — incidents de scraping, boîte de réception du site public et suivi des emails transactionnels (inscriptions, désinscriptions)."
        icon={FileClock}
        titleBdge="Contenu & sécurité"
      />

      {/* ─── Onglets (synchronisés URL) ─── */}
      <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
        <div className="relative">
          <TabsList
            className={cn(
              "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-muted/20 p-1",
              "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            )}
          >
            {ONGLETS.map(({ valeur, libelle, Icone }) => (
              <TabsTrigger
                key={valeur}
                value={valeur}
                className={cn(
                  "gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                  onglet === valeur
                    ? "bg-brand-orange text-brand-navy shadow-soft" /* navy sur orange : 6.3:1 AA */
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <Icone className="size-3.5" aria-hidden="true" />
                {libelle}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Repère de défilement mobile : fondu sur le bord droit,
              indique que la barre d'onglets peut défiler. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-lg bg-linear-to-l from-surface-container-lowest to-transparent lg:hidden"
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={onglet}
            role="tabpanel"
            aria-label={ONGLETS.find((o) => o.valeur === onglet)?.libelle}
            variants={VARIANTS_PANNEAU}
            initial="cache"
            animate="visible"
            exit="cache"
            className="mt-4"
          >
            {onglet === "events" ? (
              <Bloc>
                <OngletEvents />
              </Bloc>
            ) : onglet === "contacts" ? (
              <Bloc>
                <OngletContacts />
              </Bloc>
            ) : (
              <Bloc>
                <OngletEmailsTx />
              </Bloc>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  )
}

const PageLogs = () => (
  <FiltresLogsAdminProvider>
    <LogsAdmin />
  </FiltresLogsAdminProvider>
)

export default PageLogs