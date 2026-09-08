import { BellRing, CheckCheck } from "lucide-react"
import {
  messageErreurIa, SEVERITES, useAcquitterAlerte, useAlertesIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionAucunResultat, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section Alertes IA (cycle 19, doc v3 §19).

   Filtres URL-synchronisés : sévérité + inclusion des acquittées.
   Ack idempotent par ligne (le serveur renvoie l'horodatage existant
   si déjà acquittée). Liste plate sans total → pagination heuristique.
   ───────────────────────────────────────────────────────────────────── */

const dateHeure = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

const SectionAlertes = () => {
  const notify = useNotify()
  const {
    severite, inclureAcquittees, pageAlertes, paramsAlertes,
    setSeverite, setInclureAcquittees, setPageAlertes, reinitialiserAlertes,
  } = useFiltresIaAdmin()

  const { data: alertes, isLoading, isError, refetch } = useAlertesIaQuery(paramsAlertes)
  const acquitter = useAcquitterAlerte()

  const pagePleine = Array.isArray(alertes) && alertes.length === paramsAlertes.limit
  const filtresActifs = !!severite || inclureAcquittees

  const accuser = (alerte) => {
    acquitter.mutate(alerte.id, {
      onSuccess: () => notify("Alerte acquittée", "success"),
      onError: (err) => notify(messageErreurIa(err), "error"),
    })
  }

  return (
    <section aria-label="Alertes IA" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <BellRing className="size-4 text-primary" aria-hidden /> Alertes
          </h2>
          <p className="text-xs text-muted-foreground">
            Signaux émis par le pipeline (clé indisponible, quota, désactivation auto…). Non acquittées par défaut.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={severite} onChange={(e) => setSeverite(e.target.value)}
            aria-label="Filtrer par sévérité"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">Toutes sévérités</option>
            {Object.entries(SEVERITES).map(([valeur, conf]) => (
              <option key={valeur} value={valeur}>{conf.libelle}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={inclureAcquittees}
              onChange={(e) => setInclureAcquittees(e.target.checked)}
              aria-label="Inclure les alertes acquittées" />
            Inclure acquittées
          </label>
          {filtresActifs && (
            <Button variant="ghost" size="sm" onClick={reinitialiserAlertes}>Réinitialiser</Button>
          )}
        </div>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les alertes." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !alertes?.length ? (
        filtresActifs ? (
          <SectionAucunResultat onReset={reinitialiserAlertes} message="Aucune alerte ne correspond aux filtres." />
        ) : (
          <SectionVide message="Aucune alerte IA en attente — le pipeline est serein." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Créée</TableHead>
                <TableHead>Sévérité</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="max-w-72">Message</TableHead>
                <TableHead className="hidden lg:table-cell">Acquittée</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertes.map((alerte) => {
                const conf = SEVERITES[alerte.severity] ?? { libelle: alerte.severity, variante: "outline" }
                const enCours = acquitter.isPending && acquitter.variables === alerte.id
                return (
                  <TableRow key={alerte.id} className={alerte.acknowledged_at ? "opacity-60" : undefined}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateHeure(alerte.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={conf.variante}>{conf.libelle}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] text-muted-foreground">{alerte.type}</span>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <span className="block truncate text-xs" title={alerte.message}>{alerte.message}</span>
                    </TableCell>
                    <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                      {alerte.acknowledged_at ? dateHeure(alerte.acknowledged_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {!alerte.acknowledged_at && (
                        <Button variant="ghost" size="sm" onClick={() => accuser(alerte)} disabled={enCours}
                          aria-label={`Acquitter l'alerte ${alerte.type}`}>
                          <CheckCheck className="size-3.5" aria-hidden /> {enCours ? "…" : "Acquitter"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationListe page={pageAlertes} pagePleine={pagePleine} onPageChange={setPageAlertes} />
    </section>
  )
}

export default SectionAlertes
