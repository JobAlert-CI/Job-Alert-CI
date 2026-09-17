import { memo, useCallback, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronUp,
  Eye,  
  Search,
  Send,
  X,
} from "lucide-react"
import { cn } from "cn"
import {
  useAdminSubscriberDetailQuery,
  useApercuDigest,
  useEnvoyerSelection,
  messageErreurAbonne,
} from "@/features/admin-abonnes.tools"
import { useAdminOffersQuery } from "@/features/admin-offres.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import PaginationListe from "@/components/admin/PaginationListe"
import { SectionErreur } from "./components/EtatsSection"
import BtnAction from "@/components/admin/BtnAction"
import { SectionAucunResultat, SectionVide } from "@/components/admin/EtatsSection"
import DialogConfirmSelection from "@/components/dialog/DialogConfirmSelection"
import DialogRecapSelection from "@/components/dialog/DialogRecapSelection"

/* ─────────────────────────────────────────────────────────────────────
Page Envoi personnalisé — /admin/utilisateurs/:id/envoyer

Améliorations :
- skeleton fidèle pendant chargement abonné / offres
- gestion erreur offres
- mode mobile plus confortable
- sélection de page complète
- animation légère des changements d'état
- aperçu avec skeleton / erreur / retry
- toujours le contrat : mise en file d'attente, jamais "envoyé"
───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 20

const MODE_APERCU = {
  SELECTION: "selection",
  AUTO: "auto",
}

/* ─── Skeleton fidèle d'une ligne d'offre ─── */
const LigneOffreSkeleton = () => (
  <div
    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
    aria-hidden="true"
  >
    <Skeleton className="size-5 shrink-0 rounded-md" />

    <div className="min-w-0 flex-1 space-y-1.5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-2.5 w-1/2" />
    </div>

    <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
  </div>
)

/* ─── Skeleton complet de la page pendant chargement abonné ─── */
const SkeletonPageEnvoyerSelection = () => (
  <div
    className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-28"
    aria-busy="true"
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />

        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-64 max-w-[70vw]" />
        </div>
      </div>

      <Skeleton className="h-9 w-full rounded-md sm:w-36" />
    </div>

    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-9 w-full" />
    </div>

    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <Skeleton className="h-9 w-full" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
        <Skeleton className="h-9 w-full sm:w-44" />
        <Skeleton className="h-9 w-full sm:w-48" />
      </div>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-40" />
    </div>

    <div className="flex flex-col gap-2">
      {[...Array(6)].map((_, index) => (
        <LigneOffreSkeleton key={index} />
      ))}
    </div>

    <div className="flex justify-center">
      <Skeleton className="h-9 w-full sm:w-48" />
    </div>
  </div>
)

/* ─── Ligne d'offre mémoïsée ─── */
const LigneOffre = memo(
  ({ offre, estSelectionnee, indexSelection, onBasculer }) => {
    return (
      <li>
        <button
          type="button"
          onClick={() => onBasculer(offre)}
          aria-pressed={estSelectionnee}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none",
            estSelectionnee
              ? "border-primary/50 bg-primary/5"
              : "border-border bg-card hover:bg-muted/40"
          )}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold tabular-nums",
              estSelectionnee
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-transparent"
            )}
            aria-hidden="true"
          >
            {estSelectionnee
              ? indexSelection + 1 > 99
                ? "✓"
                : indexSelection + 1
              : ""}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {offre.title}
            </span>

            <span className="block truncate text-[10px] text-muted-foreground">
              {offre.company?.name}
              {offre.primary_filiere && ` · ${offre.primary_filiere.label}`}
            </span>
          </span>

          <AnimatePresence initial={false}>
            {estSelectionnee && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="shrink-0"
              >
                <Badge variant="secondary" className="tabular-nums">
                  <Check aria-hidden="true" /> #{indexSelection + 1}
                </Badge>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </li>
    )
  }
)

LigneOffre.displayName = "LigneOffre"

