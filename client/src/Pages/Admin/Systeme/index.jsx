import { motion, AnimatePresence } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import {
  CalendarCog, CalendarFold, CircleCheck, CircleX, HeartPulse, Loader2,
  RefreshCw, TriangleAlert,
} from "lucide-react"
import { cn } from "cn"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import { useNotify } from "@/contexts/Notify.context"
import { adminSystemeKeys, useSystemeSanteQuery } from "@/features/admin-systeme.tools"
import { FiltresSystemeProvider, useFiltresSysteme } from "@/contexts/FiltresSysteme.context"
import OngletSante from "./sections/OngletSante"
import OngletEvenements from "./sections/OngletEvenements"
import OngletPlanification from "./sections/OngletPlanification"
import Bloc, { VARIANTS_PAGE, VARIANTS_PANNEAU } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Santé du système — /admin/systeme (super_admin, doc v3 §20).
  Point de vérité unique pour savoir si l'infrastructure tourne :
  « aucun email envoyé ce matin » se diagnostique ici sans SSH.   
───────────────────────────────────────────────────────────────────── */

const ONGLETS = [
  { valeur: "sante", libelle: "Santé", Icone: HeartPulse },
  { valeur: "evenements", libelle: "Événements système", Icone: CalendarCog },
  { valeur: "planification", libelle: "Planification", Icone: CalendarFold },
]

const OVERALL = {
  ok: {
    titre: "Système opérationnel",
    texte: "Tous les indicateurs sont au vert.",
    classe: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
  },
  degraded: {
    titre: "Système dégradé",
    texte:
      "Le site fonctionne, mais au moins un service d'arrière-plan ou un fournisseur externe (email Resend, IA) est en difficulté — workers Celery injoignables dans le délai, broker Redis down, échec d'envoi récent ou toutes les clés IA en cooldown. Les emails programmés peuvent être retardés.",
    classe: "border-amber-500/30 bg-amber-500/5 text-amber-700",
  },
  error: {
    titre: "Système en erreur",
    texte: "La base de données est injoignable — le site ne peut pas fonctionner normalement.",
    classe: "border-destructive/40 bg-destructive/10 text-destructive",
  },
}

const IconeStatut = ({ statut }) =>
  statut === "ok" ? (
    <CircleCheck className="size-3 text-emerald-600" aria-hidden="true" />
  ) : statut === "error" ? (
    <CircleX className="size-3 text-destructive" aria-hidden="true" />
  ) : (
    <TriangleAlert
      className={cn("size-3", statut === "disabled" ? "text-muted-foreground" : "text-amber-600")}
      aria-hidden="true"
    />
  )

const SystemeAdmin = () => {
  const queryClient = useQueryClient()
  const notify = useNotify()
  const { onglet, setOnglet } = useFiltresSysteme()
  const { data: sante, isFetching } = useSystemeSanteQuery()

  const verifier = () => {
    queryClient.invalidateQueries({ queryKey: adminSystemeKeys.sante })
    notify("Vérification en cours (inspection Celery ~2 s)…", "info", 3000)
  }

  const overall = OVERALL[sante?.overall_status] ?? OVERALL.degraded
  const chargement = !sante && isFetching

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        {/* ─── En-tête : statut global + vérification manuelle ─── */}
        <HeroAdmin
          title="Santé du système"
          titleBdge="Supervision"
          icon={HeartPulse}
          description="Base de données, workers Celery, files d'attente, fournisseurs email et IA — le point de vérité pour diagnostiquer sans SSH."
          badges={
            chargement ? (
              <Skeleton className="h-6 w-48 rounded-full" />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "flex cursor-default items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold",
                      overall.classe
                    )}
                  >
                    <IconeStatut
                      statut={sante?.overall_status === "ok" ? "ok" : sante?.overall_status === "error" ? "error" : "warning"}
                    />
                    {overall.titre}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-72 text-xs">{overall.texte}</TooltipContent>
              </Tooltip>
            )
          }
        >
          <BtnAction size="sm" onClick={verifier} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {isFetching ? "Vérification…" : "Vérifier maintenant"}
          </BtnAction>
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
                  ? "bg-brand-orange font-bold text-brand-navy shadow-soft" /* navy sur orange : 6.3:1 AA */
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
            {onglet === "sante" ? (
              <Bloc>
                <OngletSante />
              </Bloc>
            ) : onglet === "evenements" ? (
              <Bloc>
                <OngletEvenements />
              </Bloc>
            ) : (
              <Bloc>
                <OngletPlanification />
              </Bloc>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  )
}

const PageSysteme = () => (
  <FiltresSystemeProvider>
    <SystemeAdmin />
  </FiltresSystemeProvider>
)

export default PageSysteme