import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronUp, Eye, Mail, Search, Send, X,
} from "lucide-react"
import { cn } from "cn"
import {
  useAdminSubscriberDetailQuery, useApercuDigest, useEnvoyerSelection, messageErreurAbonne,
} from "@/features/admin-abonnes.tools"
import { useAdminOffersQuery } from "@/features/admin-offres.tools"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import PaginationListe from "@/components/admin/PaginationListe"
import { SectionErreur } from "./components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Page Envoi personnalisé — /admin/utilisateurs/:id/envoyer (doc v3 §9).
   Refonte :
   • Récapitulatif de sélection : barre sticky en SLIDE-UP avec liste
     dépliable pour RÉORGANISER l'ordre des offres (flèches haut/bas)
     et retirer une offre sans vider toute la liste ;
   • Badge d'ordre « #N » animé (scale + fondu) à la sélection ;
   • Pagination mutualisée PaginationListe.
   Contrat : POST /subscribers/{id}/send → 201 EmailDigest QUEUED
   (message « en file d'attente », JAMAIS « envoyé »).
───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 20

const MODE_APERCU = {
  SELECTION: "selection",
  AUTO: "auto",
}

const EnvoyerSelection = () => {
  const { id: subscriberId } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const {
    data: abonne, isLoading: abonneCharge, isError: abonneErreur, refetch: refetchAbonne,
  } = useAdminSubscriberDetailQuery(subscriberId)

  // Recherche offres (pattern page Offres : debounced → état local).
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
  const { data: offres, isLoading: offresChargement } = useAdminOffersQuery(paramsOffres)

  // Sélection : tableau d'IDs (ordre préservé = ordre dans l'email).
  const [selection, setSelection] = useState([])
  // Titres capturés à la sélection (les offres peuvent ne plus être sur
  // la page courante quand on réorganise).
  const [titresOffres, setTitresOffres] = useState({})
  const [recoOuvert, setRecoOuvert] = useState(false)
  const [sujet, setSujet] = useState("")
  const [modeApercu, setModeApercu] = useState(MODE_APERCU.SELECTION)
  const [apercuOuvert, setApercuOuvert] = useState(false)
  const [confirmationOuverte, setConfirmationOuverte] = useState(false)

  const apercuAuto = modeApercu === MODE_APERCU.AUTO
  const { data: apercu, isLoading: apercuCharge, isError: apercuErreur } =
    useApercuDigest(subscriberId, apercuAuto ? [] : selection, { actif: apercuOuvert })

  const envoyerMutation = useEnvoyerSelection()

  const basculerOffre = (offre) => {
    setSelection((prev) =>
      prev.includes(offre.id) ? prev.filter((id) => id !== offre.id) : [...prev, offre.id]
    )
    setTitresOffres((prev) => (prev[offre.id] ? prev : { ...prev, [offre.id]: offre.title }))
  }

  const monterOffre = (index) => {
    if (index === 0) return
    setSelection((prev) => {
      const copie = [...prev]
      ;[copie[index - 1], copie[index]] = [copie[index], copie[index - 1]]
      return copie
    })
  }

  const descendreOffre = (index) => {
    setSelection((prev) => {
      if (index >= prev.length - 1) return prev
      const copie = [...prev]
      ;[copie[index + 1], copie[index]] = [copie[index], copie[index + 1]]
      return copie
    })
  }

  const retirerOffre = (offreId) => setSelection((prev) => prev.filter((id) => id !== offreId))

  const pageSuivantePossible = Array.isArray(offres) && offres.length === PAGE_TAILLE

  const ouvrirApercu = (mode) => {
    setModeApercu(mode)
    setApercuOuvert(true)
  }

  const envoyer = () => {
    if (!selection.length) return
    envoyerMutation.mutate(
      { subscriberId, offerIds: selection, sujet: sujet.trim() || undefined },
      {
        onSuccess: () => {
          notify(
            `Envoi mis en file d'attente pour ${abonne?.email ?? "l'abonné"} — ${selection.length} offre(s). Le worker traitera l'email sous peu.`,
            "success"
          )
          setConfirmationOuverte(false)
          navigate(`/admin/utilisateurs/${subscriberId}`)
        },
        onError: (err) => notify(messageErreurAbonne(err) || "Mise en file impossible", "error"),
      }
    )
  }

  if (abonneErreur) {
    return <SectionErreur onRetry={refetchAbonne} message="Impossible de charger cet abonné." />
  }

  if (abonneCharge || !abonne) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (abonne.status === "deleted") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft aria-hidden /> Retour
        </Button>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm">
          Cet abonné a été anonymisé (RGPD) — aucun envoi n'est possible.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* ─── En-tête ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link to={`/admin/utilisateurs/${subscriberId}`} />} aria-label="Retour à la fiche">
            <ArrowLeft aria-hidden />
          </Button>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading text-lg font-bold">Envoi personnalisé</h1>
            <p className="text-xs text-muted-foreground">
              À <strong className="text-foreground">{abonne.full_name || abonne.email}</strong> · {abonne.email}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setConfirmationOuverte(true)} disabled={!selection.length}>
          <Send aria-hidden /> Envoyer {selection.length > 0 && `(${selection.length})`}
        </Button>
      </div>

      {/* Objet d'email (optionnel) */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
        <Label htmlFor="sujet-email" className="text-xs">Objet de l'email (optionnel)</Label>
        <Input
          id="sujet-email"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          maxLength={255}
          placeholder="Défaut : « Sélection personnalisée JobAlert CI »"
        />
      </div>

      {/* Recherche + boutons aperçu */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={valeurLocale}
            onChange={(e) => { setValeurLocale(e.target.value); setPage(1) }}
            placeholder="Rechercher une offre à inclure…"
            aria-label="Rechercher une offre"
            className="pl-8"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => ouvrirApercu(MODE_APERCU.AUTO)}
          title="5 premières offres des filières de l'abonné (cascade automatique)"
        >
          <Eye aria-hidden /> Aperçu automatique
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => ouvrirApercu(MODE_APERCU.SELECTION)}
          disabled={!selection.length}
          title="Rendu de ma sélection"
        >
          <Eye aria-hidden /> Aperçu de ma sélection
        </Button>
      </div>

      {/* ─── Liste d'offres sélectionnables ─── */}
      {offresChargement ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : !offres?.length ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune offre active et visible ne correspond à « {recherche} ».
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="selecteur-offres">
          {offres.map((offre) => {
            const indexSelection = selection.indexOf(offre.id)
            const estSelectionnee = indexSelection !== -1
            return (
              <li key={offre.id}>
                <button
                  type="button"
                  onClick={() => basculerOffre(offre)}
                  aria-pressed={estSelectionnee}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    estSelectionnee
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold tabular-nums",
                      estSelectionnee ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"
                    )}
                    aria-hidden
                  >
                    {estSelectionnee ? (indexSelection + 1 > 99 ? "✓" : indexSelection + 1) : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{offre.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {offre.company?.name}
                      {offre.primary_filiere && ` · ${offre.primary_filiere.label}`}
                    </span>
                  </span>
                  {/* Badge d'ordre : apparition animée (scale + fondu). */}
                  <AnimatePresence>
                    {estSelectionnee && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="shrink-0"
                      >
                        <Badge variant="secondary" className="tabular-nums">
                          <Check aria-hidden /> #{indexSelection + 1}
                        </Badge>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Pagination mutualisée */}
      {offres?.length > 0 && (
        <PaginationListe page={page} pagePleine={pageSuivantePossible} onPageChange={setPage} />
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
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Badge variant="secondary" className="tabular-nums">
                  {selection.length} sélectionnée{selection.length > 1 ? "s" : ""}
                </Badge>
                <Button size="sm" onClick={() => setConfirmationOuverte(true)}>
                  <Send aria-hidden /> Envoyer…
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelection([])}>
                  Vider
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRecoOuvert((o) => !o)}
                  aria-expanded={recoOuvert}
                  title="L'ordre de sélection définit l'ordre des offres dans l'email"
                >
                  Réorganiser
                  <ChevronUp aria-hidden className={cn("size-3.5 transition-transform", !recoOuvert && "rotate-180")} />
                </Button>
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
                    <ul className="flex flex-col gap-1 border-t border-border px-3 py-2">
                      <AnimatePresence initial={false}>
                        {selection.map((offreId, index) => (
                          <motion.li
                            key={offreId}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted/50"
                          >
                            <span className="w-5 shrink-0 text-center font-bold tabular-nums text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {titresOffres[offreId] ?? `${offreId.slice(0, 8)}…`}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => monterOffre(index)}
                              disabled={index === 0}
                              aria-label={`Monter « ${titresOffres[offreId] ?? "l'offre"} » d'une position`}
                            >
                              <ArrowUp className="size-3" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => descendreOffre(index)}
                              disabled={index === selection.length - 1}
                              aria-label={`Descendre « ${titresOffres[offreId] ?? "l'offre"} » d'une position`}
                            >
                              <ArrowDown className="size-3" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => retirerOffre(offreId)}
                              aria-label={`Retirer « ${titresOffres[offreId] ?? "l'offre"} » de la sélection`}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="size-3" aria-hidden />
                            </Button>
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
      <Dialog open={apercuOuvert} onOpenChange={(o) => !o && setApercuOuvert(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden /> Aperçu du digest
            </DialogTitle>
            <DialogDescription>{apercu?.message ?? "Aperçu (non envoyé)"}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {[
              { mode: MODE_APERCU.SELECTION, libelle: "Ma sélection", disabled: !selection.length },
              { mode: MODE_APERCU.AUTO, libelle: "Selon ses filières", disabled: false },
            ].map(({ mode, libelle, disabled }) => (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => setModeApercu(mode)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  modeApercu === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {libelle}
              </button>
            ))}
          </div>
          {apercuCharge ? (
            <div className="flex min-h-48 items-center justify-center" role="status">
              <Spinner className="size-5" />
            </div>
          ) : apercuErreur ? (
            <div className="p-6 text-center text-sm text-destructive">
              Aperçu indisponible — réessayez ou vérifiez la sélection.
            </div>
          ) : apercu?.preview ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Objet : <strong className="text-foreground">{apercu.preview.subject_preview}</strong>
                {" "}· {apercu.preview.offer_count} offre(s)
              </p>
              <iframe
                title="Aperçu du rendu de l'email"
                sandbox=""
                srcDoc={apercu.preview.html_snippet}
                className="h-64 w-full rounded-lg border border-border bg-white"
              />
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aucun aperçu disponible — vérifiez la sélection.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Confirmation (mise en file, jamais « envoyé ») ─── */}
      <Dialog open={confirmationOuverte} onOpenChange={setConfirmationOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mettre en file d'attente ?</DialogTitle>
            <DialogDescription>
              {selection.length} offre(s) seront mises en file pour{" "}
              <strong className="text-foreground">{abonne.email}</strong> avec l'objet «{" "}
              {sujet.trim() || "Sélection personnalisée JobAlert CI"} ».
              L'envoi effectif est traité par le worker — vous serez informé du résultat
              dans l'historique d'envois de l'abonné.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground">
            {selection.map((offreId, i) => (
              <li key={offreId} className="flex gap-1.5">
                <span className="font-semibold text-foreground">{i + 1}.</span>
                {titresOffres[offreId] ?? `${offreId.slice(0, 8)}…`}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmationOuverte(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={envoyer} disabled={envoyerMutation.isPending}>
              {envoyerMutation.isPending ? <Spinner /> : <Send aria-hidden />}
              {envoyerMutation.isPending ? "Mise en file…" : "Mettre en file d'attente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EnvoyerSelection