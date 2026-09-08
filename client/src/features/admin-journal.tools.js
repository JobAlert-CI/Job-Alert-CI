import { useQuery } from "@tanstack/react-query"
import { getAuditLogs, getAuditStats } from "@/api/admin/logs"
import { getAdmins } from "@/api/admin/admins"
import { formatApiError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Page Journal d'activité (/admin/journal) — hooks TanStack (cycle 16,
   doc v3 §16).

   super_admin uniquement. Sources :
   - GET /logs/audit → ENVELOPPE { items, total, limit, offset } (le
     total est exact sous filtres — pagination honnête, cycle 16) ;
   - GET /logs/audit/stats?days=30 → compteurs globaux (G), par jour
     (H) et top auteurs (I). Les orphelins admin_id NULL (admin
     supprimé, FK SET NULL cycle 15) sortent comme « Admin supprimé ».

   Résolution des auteurs : CROISEMENT LOCAL avec la liste admins
   (clé ["admin","administrateurs",{limit:200}] — MEME clé que la page
   Administrateurs cycle 15 → cache partagé, zéro appel si déjà visité).

   ⚠️ action=connexion n'existait pas dans les données AVANT le cycle
   16 (jamais journalisé) : les entrées anciennes n'en contiennent pas,
   le filtre reste proposé car les nouvelles en produisent.

   Cache : journal volatile (lecture seule) → staleTime 60 s.
   ───────────────────────────────────────────────────────────────────── */

export const adminJournalKeys = {
  root: ["admin", "journal"],
  liste: (params) => ["admin", "journal", "audit", params],
  stats: (days) => ["admin", "journal", "audit-stats", days],
}

/** Clé de cache de la liste admins — IDENTIQUE à la page cycle 15. */
export const CLE_ADMINS = ["admin", "administrateurs", { limit: 200 }]

/** Message d'erreur lisible — via formatApiError (422 FastAPI = tableau, jamais un objet brut dans React). */
export const messageErreurJournal = (err) => formatApiError(err) || "Action impossible"

/** Page courante du journal (enveloppe paginée serveur). */
export const useJournalAuditQuery = (params) =>
  useQuery({
    queryKey: adminJournalKeys.liste(params),
    queryFn: ({ signal }) => getAuditLogs(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente, // pagination fluide
  })

/** Stats globales + axes charts (compteurs G, chart H et I). */
export const useJournalStatsQuery = (days = 30) =>
  useQuery({
    queryKey: adminJournalKeys.stats(days),
    queryFn: ({ signal }) => getAuditStats({ days }, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/**
 * Liste admins pour la résolution des auteurs : MÊME queryKey que la
 * page Administrateurs (cycle 15) → cache partagé, zéro appel réseau
 * si la page a déjà été visitée dans la session.
 */
export const useAdminsAuteurs = () =>
  useQuery({
    queryKey: CLE_ADMINS,
    queryFn: ({ signal }) => getAdmins({ limit: 200 }, { signal }),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
