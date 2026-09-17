import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChartArea, FileDown, LayoutDashboard, Loader2, Users } from "lucide-react"
import { cn } from "cn"
import { FiltresAbonnesAdminProvider, useFiltresAbonnesAdmin } from "@/contexts/FiltresAbonnesAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurAbonne } from "@/features/admin-abonnes.tools"
import OngletPilotage from "./onglets/OngletPilotage"
import OngletStats from "./onglets/OngletStats"
import CompteursAbonnes from "./sections/CompteursAbonnes"
import Bloc, { VARIANTS_PAGE, VARIANTS_PANNEAU } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des abonnés — /admin/utilisateurs.
   super_admin + gestionnaire_utilisateurs (guard par route).
   DEUX onglets synchronisés à l'URL (pattern page IA) :
   - Pilotage      : filtres, sélection multiple, table, anonymisation ;
   - Statistiques  : compteurs/KPI + charts (recharts confiné au chunk
                     lazy de la page).
   Le hero (titre + export) reste au-dessus des onglets, toujours
   visible. Chaque onglet porte son ErrorBoundary dédié.
───────────────────────────────────────────────────────────────────── */

const ONGLETS = [
  { valeur: "pilotage", libelle: "Pilotage", Icone: LayoutDashboard },
  { valeur: "statistiques", libelle: "Statistiques", Icone: ChartArea },
]

const AbonnesAdmin = () => {
  const notify = useNotify()
  const { onglet, setOnglet, paramsApi } = useFiltresAbonnesAdmin()
  const [exportEnCours, setExportEnCours] = useState(false)

  const lancerExport = async (format) => {
    setExportEnCours(true)
    try {
      const { exportSubscribers } = await import("@/api/admin/system")
      const { blob, filename } = await exportSubscribers(
        { q: paramsApi.q, status: paramsApi.status, filiere_id: paramsApi.filiere_id },
        format
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      notify(`Export ${format.toUpperCase()} téléchargé (${filename})`, "success")
    } catch (err) {
      notify(messageErreurAbonne(err) || "Export impossible", "error")
    } finally {
      setExportEnCours(false)
    }
  }

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête + export (toujours visible au-dessus des onglets) ─── */}
      <Bloc>
        <HeroAdmin
          title="Gestion des abonnés"
          titleBdge="Métier"
          icon={Users}
          description="Inscriptions, pauses, rebonds et anonymisation — le fichier abonnés du service."
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <BtnAction size="sm" variant="secondary" disabled={exportEnCours}>
                  {exportEnCours ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" className="size-4" />}
                  Exporter
                </BtnAction>
              }
            />
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Format</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => lancerExport("csv")} className="cursor-pointer">CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => lancerExport("json")} className="cursor-pointer">JSON</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </HeroAdmin>
      </Bloc>

      <Bloc>
        <CompteursAbonnes />
      </Bloc>

      {/* ─── Onglets Pilotage / Statistiques ─── */}
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
            {onglet === "pilotage" ? (
              <Bloc>
                <OngletPilotage />
              </Bloc>
            ) : (
              <Bloc>
                <OngletStats />
              </Bloc>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  )
}

const AbonnesPage = () => (
  <FiltresAbonnesAdminProvider>
    <AbonnesAdmin />
  </FiltresAbonnesAdminProvider>
)

export default AbonnesPage