const EnvoyerSelection = () => {
  const { id: subscriberId } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()

  const {
    data: abonne,
    isLoading: abonneCharge,
    isError: abonneErreur,
    refetch: refetchAbonne,
  } = useAdminSubscriberDetailQuery(subscriberId)

  /* Recherche offres (pattern page Offres : debounced → état local). */
  const [recherche, setRecherche] = useState("")
  const [page, setPage] = useState(1)

  const { valeurLocale, setValeurLocale } = useRechercheDebouncee({
    valeurUrl: recherche,
    setScalar: (cle, valeur) => setRecherche(valeur),
  })

  const paramsOffres = useMemo(
    () => ({
      q: recherche || undefined,
      status: "active",
      visible_site: "true",
      limit: PAGE_TAILLE,
      offset: (page - 1) * PAGE_TAILLE,
    }),
    [recherche, page]
  )

  const {
    data: offres,
    isLoading: offresChargement,
    isFetching: offresRafraichissement,
    isError: offresErreur,
    refetch: refetchOffres,
  } = useAdminOffersQuery(paramsOffres)

  const listeOffres = useMemo(
    () => (Array.isArray(offres) ? offres : []),
    [offres]
  )

  /* Sélection : tableau d'IDs (ordre préservé = ordre dans l'email). */
  const [selection, setSelection] = useState([])

  /* Titres capturés à la sélection (les offres peuvent ne plus être sur
     la page courante quand on réorganise). */
  const [titresOffres, setTitresOffres] = useState({})

  const [recoOuvert, setRecoOuvert] = useState(false)
  const [sujet, setSujet] = useState("")
  const [modeApercu, setModeApercu] = useState(MODE_APERCU.SELECTION)
  const [apercuOuvert, setApercuOuvert] = useState(false)
  const [confirmationOuverte, setConfirmationOuverte] = useState(false)

  const apercuAuto = modeApercu === MODE_APERCU.AUTO

  const {
    data: apercu,
    isLoading: apercuCharge,
    isError: apercuErreur,
    refetch: refetchApercu,
  } = useApercuDigest(subscriberId, apercuAuto ? [] : selection, {
    actif: apercuOuvert,
  })

  const envoyerMutation = useEnvoyerSelection()

  const selectionIndexParId = useMemo(
    () => new Map(selection.map((id, index) => [id, index])),
    [selection]
  )

  const toutesPageSelectionnees = useMemo(
    () =>
      listeOffres.length > 0 &&
      listeOffres.every((offre) => selectionIndexParId.has(offre.id)),
    [listeOffres, selectionIndexParId]
  )

  const pageSuivantePossible = listeOffres.length === PAGE_TAILLE

  const basculerOffre = useCallback((offre) => {
    setSelection((prev) =>
      prev.includes(offre.id)
        ? prev.filter((id) => id !== offre.id)
        : [...prev, offre.id]
    )

    setTitresOffres((prev) => ({
      ...prev,
      [offre.id]: offre.title ?? "Offre sélectionnée",
    }))
  }, [])

  const selectionnerPage = useCallback(() => {
    if (!listeOffres.length) return

    setSelection((prev) => {
      const dejaSelectionnes = new Set(prev)
      const ajouts = listeOffres
        .filter((offre) => !dejaSelectionnes.has(offre.id))
        .map((offre) => offre.id)

      return ajouts.length ? [...prev, ...ajouts] : prev
    })

    setTitresOffres((prev) => {
      const suivant = { ...prev }

      for (const offre of listeOffres) {
        suivant[offre.id] = offre.title ?? "Offre sélectionnée"
      }

      return suivant
    })
  }, [listeOffres])

  const reinitialiserRecherche = useCallback(() => {
    setValeurLocale("")
    setRecherche("")
    setPage(1)
  }, [setValeurLocale])

  const monterOffre = useCallback((index) => {
    if (index === 0) return

    setSelection((prev) => {
      const copie = [...prev]
        ;[copie[index - 1], copie[index]] = [copie[index], copie[index - 1]]
      return copie
    })
  }, [])

  const descendreOffre = useCallback((index) => {
    setSelection((prev) => {
      if (index >= prev.length - 1) return prev

      const copie = [...prev]
        ;[copie[index + 1], copie[index]] = [copie[index], copie[index + 1]]
      return copie
    })
  }, [])

  const retirerOffre = useCallback((offreId) => {
    setSelection((prev) => prev.filter((id) => id !== offreId))
  }, [])

  const ouvrirApercu = useCallback((mode) => {
    setModeApercu(mode)
    setApercuOuvert(true)
  }, [])

  const envoyer = useCallback(() => {
    if (!selection.length) return

    envoyerMutation.mutate(
      {
        subscriberId,
        offerIds: selection,
        sujet: sujet.trim() || undefined,
      },
      {
        onSuccess: () => {
          notify(
            `Envoi mis en file d'attente pour ${abonne?.email ?? "l'abonné"
            } — ${selection.length} offre(s). Le worker traitera l'email sous peu.`,
            "success"
          )

          setConfirmationOuverte(false)
          navigate(`/admin/utilisateurs/${subscriberId}`)
        },
        onError: (err) =>
          notify(
            messageErreurAbonne(err) || "Mise en file impossible",
            "error"
          ),
      }
    )
  }, [
    selection,
    sujet,
    subscriberId,
    abonne,
    envoyerMutation,
    notify,
    navigate,
  ])

  if (abonneErreur) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <BtnAction
          type="button"
          variant="ghost"
          size="xs"
          className="w-fit"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft aria-hidden="true" /> Retour
        </BtnAction>

        <SectionErreur
          onRetry={refetchAbonne}
          message="Impossible de charger cet abonné."
        />
      </div>
    )
  }

  if (abonneCharge || !abonne) {
    return <SkeletonPageEnvoyerSelection />
  }

  if (abonne.status === "deleted") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <BtnAction
          type="button"
          variant="ghost"
          size="xs"
          className="w-fit"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft aria-hidden="true" /> Retour
        </BtnAction>

        <SectionErreur
          onRetry={refetchAbonne}
          message="Cet abonné a été anonymisé (RGPD) — aucun envoi n'est possible."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-28">
      {/* ─── En-tête ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BtnAction
            type="button"
            variant="ghost"
            size="xs"
            render={<Link to={`/admin/utilisateurs/${subscriberId}`} />}
            aria-label="Retour à la fiche"
          >
            <ArrowLeft aria-hidden="true" />
          </BtnAction>

          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="font-heading text-lg font-bold">
              Envoi personnalisé
            </h1>

            <p className="truncate text-xs text-muted-foreground">
              À{" "}
              <strong className="text-foreground">
                {abonne.full_name || abonne.email}
              </strong>{" "}
              · {abonne.email}
            </p>
          </div>
        </div>

        <BtnAction
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setConfirmationOuverte(true)}
          disabled={!selection.length || envoyerMutation.isPending}
        >
          <Send aria-hidden="true" />
          Envoyer
          {selection.length > 0 && ` (${selection.length})`}
        </BtnAction>
      </div>

      {/* Objet d'email (optionnel) */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
        <Label htmlFor="sujet-email" className="text-xs">
          Objet de l'email (optionnel)
        </Label>

        <Input
          id="sujet-email"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          maxLength={255}
          placeholder="Défaut : « Sélection personnalisée JobAlert CI »"
        />
      </div>

      {/* Recherche + boutons aperçu */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:min-w-52 lg:flex-1">
          {offresRafraichissement ? (
            <Spinner
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary"
              aria-label="Recherche en cours"
            />
          ) : (
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          )}

          <Input
            type="search"
            value={valeurLocale}
            onChange={(e) => {
              setValeurLocale(e.target.value)
              setPage(1)
            }}
            placeholder="Rechercher une offre à inclure…"
            aria-label="Rechercher une offre"
            className="pl-8"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
          <BtnAction
            type="button"
            size="xs"
            variant="outline"
            className="w-full lg:w-auto"
            onClick={() => ouvrirApercu(MODE_APERCU.AUTO)}
            title="5 premières offres des filières de l'abonné (cascade automatique)"
          >
            <Eye aria-hidden="true" /> Aperçu automatique
          </BtnAction>

          <BtnAction
            type="button"
            size="xs"
            variant="outline"
            className="w-full lg:w-auto"
            onClick={() => ouvrirApercu(MODE_APERCU.SELECTION)}
            disabled={!selection.length}
            title="Rendu de ma sélection"
          >
            <Eye aria-hidden="true" /> Aperçu de ma sélection
          </BtnAction>
        </div>
      </div>

      {/* ─── Liste d'offres sélectionnables ─── */}
      <div className="flex flex-col gap-3">
        {!offresErreur && (listeOffres.length > 0 || selection.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {listeOffres.length} offre{listeOffres.length > 1 ? "s" : ""} sur
              cette page · {selection.length} sélectionnée
              {selection.length > 1 ? "s" : ""}
            </p>

            <BtnAction
              type="button"
              variant="outline"
              size="xs"
              onClick={selectionnerPage}
              disabled={
                offresChargement ||
                offresErreur ||
                !listeOffres.length ||
                toutesPageSelectionnees
              }
            >
              {toutesPageSelectionnees
                ? "Page déjà sélectionnée"
                : "Sélectionner la page"}
            </BtnAction>
          </div>
        )}

        {offresErreur ? (
          <div className="animate-in fade-in duration-200 motion-reduce:animate-none rounded-xl border border-border bg-card p-4">
            <SectionErreur
              onRetry={refetchOffres}
              message="Impossible de charger les offres."
            />
          </div>
        ) : offresChargement ? (
          <div
            className="flex flex-col gap-2 animate-in fade-in duration-200 motion-reduce:animate-none"
            aria-busy="true"
            role="status"
          >
            <span className="sr-only">Chargement des offres…</span>

            {[...Array(6)].map((_, index) => (
              <LigneOffreSkeleton key={index} />
            ))}
          </div>
        ) : !listeOffres.length ? (
          <div className="animate-in fade-in duration-200 motion-reduce:animate-none rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {recherche ? (
              <SectionAucunResultat
                message={`Aucune offre active et visible ne correspond à « ${recherche} ».`}
                onReset={reinitialiserRecherche}
              />
            ) : (
              <SectionVide message="Aucune offre active et visible n'est disponible pour le moment." />
            )}
          </div>
        ) : (
          <ul
            key={`${recherche}-${page}`}
            data-testid="selecteur-offres"
            aria-busy={offresRafraichissement}
            className={cn(
              "flex flex-col gap-1.5 animate-in fade-in duration-200 motion-reduce:animate-none",
              offresRafraichissement &&
              "opacity-70 transition-opacity motion-reduce:transition-none"
            )}
          >
            {listeOffres.map((offre) => {
              const indexSelection = selectionIndexParId.get(offre.id) ?? -1
              const estSelectionnee = indexSelection !== -1

              return (
                <LigneOffre
                  key={offre.id}
                  offre={offre}
                  estSelectionnee={estSelectionnee}
                  indexSelection={indexSelection}
                  onBasculer={basculerOffre}
                />
              )
            })}
          </ul>
        )}
      </div>

      {/* Pagination mutualisée */}
      {!offresErreur && listeOffres.length > 0 && (
        <PaginationListe
          page={page}
          pagePleine={pageSuivantePossible}
          onPageChange={setPage}
        />
      )}

      {/* ─── Récapitulatif de sélection : slide-up + réorganisation ─── */}
      <AnimatePresence>
        {selection.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="sticky bottom-0 z-10 motion-reduce:transition-none"
          >
            <div className="rounded-xl border border-primary/30 bg-card/95 shadow-hover backdrop-blur">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <Badge variant="secondary" className="tabular-nums">
                  {selection.length} sélectionnée
                  {selection.length > 1 ? "s" : ""}
                </Badge>

                <BtnAction
                  type="button"
                  size="xs"
                  onClick={() => setConfirmationOuverte(true)}
                  disabled={envoyerMutation.isPending}
                >
                  <Send aria-hidden="true" /> Envoyer…
                </BtnAction>

                <BtnAction
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setSelection([])}
                >
                  Vider
                </BtnAction>

                <BtnAction
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setRecoOuvert((ouvert) => !ouvert)}
                  aria-expanded={recoOuvert}
                  title="L'ordre de sélection définit l'ordre des offres dans l'email"
                >
                  Réorganiser
                  <ChevronUp
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 transition-transform motion-reduce:transition-none",
                      !recoOuvert && "rotate-180"
                    )}
                  />
                </BtnAction>
              </div>

              {/* Liste réorganisable (flèches haut/bas + retrait) */}
              <AnimatePresence initial={false}>
                {recoOuvert && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto border-t border-border px-3 py-2 scrollbar-thin">
                      <AnimatePresence initial={false}>
                        {selection.map((offreId, index) => (
                          <motion.li
                            key={offreId}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/50 motion-reduce:transition-none"
                          >
                            <span className="w-5 shrink-0 text-center font-bold tabular-nums text-muted-foreground">
                              {index + 1}
                            </span>

                            <span className="min-w-0 flex-1 truncate">
                              {titresOffres[offreId] ??
                                `${offreId.slice(0, 8)}…`}
                            </span>

                            <BtnAction
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => monterOffre(index)}
                              disabled={index === 0}
                              aria-label={`Monter « ${titresOffres[offreId] ?? "l'offre"
                                } » d'une position`}
                            >
                              <ArrowUp className="size-3" aria-hidden="true" />
                            </BtnAction>

                            <BtnAction
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => descendreOffre(index)}
                              disabled={index === selection.length - 1}
                              aria-label={`Descendre « ${titresOffres[offreId] ?? "l'offre"
                                } » d'une position`}
                            >
                              <ArrowDown
                                className="size-3"
                                aria-hidden="true"
                              />
                            </BtnAction>

                            <BtnAction
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => retirerOffre(offreId)}
                              aria-label={`Retirer « ${titresOffres[offreId] ?? "l'offre"
                                } » de la sélection`}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="size-3" aria-hidden="true" />
                            </BtnAction>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Dialog Aperçu (iframe sandboxée — CSS email isolé) ─── */}
      <DialogRecapSelection
        apercu={apercu}
        apercuCharge={apercuCharge}
        apercuOuvert={apercuOuvert}
        setApercuOuvert={setApercuOuvert}
        selection={selection}
        modeApercu={modeApercu}
        apercuErreur={apercuErreur}
        setModeApercu={setModeApercu}
        refetchApercu={refetchApercu}
      />

      {/* ─── Dialog Confirmation (mise en file, jamais « envoyé ») ─── */}
      <DialogConfirmSelection
        confirmationOuverte={confirmationOuverte}
        setConfirmationOuverte={setConfirmationOuverte}
        abonne={abonne}
        selection={selection}
        sujet={sujet}
        titresOffres={titresOffres}
        envoyer={envoyer}
      />
    </div>
  )
}

export default EnvoyerSelection