import { useQuery } from "@tanstack/react-query"
import { getOverview, getRuns, getRunDetail, getTopViewedOffers } from "@/api/admin/dashboard"

/* ─────────────────────────────────────────────────────────────────────
   Dashboard admin : hooks TanStack par widget.

   Volatilité des données (justifie les staleTime, cf. prompt §4
   "Cache" — les valeurs globales de queryClient.js sont un défaut
   public, PAS une règle admin) :
   - overview  : 6 COUNT + lecture dernier run, calculés à la demande →
                 quasi temps réel, staleTime court + polling 60 s ;
   - runs      : historique, seules les dernières lignes changent →
                 suit overview ;
   - tier-stats: distribution matching sur 7 jours, évolue lentement →
                 staleTime 5 min ;
   - top-viewed: tri sur view_count total (le param days n'est pas
                 branché côté backend — traiter comme "top all-time",
                 cf. doc v3 §2) → staleTime 5 min.
   ───────────────────────────────────────────────────────────────────── */

export const adminDashboardKeys = {
  root: ["admin", "dashboard"],
  overview: ["admin", "dashboard", "overview"],
  runs: (params) => ["admin", "dashboard", "runs", params],
  run: (id) => ["admin", "dashboard", "run", id],
  topViewed: (params) => ["admin", "dashboard", "top-viewed", params],
}

/* ─── Vue d'ensemble (en-tête : 6 compteurs + dernier run + digests) ── */

export const useAdminOverviewQuery = () =>
  useQuery({
    queryKey: adminDashboardKeys.overview,
    queryFn: ({ signal }) => getOverview({ signal }),
    // Données quasi temps réel : 30 s de fraîcheur + polling 60 s (géré
    // par la page via refetchInterval), incompatible avec les 5 min
    // par défaut pensés pour le contenu public.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  })

/* ─── Mini-historique des runs de scraping ──────────────────────────── */

/**
 * @param {Object} params { limit (defaut 5), offset }
 * NOTE : réponse = liste plate (pas de total), la pagination du
 * mini-tableau est bornée côté page (voir la doc v3 §2).
 */
export const useAdminRunsQuery = (params = { limit: 5 }) =>
  useQuery({
    queryKey: adminDashboardKeys.runs(params),
    queryFn: ({ signal }) => getRuns(params, { signal }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  })

/* ─── Détail d'un run (lien depuis le mini-tableau vers /admin/scraping) ─ */

export const useAdminRunDetailQuery = (runId, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminDashboardKeys.run(runId),
    queryFn: ({ signal }) => getRunDetail(runId, { signal }),
    enabled: !!runId && enabled,
    staleTime: 60 * 1000,
  })

/* ─── Top offres consultées (all-time : days non branché backend) ────── */

export const useAdminTopViewedQuery = (params = { limit: 10 }) =>
  useQuery({
    queryKey: adminDashboardKeys.topViewed(params),
    queryFn: ({ signal }) => getTopViewedOffers(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
