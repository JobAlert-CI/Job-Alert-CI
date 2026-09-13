import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Briefcase, CircleCheckBig, Copy, FileText, Table2 } from "lucide-react"
import { useFiltresOffresAdmin } from "@/contexts/FiltresOffresAdmin.context"
import {
  useAdminOffersQuery, useAdminDoublonsQuery, useActionGroupee, useCompteOffresBrutes,
  messageErreurMutation,
} from "@/features/admin-offres.tools"
import { useAdminOverviewQuery } from "@/features/admin-dashboard.tools"
import { useNotify } from "@/contexts/Notify.context"
import CarteCompteur from "@/components/admin/CarteCompteur"
import PaginationListe from "@/components/admin/PaginationListe"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import BarreFiltres from "../components/BarreFiltres"
import TableOffres from "../components/TableOffres"
import DialogImport from "@/components/dialog/DialogImport"
import ApercuOffre from "@/components/admin/ApercuOffre"
import HeroAdmin from "@/components/admin/HeroAdmin"
import ActionHeroOffre from "../components/ActionHeroOffre"

const VARIANTS_GRILLE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
}
const VARIANTS_BLOC = {
  cache: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
}

const ListeOffres = () => {
  const {
    paramsApi, page, pageTaille, setPage, reinitialiser,
    query, status, origin, visible,
  } = useFiltresOffresAdmin()
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const [selection, setSelection] = useState(() => new Set())
  const [importOuvert, setImportOuvert] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(false)
  const [apercuOffreId, setApercuOffreId] = useState(null)
  const { data: offres, isLoading, isError, isFetching, refetch } = useAdminOffersQuery(paramsApi)

  /* Compteurs : total/actives lus dans le cache overview (queryKey
     partagé avec le dashboard → zéro appel réseau si déjà visité),
     brutes via un appel dédié, doublons déjà chargés pour le badge. */
  const { data: overview, isLoading: overviewCharge } = useAdminOverviewQuery()
  const { data: brutes } = useCompteOffresBrutes()
  const { data: doublons } = useAdminDoublonsQuery({ min_similarity: 80 })
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

  const COMPTEURS = [
    { cle: "total", label: "Offres totales", valeur: overview?.offers_total ?? 0, icone: Briefcase, chargement: overviewCharge },
    { cle: "actives", label: "Actives", valeur: overview?.offers_active ?? 0, icone: CircleCheckBig, chargement: overviewCharge, href: "/admin/offres", query: "?status=active" },
    { cle: "brutes", label: "Brutes (à traiter)", icone: FileText, valeur: brutes?.total ?? 0, texte: brutes?.plafonne ? "100+" : undefined, href: "/admin/offres", query: "?status=brut" },
    { cle: "doublons", label: "Doublons potentiels", icone: Copy, valeur: doublons?.length ?? 0, href: "/admin/offres/doublons" },
  ]

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
    <section aria-label="Liste des offres" className="flex flex-col gap-6">
      {/* ─── En-tête + badge doublons + actions hero ─── */}
      <HeroAdmin
        title="Gestion des offres"
        titleBdge="Métier"
        icon={Briefcase}
        description="Recherche, filtres, visibilité et statuts — toutes les offres, y compris masquées et archivées."
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

      {/* ─── Compteurs cliquables, apparition en cascade ─── */}
      <motion.div
        variants={VARIANTS_GRILLE}
        initial="cache"
        animate="visible"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {COMPTEURS.map(({ cle, label, valeur, icone, texte, href, query }) => (
          <motion.div key={cle} variants={VARIANTS_BLOC}>
            <CarteCompteur
              label={label}
              valeur={valeur}
              texte={texte}
              icone={icone}
              href={href}
              query={query}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Filtres + table + pagination ───
         div ancrage : le changement de page y ramène le haut de la
         carte (scroll-mt-20 = marge sous un éventuel header sticky). */}
      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Liste des offres"
          description="Sélection multiple, actions groupées, visibilité et statut à la volée — tri par colonne."
          icon={Table2}
          contentClassName="p-0 sm:p-0"
        >
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
                        <Button size="sm" disabled={groupeeMutation.isPending}>
                          Action groupée
                        </Button>
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
                  <Button variant="ghost" size="sm" onClick={toutSelectionner}>
                    {selection.size === offres?.length && offres?.length > 0 ? "Tout désélectionner" : "Tout sélectionner (page)"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Fondu enchaîné au changement de filtres / page / état. */}
          <AnimatePresence mode="wait" initial={false}>
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
          </AnimatePresence>
          {/* Pagination mutualisée (liste plate sans total). */}
          <div className="border-t border-border px-4 py-3">
            <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={changerPage} />
          </div>
        </SectionCardAdmin>
      </div>

      <DialogImport ouvert={importOuvert} onFermer={() => setImportOuvert(false)} />
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