import { useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Radar, RotateCw } from "lucide-react"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import {
  useTriggerScraping, messageErreurScraping, useAdminScrapingStatusQuery,
} from "@/features/admin-scraping.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import EnTeteScraping from "./sections/EnTeteScraping"
import CartesSources from "./sections/CartesSources"
import CompteursScraping from "./sections/CompteursScraping"
import ChartsScraping from "./sections/ChartsScraping"
import HistoriqueRuns from "./sections/HistoriqueRuns"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du scraping — /admin/scraping (super_admin, guard
   par route dans App.jsx).

   Orchestrateur pur (pattern src/Pages/Offres) : aucun fetch direct,
   chaque section consomme son hook TanStack et porte son
   ErrorBoundary dédié — une section qui plante n'emporte pas la page.

   Sections (doc v3 §10) :
   1. EnTeteScraping   — titre, état global de la collecte (dérivé
                         des runs), bouton « Lancer un scraping » ;
   2. CartesSources    — une carte par source (dernier passage,
                         durée, dernière erreur, total runs) ;
   3. HistoriqueRuns   — table des runs récents, filtre statut,
                         pagination heuristique, lien vers le détail
                         (page 11, cycle suivant).

   Dialog de déclenchement : POST /api/admin/scraping/trigger crée
   seulement des lignes "pending" — l'exécution est asynchrone
   (worker Celery). Le message de succès dit « en file d'attente »,
   JAMAIS « scraping terminé » (doc v3 §10 point d'attention).
   404 = aucune source active correspondante → message clair.
   ───────────────────────────────────────────────────────────────────── */

const MAX_NOTES = 1000

const Scraping = () => {
  const notify = useNotify()

  // Sources du dialog (pas un état partagé : le dialog se remonte à
  // chaque ouverture → réinitialisation naturelle, pattern cycle 8).
  const [dialogOuvert, setDialogOuvert] = useState(false)
  const [sourceCode, setSourceCode] = useState("")
  const [notes, setNotes] = useState("")

  const { data: sources } = useAdminScrapingStatusQuery()
  const triggerMutation = useTriggerScraping()

  const ouvrirDialog = () => {
    setSourceCode("")
    setNotes("")
    setDialogOuvert(true)
  }

  const lancerScraping = () => {
    triggerMutation.mutate(
      // source_code vide → undefined via cleanParams → toutes les
      // sources actives (sémantique serveur, cf. scraping.py).
      { source_code: sourceCode || undefined, notes: notes.trim() || undefined },
      {
        onSuccess: (run) => {
          const nb = run?.source_runs?.length
          notify(
            nb === 1
              ? "Scraping mis en file d'attente pour 1 source — suivez son avancement ci-dessous."
              : `Scraping mis en file d'attente pour ${nb ?? "les"} source${nb > 1 ? "s" : ""} — suivez son avancement ci-dessous.`,
            "success"
          )
          setDialogOuvert(false)
        },
        onError: (err) => notify(messageErreurScraping(err), "error"),
      }
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <EnTeteScraping onDeclencher={ouvrirDialog} />
      </ErrorBoundary>

      {/* Compteurs (sélection utilisateur cycle 10) : 2 dérivés des
          requêtes existantes, 2 via /stats/summary (endpoint créé). */}
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <CompteursScraping />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <CartesSources />
      </ErrorBoundary>

      {/* Charts (recharts confiné au chunk lazy de la page). */}
      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <ChartsScraping />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={AdminSectionFallback}>
        <HistoriqueRuns />
      </ErrorBoundary>

      {/* ─── Dialog de déclenchement manuel ─── */}
      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="size-4 text-primary" aria-hidden />
              Lancer un scraping
            </DialogTitle>
            <DialogDescription>
              Le scraping est mis en file d'attente puis exécuté par le worker de collecte
              (requêtes HTTP, extraction, normalisation) — l'écran se rafraîchit automatiquement
              pendant l'exécution.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scraping-source">Source</Label>
              <Select value={sourceCode} onValueChange={setSourceCode}>
                <SelectTrigger id="scraping-source" className="w-full">
                  <SelectValue placeholder="Toutes les sources actives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes les sources actives</SelectItem>
                  {(sources ?? []).map((s) => (
                    <SelectItem key={s.source_code} value={s.source_code}>
                      {s.source_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Les sources en pause sont exclues automatiquement (404 si aucune source active).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scraping-notes">Notes (optionnel)</Label>
              <Textarea
                id="scraping-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_NOTES}
                rows={3}
                placeholder="Ex. relance manuelle après correction de l'URL d'offres…"
                aria-describedby="scraping-notes-compteur"
              />
              <p id="scraping-notes-compteur" className="text-right text-[10px] text-muted-foreground tabular-nums">
                {notes.length}/{MAX_NOTES}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={lancerScraping} disabled={triggerMutation.isPending}>
              <RotateCw aria-hidden className={triggerMutation.isPending ? "animate-spin" : undefined} />
              {triggerMutation.isPending ? "Mise en file…" : "Lancer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Scraping
