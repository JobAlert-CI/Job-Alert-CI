import { useMemo } from "react"
import { Send } from "lucide-react"
import { useAdminSendingStatsQuery, usePeutVoirEnvois } from "@/features/admin-matching.tools"
import CountUp from "@/components/shared/CountUp"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section — Statistiques d'envoi (30 jours).

   GET /api/admin/sending/stats?period_days=30 →
   { period_days, total_sent, total_failed, total_skipped, success_rate }
   (shape vérifiée live : {30, 1, 0, 1, 100.0} et fixture : {30, 2891,
   12, 44, 99.59}).

   Router sending : super_admin + gestionnaire_utilisateurs (gated).
   Un taux de succès < 95 % est un signal d'alerte opérationnel.
   ───────────────────────────────────────────────────────────────────── */

const StatistiquesEnvoi = () => {
  const autorise = usePeutVoirEnvois()
  const { data, isLoading, isError, refetch } = useAdminSendingStatsQuery(30)

  const taux = data?.success_rate ?? null
  const varianteTaux = useMemo(() => {
    if (taux === null) return "outline"
    if (taux >= 95) return "secondary"
    if (taux >= 80) return "outline"
    return "destructive"
  }, [taux])

  if (!autorise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4 text-primary" aria-hidden />
            Envois — 30 jours
          </CardTitle>
          <CardDescription>Succès et échecs des digests.</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
        </CardContent>
      </Card>
    )
  }

  const lignes = [
    { label: "Envoyés", valeur: data?.total_sent, couleur: "text-emerald-600" },
    { label: "Échoués", valeur: data?.total_failed, couleur: "text-destructive" },
    { label: "Sautés (vide)", valeur: data?.total_skipped, couleur: "text-amber-600" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Send className="size-4 text-primary" aria-hidden />
            Envois — 30 jours
          </span>
          {taux !== null && (
            <Badge variant={varianteTaux} className={taux >= 95 ? "text-emerald-600" : undefined}>
              {taux.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % de succès
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Digests envoyés, échoués et sautés (aucune offre correspondante) sur 30 jours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques d'envoi." />
        ) : isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !data ? (
          <SectionVide message="Aucune statistique d'envoi disponible." />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {lignes.map((l) => (
              <div key={l.label} className="rounded-lg border border-border bg-card/60 p-3 text-center">
                <p className={`font-heading text-xl font-bold tabular-nums ${l.couleur}`}>
                  {isLoading ? "—" : <CountUp to={l.valeur ?? 0} />}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{l.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default StatistiquesEnvoi
