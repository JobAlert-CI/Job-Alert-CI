import { useQuery } from "@tanstack/react-query"
import { getTierStats } from "@/api/admin/sending"
import { getSendingStats } from "@/api/admin/sending"
import { useAdminAuth } from "@/contexts/AdminAuth.context"

/* ─────────────────────────────────────────────────────────────────────
   Qualité du matching + statistiques d'envoi (widgets dashboard).

   GET /api/admin/sending/tier-stats?period_days=7 →
   { period_days, since, until,
     tier_distribution:   { by_day: { [date]: { tiers: [{tier, count}], skipped_empty, total } },
                           global: { tiers, skipped_empty, total } },
     match_kind_distribution: { by_day, global: { kinds: { [kind]: n }, total } } }

   GET /api/admin/sending/stats?period_days=30 →
   { period_days, total_sent, total_failed, total_skipped, success_rate }

   ⚠ RÔLES : tout le router /api/admin/sending est protégé
   `super_admin + gestionnaire_utilisateurs` (require_roles vérifié
   dans api/v1/admin/sending.py). Les hooks sont `enabled` selon le
   rôle courant : un moderateur/gestionnaire_offres ne déclenche
   JAMAIS la requête (pas de 403 silencieux en console).
   La couleur (vert si T0/T1 dominant, orange/rouge si T3+ dominant)
   est un signal produit : un T2+ élevé indique un référentiel trop
   strict (doc v3 §2, point d'attention).
   ───────────────────────────────────────────────────────────────────── */

/** Rôles autorisés sur /api/admin/sending/* (cf. sending.py). */
export const ROLES_SENDING = ["super_admin", "gestionnaire_utilisateurs"]

/** Le rôle courant peut-il interroger le router sending ? */
export const usePeutVoirEnvois = () => {
  const { role } = useAdminAuth()
  return !!role && ROLES_SENDING.includes(role)
}

export const adminTierStatsKeys = {
  root: ["admin", "sending", "tier-stats"],
  stats: (periodDays) => ["admin", "sending", "tier-stats", periodDays],
}

export const TIER_LABELS = {
  T0: "Offre filière (exact)",
  T1: "Filière élargie",
  T2: "Fallback contrat",
  T3: "Fallback fraîcheur",
  T4: "Fallback expérience",
  T5: "Fallback ville",
}

/** Seuils de lecture produit pour la couleur du widget. */
export const TIER_SEUILS = {
  // Part de T0+T1 en % de la distribution globale.
  VERT: 70,
  ORANGE: 40,
}

/**
 * Calcule le niveau d'alerte du widget depuis la distribution globale.
 * @returns {"ok"|"attention"|"critique"|"vide"} 
 */
export const etatQualiteMatching = (tierDistribution) => {
  const tiers = tierDistribution?.global?.tiers ?? []
  const total = tierDistribution?.global?.total ?? 0
  if (!total) return "vide"
  const compte = Object.fromEntries(tiers.map((t) => [t.tier, t.count]))
  const partT01 = ((compte.T0 ?? 0) + (compte.T1 ?? 0)) / total * 100
  if (partT01 >= TIER_SEUILS.VERT) return "ok"
  if (partT01 >= TIER_SEUILS.ORANGE) return "attention"
  return "critique"
}

export const useAdminTierStatsQuery = (periodDays = 7) => {
  const autorise = usePeutVoirEnvois()
  return useQuery({
    queryKey: adminTierStatsKeys.stats(periodDays),
    queryFn: ({ signal }) => getTierStats({ period_days: periodDays }, { signal }),
    // Évolution lente (agrégat sur 7 jours) : 5 min suffisent.
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: autorise,
  })
}

/* ─── Statistiques d'envoi (30 jours) ───────────────────────────────── */

export const adminSendingStatsKeys = {
  stats: (periodDays) => ["admin", "sending", "stats", periodDays],
}

/**
 * GET /api/admin/sending/stats?period_days=30 →
 * { period_days, total_sent, total_failed, total_skipped, success_rate }
 * Shape vérifiée sur l'API live ET la fixture adminSending.getSendingStats.
 */
export const useAdminSendingStatsQuery = (periodDays = 30) => {
  const autorise = usePeutVoirEnvois()
  return useQuery({
    queryKey: adminSendingStatsKeys.stats(periodDays),
    queryFn: ({ signal }) => getSendingStats({ period_days: periodDays }, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: autorise,
  })
}
