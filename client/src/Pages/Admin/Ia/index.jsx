import { motion, AnimatePresence } from "framer-motion"
import { BrainCircuit, ChartArea, LayoutDashboard, Loader2, Play, Zap } from "lucide-react"
import { cn } from "cn"
import { useFiltresIaAdmin, FiltresIaAdminProvider } from "@/contexts/FiltresIaAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HeroAdmin from "@/components/admin/HeroAdmin"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurIa, useLancerCycleIa } from "@/features/admin-ia.tools"
import OngletPilotage from "./sections/OngletPilotage"
import OngletStats from "./sections/OngletStats"
import SectionCles from "./sections/SectionCles"
import SectionAlertes from "./sections/SectionAlertes"
import SectionSuggestions from "./sections/SectionSuggestions"
import BtnAction from "@/components/admin/BtnAction"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Normalisation IA — /admin/ia (super_admin, doc v3 §19).
  Le pipeline tourne en AUTONOMIE (sweep Celery toutes les 5 min) :
  cette page sert à surveiller et intervenir, pas à faire tourner.
───────────────────────────────────────────────────────────────────── */

const ONGLETS = [
  { valeur: "pilotage", libelle: "Pilotage", Icone: LayoutDashboard },
  { valeur: "statistiques", libelle: "Statistiques", Icone: ChartArea },
]

const VARIANTS_PANNEAU = {
  cache: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const IaAdmin = () => {
  const { onglet, setOnglet } = useFiltresIaAdmin()
  const notify = useNotify()
  const lancer = useLancerCycleIa()

  const relancer = (force) => {
    lancer.mutate(
      { force },
      {
        onSuccess: () => notify(`Cycle lancé${force ? " (forcé)" : ""} — suivez la file ci-dessous`, "success"),
        onError: (err) => notify(messageErreurIa(err), "error"),
      }
    )
  }

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        <HeroAdmin
          title="Normalisation IA"
          titleBdge="Pilotage"
          description="Nettoyage et tagging automatiques des offres brutes — le pipeline tourne en autonomie toutes les 5 minutes."
          icon={BrainCircuit}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BtnAction size="xs" onClick={() => relancer(false)} disabled={lancer.isPending}>
              {lancer.isPending ? (
                <Loader2 className="animate-spin size-4" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
              Lancer un cycle
            </BtnAction>

            <BtnAction
              size="xs"
              variant="outline"
              onClick={() => relancer(true)}
              disabled={lancer.isPending}
              title="Ignore le garde-fou « scraping récent »"
            >
              <Zap aria-hidden="true" className="size-4" /> Forcer (ignorer le garde-fou)
            </BtnAction>
          </div>
        </HeroAdmin>
      </Bloc>

      <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
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

        {/* ─── Fondu enchaîné entre onglets + cascade des sections ─── */}
        <AnimatePresence mode="wait" initial={false}>
          {onglet === "pilotage" ? (
            <motion.div
              key="pilotage"
              role="tabpanel"
              aria-label="Pilotage du pipeline"
              variants={VARIANTS_PANNEAU}
              initial="cache"
              animate="visible"
              exit="cache"
              className="mt-4 flex flex-col gap-6"
            >
              <Bloc>
                <OngletPilotage />
              </Bloc>
              <Bloc>
                <SectionCles />
              </Bloc>
              <Bloc>
                <SectionAlertes />
              </Bloc>
              <Bloc>
                <SectionSuggestions />
              </Bloc>
            </motion.div>
          ) : (
            <motion.div
              key="statistiques"
              role="tabpanel"
              aria-label="Statistiques du pipeline"
              variants={VARIANTS_PANNEAU}
              initial="cache"
              animate="visible"
              exit="cache"
              className="mt-4"
            >
              <Bloc>
                <OngletStats />
              </Bloc>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </motion.div >
  )
}

const PageIa = () => (
  <FiltresIaAdminProvider>
    <IaAdmin />
  </FiltresIaAdminProvider>
)

export default PageIa