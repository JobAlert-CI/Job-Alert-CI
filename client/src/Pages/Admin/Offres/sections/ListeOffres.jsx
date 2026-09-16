import { useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Table2 } from "lucide-react"
import { useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import {
  useAdminOffersQuery, useActionGroupee,
  messageErreurMutation,
} from "@/features/admin-offres.tools"
import { useNotify } from "@/contexts/Notify.context"
import PaginationListe from "@/components/admin/PaginationListe"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import BarreFiltres from "../components/BarreFiltres"
import TableOffres from "../components/TableOffres"
import ApercuOffre from "@/components/admin/ApercuOffre"
import BtnAction from "@/components/admin/BtnAction"
import Bloc from "@/components/admin/Bloc"


const ListeOffres = () => {
  const {
    paramsApi, page, pageTaille, setPage, reinitialiser,
    query, status, origin, visible,
  } = useFiltresOffresAdmin()
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const [selection, setSelection] = useState(() => new Set())
  const [apercuOffreId, setApercuOffreId] = useState(null)
  const { data: offres, isLoading, isError, isFetching, refetch } = useAdminOffersQuery(paramsApi)

  const groupeeMutation = useActionGroupee()

  /* Ancrage du retour en haut du tableau au changement de page.
     ⚠️ L'ancien useEffect [page] était doublement défectueux :
     • la ref était posée sur <AnimatePresence> — aucun nœud DOM,
       donc scrollIntoView ne partait jamais ;
     • il se déclenchait aussi au MONTAGE (scroll dès l'arrivée).
     Le handler ci-dessous ne part que sur une vraie action de
     pagination, et coupe le défilement doux en prefers-reduced-motion. */
  const refTableau = useRef(null)
  const changerPage = (nouvellePage) => {
    setPage(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const pageSuivantePossible = Array.isArray(offres) && offres.length === pageTaille

  const basculerSelection = (id) => {
    setSelection((prev) => {
      const suivant = new Set(prev)
      suivant.has(id) ? suivant.delete(id) : suivant.add(id)
      return suivant
    })
  }

  const toutSelectionner = () => {
    setSelection((prev) => {
      if (offres?.length && prev.size === offres.length) return new Set()
      return new Set((offres ?? []).map((o) => o.id))
    })
  }

  const actionGroupee = (statutCible) => {
    if (!selection.size) return
    groupeeMutation.mutate(
      { offerIds: [...selection], status: statutCible },
      {
        onSuccess: (res) => {
          notify(res?.message || `${selection.size} offre(s) mise(s) à jour`, "success")
          setSelection(new Set())
        },
        onError: (err) => notify(messageErreurMutation(err) || "Action groupée impossible", "error"),
      }
    )
  }

  return (
    <section aria-label="Liste des offres" className="flex flex-col gap-6">
      {/* ─── Filtres + table + pagination ───
        div ancrage : le changement de page y ramène le haut de la
        carte (scroll-mt-20 = marge sous un éventuel header sticky). */}
      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Liste des offres"
          description="Voir et modifier les offres du site, des sources externes ou des offres brutes."
          icon={Table2}
          contentClassName="p-0 sm:p-0"
        >
          <Bloc>
            <BarreFiltres chargement={isFetching} />
            {/* Barre d'actions groupées : slide-down + fondu, hauteur animée. */}
            <AnimatePresence initial={false}>
              {selection.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden motion-reduce:transition-none"
                >
                  <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <span className="text-xs font-semibold tabular-nums">
                      {selection.size} offre{selection.size > 1 ? "s" : ""} sélectionnée{selection.size > 1 ? "s" : ""}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <BtnAction size="sm" disabled={groupeeMutation.isPending}>
                            Action groupée
                          </BtnAction>
                        }
                      />
                      <DropdownMenuContent align="start" className="min-w-44">
                        {/* base-ui : label de groupe TOUJOURS dans <DropdownMenuGroup>. */}
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Appliquer à la sélection</DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => actionGroupee("active")} className="cursor-pointer">Marquer actives</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => actionGroupee("archived")} className="cursor-pointer">Archiver</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => actionGroupee("expired")} className="cursor-pointer">Marquer expirées</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelection(new Set())} className="cursor-pointer">
                          Vider la sélection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <BtnAction variant="ghost" size="sm" onClick={toutSelectionner}>
                      {selection.size === offres?.length && offres?.length > 0 ? "Tout désélectionner" : "Tout sélectionner (page)"}
                    </BtnAction>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Fondu enchaîné au changement de filtres / page / état. */}
            <motion.div
              key={`${page}-${query}-${status}-${origin}-${visible}-${isLoading ? "chargement" : "donnees"}-${isError ? "erreur" : "ok"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <TableOffres
                offres={offres}
                chargement={isLoading}
                erreur={isError}
                onRetry={refetch}
                onRetryFiltres={reinitialiser}
                selection={selection}
                onToggleSelection={basculerSelection}
                onToutSelectionner={toutSelectionner}
                toutSelectionne={selection.size === offres?.length && (offres?.length ?? 0) > 0}
                onApercu={setApercuOffreId}
              />
            </motion.div>
            {/* Pagination mutualisée (liste plate sans total). */}
            <div className="border-t border-border px-4 py-3">
              <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={changerPage} />
            </div>
          </Bloc>
        </SectionCardAdmin>
      </div>

      {/* Aperçu rapide (Sheet latéral, un seul montage — l'ID change). */}
      <ApercuOffre
        ouvert={!!apercuOffreId}
        onOpenChange={(o) => !o && setApercuOffreId(null)}
        offerId={apercuOffreId}
      />
    </section>
  )
}

export default ListeOffres