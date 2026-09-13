import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, MoreHorizontal } from "lucide-react"
import { cn } from "cn"
import { useFiltresAbonnesAdmin } from "@/contexts/FiltresAbonnesAdmin.context"
import {
  STATUTS_ABONNE, useAdminSubscribersQuery,
  useChangerStatutAbonne, useAnonymiserAbonne, useActionGroupeeAbonnes, messageErreurAbonne,
} from "@/features/admin-abonnes.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import PaginationListe from "@/components/admin/PaginationListe"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import BarreFiltres from "../components/BarreFiltres"
import DialogConfirmRGPD from "@/components/dialog/DialogConfirmRGPD"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Pilotage — liste des abonnés (doc v3 §7).
   Recherche par email/nom (debouncée → URL), filtres statut/filière,
   sélection multiple + actions groupées, anonymisation RGPD.
   Vocabulaire statut = VOCABULAIRE API : active, unsubscribed,
   bouncing, paused, pending, deleted.
───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  active: "secondary",
  unsubscribed: "outline",
  bouncing: "destructive",
  paused: "outline",
  pending: "outline",
  deleted: "outline",
}

const LIBELLE_STATUT = Object.fromEntries(STATUTS_ABONNE.map((s) => [s.valeur, s.libelle]))

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

const OngletPilotage = () => {
  const notify = useNotify()
  const {
    query, status, filiereId, page, pageTaille, paramsApi, setPage, reinitialiser,
  } = useFiltresAbonnesAdmin()

  const { data: abonnes, isLoading, isError, refetch } = useAdminSubscribersQuery(paramsApi)

  const [anonymCible, setAnonymCible] = useState(null)
  const [selection, setSelection] = useState(() => new Set())

  const statutMutation = useChangerStatutAbonne()
  const anonymiserMutation = useAnonymiserAbonne()
  const groupeeMutation = useActionGroupeeAbonnes()

  const pageSuivantePossible = Array.isArray(abonnes) && abonnes.length === pageTaille

  const changerStatut = (abonne, nouveauStatut) => {
    statutMutation.mutate(
      { subscriberId: abonne.id, status: nouveauStatut },
      {
        onSuccess: (res) => notify(res?.message || `Statut de ${abonne.full_name ?? abonne.email} mis à jour`, "success"),
        onError: (err) => notify(messageErreurAbonne(err) || "Action impossible", "error"),
      }
    )
  }

  const anonymiser = () => {
    if (!anonymCible) return
    anonymiserMutation.mutate(anonymCible.id, {
      onSuccess: () => {
        notify(`${anonymCible.full_name ?? anonymCible.email} anonymisé — historique conservé`, "success")
        setAnonymCible(null)
      },
      onError: (err) => notify(messageErreurAbonne(err) || "Anonymisation impossible", "error"),
    })
  }

  const basculerSelection = (id) => {
    setSelection((prev) => {
      const suivant = new Set(prev)
      suivant.has(id) ? suivant.delete(id) : suivant.add(id)
      return suivant
    })
  }

  const toutSelectionner = () => {
    setSelection((prev) => {
      if (abonnes?.length && prev.size === abonnes.length) return new Set()
      return new Set((abonnes ?? []).map((a) => a.id))
    })
  }

  const actionGroupee = (statut) => {
    if (!selection.size) return
    groupeeMutation.mutate(
      { subscriberIds: [...selection], status: statut },
      {
        onSuccess: (res) => {
          notify(res?.message || `${selection.size} abonné(s) mis à jour`, "success")
          setSelection(new Set())
        },
        onError: (err) => notify(messageErreurAbonne(err) || "Action groupée impossible", "error"),
      }
    )
  }


  return (
    <div>
      {/* ─── Table enveloppée dans SectionCardAdmin ─── */}
      <SectionCardAdmin
        title="Liste des abonnés"
        description="Recherche, filtres par statut et filière, actions rapides par ligne."
        icon={Eye}
        contentClassName="p-0 sm:p-0"
      >
        <div className="flex flex-col gap-4">
          <BarreFiltres />

          {/* ─── Barre actions groupées : slide + fondu ─── */}
          <AnimatePresence initial={false}>
            {selection.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden motion-reduce:transition-none"
              >
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-xs font-semibold tabular-nums">
                    {selection.size} abonné{selection.size > 1 ? "s" : ""} sélectionné{selection.size > 1 ? "s" : ""}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button size="sm" disabled={groupeeMutation.isPending}>Action groupée</Button>}
                    />
                    <DropdownMenuContent align="start" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Appliquer à la sélection</DropdownMenuLabel>
                      </DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => actionGroupee("active")} className="cursor-pointer">Réactiver</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => actionGroupee("paused")} className="cursor-pointer">Mettre en pause</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => actionGroupee("unsubscribed")} className="cursor-pointer">Marquer désinscrits</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => actionGroupee("bouncing")} className="cursor-pointer">Marquer en rebond</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelection(new Set())} className="cursor-pointer">Vider la sélection</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="sm" onClick={toutSelectionner}>
                    {selection.size === abonnes?.length && abonnes?.length > 0 ? "Tout désélectionner" : "Tout sélectionner (page)"}
                  </Button>
                  <p className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
                    L'anonymisation RGPD reste strictement individuelle.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fondu enchaîné au changement de filtres / page / état. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${query}-${status}-${filiereId}-${page}-${isLoading ? "chargement" : "donnees"}-${isError ? "erreur" : "ok"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {isError ? (
                <div className="p-4">
                  <SectionErreur onRetry={refetch} message="Impossible de charger les abonnés." />
                </div>
              ) : isLoading ? (
                <div className="flex flex-col gap-2 p-4" aria-busy="true">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : !abonnes?.length ? (
                <div className="p-4">
                  {query || status || filiereId ? (
                    <SectionAucunResultat message="Aucun abonné ne correspond à ces filtres." onReset={reinitialiser} />
                  ) : (
                    <SectionVide message="Aucun abonné pour le moment." />
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-8">
                            <input
                              type="checkbox"
                              className="size-3.5 accent-primary"
                              checked={!!abonnes?.length && selection.size === abonnes.length}
                              onChange={toutSelectionner}
                              aria-label="Sélectionner tous les abonnés de la page"
                            />
                          </TableHead>
                          <TableHead>Abonné</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="hidden md:table-cell">Filières</TableHead>
                          <TableHead className="hidden lg:table-cell">Inscription</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {abonnes.map((abonne) => {
                          const enCours = statutMutation.isPending && statutMutation.variables?.subscriberId === abonne.id
                          return (
                            <TableRow key={abonne.id} className={cn("transition-colors hover:bg-muted/50", enCours && "opacity-60")}>
                              <TableCell className="pr-0">
                                <input
                                  type="checkbox"
                                  className="size-3.5 accent-primary"
                                  checked={selection.has(abonne.id)}
                                  onChange={() => basculerSelection(abonne.id)}
                                  aria-label={`Sélectionner ${abonne.email}`}
                                />
                              </TableCell>
                              <TableCell className="max-w-56">
                                <Link
                                  to={`/admin/utilisateurs/${abonne.id}`}
                                  className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                  title={abonne.email}
                                >
                                  {abonne.email}
                                </Link>
                                <span className="text-[10px] text-muted-foreground">
                                  {abonne.full_name || "—"}
                                  {abonne.city && ` · ${abonne.city}`}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={VARIANTE_STATUT[abonne.status] ?? "outline"}>
                                  {LIBELLE_STATUT[abonne.status] ?? abonne.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden max-w-40 truncate text-xs text-muted-foreground md:table-cell">
                                {abonne.filiere_links?.length
                                  ? `${abonne.filiere_links.length} filière${abonne.filiere_links.length > 1 ? "s" : ""}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
                                {dateCourte(abonne.subscribed_at ?? abonne.created_at)}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${abonne.email}`}>
                                        <MoreHorizontal aria-hidden="true" />
                                      </Button>
                                    }
                                  />
                                  <DropdownMenuContent align="end" className="min-w-48">
                                    <DropdownMenuGroup>
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    </DropdownMenuGroup>
                                    <DropdownMenuItem render={<Link to={`/admin/utilisateurs/${abonne.id}`} className="cursor-pointer" />}>
                                      <Eye className="size-3.5" aria-hidden="true" /> Voir la fiche
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => changerStatut(abonne, "active")} disabled={abonne.status === "active"} className="cursor-pointer">Réactiver</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => changerStatut(abonne, "paused")} disabled={abonne.status === "paused"} className="cursor-pointer">Mettre en pause</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => changerStatut(abonne, "bouncing")} disabled={abonne.status === "bouncing"} className="cursor-pointer">Marquer en rebond</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => changerStatut(abonne, "unsubscribed")} disabled={abonne.status === "unsubscribed"} className="cursor-pointer">Marquer désinscrit</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive" onClick={() => setAnonymCible(abonne)} disabled={abonne.status === "deleted"} className="cursor-pointer">
                                      Anonymiser (RGPD)…
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={setPage} />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </SectionCardAdmin>

      <DialogConfirmRGPD
        anonymCible={anonymCible}
        setAnonymCible={setAnonymCible}
        anonymiser={anonymiser}
        anonymiserMutation={anonymiserMutation}
      />
    </div>
  )
}

export default OngletPilotage
