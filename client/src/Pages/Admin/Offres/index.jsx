
import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FiltresOffresAdminProvider, useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import ListeOffres from "./sections/ListeOffres"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import ActionHeroOffre from "./components/ActionHeroOffre"
import { Briefcase, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import HeroAdmin from "@/components/admin/HeroAdmin"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurMutation, useAdminDoublonsQuery } from "@/features/admin-offres.tools"
import DialogImport from "@/components/dialog/DialogImport"
import CompteursOffres from "./sections/CompteursOffres"

/* ─────────────────────────────────────────────────────────────────────
  Page Gestion des offres — /admin/offres (super_admin +
  gestionnaire_offres ; guard par route dans App.jsx).
  Orchestrateur pur : le contexte de filtres (URL) enveloppe la
  section unique ; les mutations invalident le cache via les hooks
  de features/admin-offres.tools.js.   
───────────────────────────────────────────────────────────────────── */
const Offres = () => {
  const { paramsApi } = useFiltresOffresAdmin()
  const notify = useNotify()

  const [importOuvert, setImportOuvert] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(false)

  const { data: doublons } = useAdminDoublonsQuery({ min_similarity: 80 })

  const lancerExport = async (format) => {
    setExportEnCours(true)
    try {
      const { exportOffers } = await import("@/api/admin/system")
      const { blob, filename } = await exportOffers(
        {
          q: paramsApi.q, status: paramsApi.status, origin: paramsApi.origin,
          visible_site: paramsApi.visible_site, filiere_id: paramsApi.filiere_id,
          source_id: paramsApi.source_id,
        },
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
      notify(messageErreurMutation(err) || "Export impossible", "error")
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
      <Bloc>
        <HeroAdmin
          title="Gestion des offres"
          titleBdge="Métier"
          icon={Briefcase}
          description="Gerer tous les offres du site, des sources externes ou des offres brutes."
          badges={(doublons?.length ?? 0) > 0 && (
            <Link to="/admin/offres/doublons">
              <Badge variant="destructive" className="cursor-pointer gap-1 py-1 pl-2">
                <Copy className="size-3" aria-hidden />
                {doublons?.length} doublon{doublons?.length > 1 ? "s" : ""} potentiel{doublons?.length > 1 ? "s" : ""} à vérifier
              </Badge>
            </Link>
          )}
        >
          <ActionHeroOffre
            onImport={() => setImportOuvert(true)}
            onExport={lancerExport}
            exportEnCours={exportEnCours}
          />
        </HeroAdmin>
      </Bloc>

      <Bloc>
        <CompteursOffres />
      </Bloc>

      <Bloc>
        <ListeOffres />
      </Bloc>

      <DialogImport ouvert={importOuvert} onFermer={() => setImportOuvert(false)} />
    </motion.div>
  )
}

const OffresPage = () => (
  <FiltresOffresAdminProvider>
    <Offres />
  </FiltresOffresAdminProvider>
)

export default OffresPage