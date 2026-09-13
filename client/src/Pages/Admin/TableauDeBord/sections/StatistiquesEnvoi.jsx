import { useMemo } from "react"
import { Send } from "lucide-react"
import { useAdminSendingStatsQuery, usePeutVoirEnvois } from "@/features/admin-matching.tools"
import CountUp from "@/components/shared/CountUp"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"


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

  const lignes = [
    { label: "Envoyés", valeur: data?.total_sent, couleur: "text-brand-navy" },
    { label: "Échoués", valeur: data?.total_failed, couleur: "text-destructive" },
    { label: "Sautés", valeur: data?.total_skipped, couleur: "text-brand-orange" },
  ]

  return (
    <SectionCardAdmin
      title="Statistiques d'envoi (30j)"
      description="Digests envoyés, échoués et sautés (aucune offre correspondante)."
      icon={Send}
      badge={taux !== null && (
        <Badge variant={varianteTaux} className={taux >= 95 ? "text-emerald-600" : undefined}>
          {taux.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % de succès
        </Badge>
      )}
    >
      {!autorise ? (
        <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
      ) : isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques d'envoi." />
      ) : isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data ? (
        <SectionVide message="Aucune statistique d'envoi disponible." />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {lignes.map((l) => (
            <div key={l.label} className="rounded-lg border border-border bg-card/60 px-2 py-3 text-center">
              <p className={`font-heading text-xl font-bold tabular-nums ${l.couleur}`}>
                <CountUp to={l.valeur ?? 0} />
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{l.label}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCardAdmin>
  )
}

export default StatistiquesEnvoi