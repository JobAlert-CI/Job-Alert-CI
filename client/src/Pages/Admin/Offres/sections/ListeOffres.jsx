import { useState } from "react"
import { Link } from "react-router-dom"
import { Copy } from "lucide-react"
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
import BarreFiltres from "../components/BarreFiltres"
import TableOffres from "../components/TableOffres"
import DialogImport from "../components/DialogImport"
import ApercuOffre from "@/components/admin/ApercuOffre"

/* ─────────────────────────────────────────────────────────────────────
   Section Liste — cœur de la page Offres.

   Centralise : requête filtrée + pagination + sélection multiple +
   actions groupées (POST /bulk-status, max 500 IDs) + badge doublons
   (GET /duplicates/candidates) + déclenchement import/export.

   Pagination : la réponse est une liste plate SANS total → boutons
   Précédent/Suivant avec heuristique (page suivante possible si
   len == limite), pas de numérotation inventée.
   ───────────────────────────────────────────────────────────────────── */

const ListeOffres = () => {
  const { paramsApi, page, pageTaille, setPage, reinitialiser } = useFiltresOffresAdmin()
  const notify = useNotify()

  const [selection, setSelection] = useState(() => new Set())
  const [importOuvert, setImportOuvert] = useState(false)
  const [exportEnCours, setExportEnCours] = useState(false)
  const [apercuOffreId, setApercuOffreId] = useState(null)

  const { data: offres, isLoading, isError, refetch } = useAdminOffersQuery(paramsApi)

  // Compteurs : total/actives lus dans le cache overview (queryKey
  // partagé avec le dashboard → zéro appel réseau si déjà visité),
  // brutes via un appel dédié, doublons déjà chargés pour le badge.
  const { data: overview, isLoading: overviewCharge } = useAdminOverviewQuery()
  const { data: brutes } = useCompteOffresBrutes()

  // Badge doublons : candidates au seuil par défaut 80 (défaut serveur).
  const { data: doublons } = useAdminDoublonsQuery({ min_similarity: 80 })

  const groupeeMutation = useActionGroupee()

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

  const actionGroupee = (status) => {
    if (!selection.size) return
    groupeeMutation.mutate(
      { offerIds: [...selection], status },
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
    <section aria-label="Liste des offres" className="flex flex-col gap-4">
      {/* En-tête + badge doublons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-bold">Offres</h1>
        {(doublons?.length ?? 0) > 0 && (
          <Link to="/admin/offres/doublons">
            <Badge variant="destructive" className="cursor-pointer gap-1 py-1 pl-2">
              <Copy className="size-3" aria-hidden />
              {doublons.length} doublon{doublons.length > 1 ? "s" : ""} potentiel{doublons.length > 1 ? "s" : ""} à vérifier
            </Badge>
          </Link>
        )}
      </div>

      {/* Compteurs : total/actives depuis le cache overview partagé,
          brutes et doublons via leurs requêtes dédiées. Clic = filtre
          pré-appliqué sur la liste. */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CarteCompteur
          label="Offres totales"
          valeur={overview?.offers_total}
          chargement={overviewCharge}
        />
        <CarteCompteur
          label="Actives"
          valeur={overview?.offers_active}
          chargement={overviewCharge}
          href="/admin/offres"
          query="?status=active"
        />
        <CarteCompteur
          label="Brutes (à traiter)"
          valeur={brutes?.total ?? 0}
          texte={brutes?.plafonne ? "100+" : undefined}
          href="/admin/offres"
          query="?status=brut"
        />
        <CarteCompteur
          label="Doublons potentiels"
          valeur={doublons?.length ?? 0}
          href="/admin/offres/doublons"
        />
      </div>

      <BarreFiltres
        onImport={() => setImportOuvert(true)}
        onExport={lancerExport}
        exportEnCours={exportEnCours}
      />

      {/* Barre actions groupées (visible seulement avec sélection) */}
      {selection.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-semibold">
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
      )}

      {/* Table (props de sélection injectées) */}
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

      {/* Pagination mutualisée (liste plate sans total) */}
      <PaginationListe
        page={page}
        pagePleine={pageSuivantePossible}
        onPageChange={setPage}
      />

      <DialogImport ouvert={importOuvert} onFermer={() => setImportOuvert(false)} />

      {/* Aperçu rapide (Sheet latéral, un seul montage — l'ID change) */}
      <ApercuOffre
        ouvert={!!apercuOffreId}
        onOpenChange={(o) => !o && setApercuOffreId(null)}
        offerId={apercuOffreId}
      />
    </section>
  )
}

export default ListeOffres
