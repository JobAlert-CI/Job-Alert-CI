import { useFiltresAbonnesAdmin } from "@/contexts/FiltresAbonnesAdmin.context"
import {
  useStatsAbonnesOverview, useStatsEnvoisParJour,
} from "@/features/admin-abonnes.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs + KPI de la page Abonnés (cycle 7).

   Sources (toutes vérifiées live) :
   - GET /subscribers/stats/overview → total, by_status (vocabulaire
     API), by_source, without_filiere — 1 requête ;
   - GET /subscribers/stats/sends-by-day → taux d'échec envois 30 j ;
   - les cartes Actives/Paused/Rebond cliquables appliquent le filtre
     correspondant (setStatus du contexte URL).

   KPI dérivés : taux de désinscription, taux de rebond, sans filière.
   ───────────────────────────────────────────────────────────────────── */

const pourcent = (partie, total) =>
  total > 0 ? `${Math.round((partie / total) * 100)} %` : "0 %"

const CompteursAbonnes = () => {
  const { setStatus } = useFiltresAbonnesAdmin()

  const { data: stats, isLoading } = useStatsAbonnesOverview()
  const { data: envois } = useStatsEnvoisParJour({ days: 30 })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  const total = stats?.total ?? 0
  const byStatus = stats?.by_status ?? {}
  const desinscrits = byStatus.unsubscribed ?? 0
  const rebonds = byStatus.bouncing ?? 0
  const actifs = byStatus.active ?? 0

  // Taux d'échec des envois sur 30 jours (digests).
  let envoyes = 0
  let echoues = 0
  for (const jour of envois ?? []) {
    envoyes += jour.sent ?? 0
    echoues += jour.failed ?? 0
  }
  const tauxEchec = envoyes + echoues > 0 ? pourcent(echoues, envoyes + echoues) : "—"

  return (
    <div className="flex flex-col gap-3">
      {/* Rangée 1 : 4 compteurs principaux */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CarteCompteur
          label="Abonnés totaux"
          valeur={total}
        />
        <CarteCompteur
          label="Actifs"
          valeur={actifs}
          href="/admin/utilisateurs"
          query="?status=active"
        />
        <CarteCompteur
          label="Sans filière configurée"
          valeur={stats?.without_filiere ?? 0}
          href="/admin/utilisateurs"
          query="?status=active"
        />
        <CarteCompteur
          label="Digests échoués (30 j)"
          texte={tauxEchec === "—" ? undefined : tauxEchec}
          valeur={echoues}
        />
      </div>

      {/* Rangée 2 : chips d'accès rapide par statut (filtre 1 clic) */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { libelle: "Actifs", valeur: byStatus.active, statut: "active" },
          { libelle: "Désinscrits", valeur: desinscrits, statut: "unsubscribed" },
          { libelle: "En rebond", valeur: rebonds, statut: "bouncing" },
          { libelle: "En pause", valeur: byStatus.paused, statut: "paused" },
          { libelle: "En attente", valeur: byStatus.pending, statut: "pending" },
        ].map(({ libelle, valeur, statut }) => (
          <button
            key={statut}
            type="button"
            onClick={() => setStatus(statut)}
            className="transition-transform hover:-translate-y-0.5"
            aria-label={`Filtrer : ${libelle.toLowerCase()}`}
          >
            <Badge variant={valeur > 0 ? "secondary" : "outline"} className="cursor-pointer gap-1.5 py-1 pl-2 tabular-nums">
              {libelle}
              <span className="font-bold">{valeur ?? 0}</span>
            </Badge>
          </button>
        ))}
      </div>

      {/* Rangée 3 : KPI dérivés (texte compact) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Taux de désinscription :{" "}
          <strong className="text-foreground tabular-nums">{pourcent(desinscrits, total)}</strong>
        </span>
        <span>
          Taux de rebond :{" "}
          <strong className="text-foreground tabular-nums">{pourcent(rebonds, total)}</strong>
        </span>
        <span>
          Taux d'échec envois (30 j) :{" "}
          <strong className="text-foreground tabular-nums">{tauxEchec}</strong>
        </span>
      </div>
    </div>
  )
}

export default CompteursAbonnes
