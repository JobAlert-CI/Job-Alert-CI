import { useQuery } from "@tanstack/react-query"
import { getSystemEvents, getSystemHealth, getSystemSchedule } from "@/api/admin/system"
import { formatApiError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Page Santé du système (/admin/systeme, super_admin) : hooks TanStack
   par vue (audit 4 — Lot 6 observabilité).

   Volatilité (justifie les staleTime) :
   - health   : inspection Celery coûteuse (timeout 2 s) → rafraîchissement
                MANUEL uniquement (doc §20), staleTime infinie ;
   - schedule : planification beat effective — ne bouge qu'au RESTART du
                stack (uvicorn --reload recharge l'API, PAS beat/workers) →
                staleTime infinie, mais un simple re-mount la re-demande ;
   - events   : journal des événements système (échecs tasks, emails, IA) —
                pas de polling : l'utilisateur rafraîchit ou change les
                filtres (le volume d'événements est faible par
                construction, échecs seulement).
   ───────────────────────────────────────────────────────────────────── */

export const adminSystemeKeys = {
  root: ["admin", "systeme"],
  sante: ["admin", "systeme", "sante"],
  planification: ["admin", "systeme", "planification"],
  evenements: (params) => ["admin", "systeme", "evenements", params],
}

/** Santé globale — staleTime infinie : JAMAIS de refetch auto (doc §20). */
export const useSystemeSanteQuery = () =>
  useQuery({
    queryKey: adminSystemeKeys.sante,
    queryFn: ({ signal }) => getSystemHealth({ signal }),
    staleTime: Infinity,
    retry: 0,
  })

/**
 * Planification beat effective (audit 4, F.2) — lecture seule.
 * ⚠ Ne bouge qu'au restart du stack : staleTime infinie.
 */
export const useSystemePlanificationQuery = () =>
  useQuery({
    queryKey: adminSystemeKeys.planification,
    queryFn: ({ signal }) => getSystemSchedule({ signal }),
    staleTime: Infinity,
    retry: 1,
  })

/**
 * Journal des événements système (audit 4, G.1) — enveloppe paginée.
 * @param {Object} params { source, severity, event_type, days, limit, offset }
 *   miroir des Query params serveur (source/severity → 400 si inconnue).
 */
export const useSystemeEvenementsQuery = (params = {}) =>
  useQuery({
    queryKey: adminSystemeKeys.evenements(params),
    queryFn: ({ signal }) => getSystemEvents(params, { signal }),
    staleTime: 30 * 1000,
    retry: 1,
  })

/** Erreur → message lisible (le 400 des enums porte un detail français). */
export const messageErreurSysteme = (err) => formatApiError(err) || "Action impossible"
