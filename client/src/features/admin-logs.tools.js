import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getEventLogs, getLogsStats, getContactMessages, updateContactStatus } from "@/api/admin/logs"
import { getTransactionalEmails, getTransactionalEmailStats } from "@/api/admin/system"
import { getRuns } from "@/api/admin/scraping"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { formatApiError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Page Logs & emails (/admin/logs) — hooks TanStack (cycle 17, doc v3 §17).

   super_admin uniquement. Trois onglets aux sources distinctes :
   - Événements : GET /logs/events (module scraping seul) + stats
     /logs/stats (compteurs E1-E4, charts E5-E6) ;
   - Contacts   : GET /logs/contacts + PATCH /{id}/status (spam
     assignable depuis le cycle 17) + stats contacts C1-C5 (même /stats) ;
   - Emails tx  : GET /transactional-emails + /stats (M1-M6).

   ⚠️ Vocabulaires PIÈGE documentés (vérifiés live cycle 17) :
   - contacts : la liste GET et le PATCH reçoivent "new|read|replied|
     archived|spam" (API), MAIS la réponse du PATCH renvoie le statut
     STOCKE ("in_progress", "closed") → maps INTERNE→API ci-dessous ;
   - emails : purposes = 6 valeurs (confirm_email, resend_confirmation,
     manage_alert, unsubscribe, reset_password, admin_welcome — la doc v3
     §17.3 n'en liste que 4, elle est périmée) ;
   - events : niveau dérivé serveur de l'action (failed→error,
     skipped→warning, autres→info) — LEVEL_PAR_ACTION reproduit le
     mapping pour empiler le chart E5 par niveau.

   Cache : lecture seule volatile → staleTime 60 s ; invalidation
   agressive après PATCH statut contact.
   ───────────────────────────────────────────────────────────────────── */

export const adminLogsKeys = {
  root: ["admin", "logs"],
  events: (params) => ["admin", "logs", "events", params],
  contacts: (params) => ["admin", "logs", "contacts", params],
  stats: (days) => ["admin", "logs", "stats", days],
  emailsTx: (params) => ["admin", "emails-tx", params],
  emailsTxStats: (days) => ["admin", "emails-tx", "stats", days],
}

/* ─── Vocabulaires ─────────────────────────────────────────────────── */

/** Statuts contacts en VOCABULAIRE API (filtres GET/PATCH). */
export const STATUTS_CONTACT = [
  { valeur: "new", libelle: "Nouveau" },
  { valeur: "read", libelle: "Lu / en cours" },
  { valeur: "replied", libelle: "Répondu" },
  { valeur: "archived", libelle: "Archivé" },
  { valeur: "spam", libelle: "Spam" },
]

/** Map statut STOCKÉ (réponse PATCH/GET) → clé API. */
export const CONTACT_INTERNE_VERS_API = {
  new: "new",
  read: "read",
  in_progress: "read",
  replied: "replied",
  closed: "archived",
  archived: "archived",
  spam: "spam",
}

/** Variantes de badge par statut contact (clé API). */
export const VARIANTE_CONTACT = {
  new: "default",
  read: "secondary",
  replied: "outline",
  archived: "outline",
  spam: "destructive",
}

/** Niveaux d'événements (filtrables côté serveur). */
export const NIVEAUX_EVENT = [
  { valeur: "error", libelle: "Erreurs" },
  { valeur: "warning", libelle: "Avertissements" },
  { valeur: "info", libelle: "Informations" },
]

/** Mapping action ingestion → niveau (miroir de _LEVEL_BY_ACTION serveur). */
export const LEVEL_PAR_ACTION = {
  inserted: "info",
  updated: "info",
  duplicate: "info",
  skipped: "warning",
  failed: "error",
}

/** Libellés des actions d'ingestion. */
export const LIBELLE_ACTION_EVENT = {
  inserted: "Insérée",
  updated: "Mise à jour",
  duplicate: "Doublon",
  skipped: "Ignorée",
  failed: "Échec",
}

/** Variantes badge par niveau. */
export const VARIANTE_NIVEAU = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
}

/** Les 6 purposes d'emails transactionnels (enum réel, cycle 15 inclus). */
export const MOTIFS_EMAIL = [
  { valeur: "confirm_email", libelle: "Confirmation d'inscription" },
  { valeur: "resend_confirmation", libelle: "Renvoi de confirmation" },
  { valeur: "manage_alert", libelle: "Gestion d'alerte" },
  { valeur: "unsubscribe", libelle: "Désinscription" },
  { valeur: "reset_password", libelle: "Reset mot de passe" },
  { valeur: "admin_welcome", libelle: "Bienvenue admin" },
]

/** Libellé d'un purpose par valeur (fallback : la valeur brute). */
export const libelleMotif = (valeur) =>
  MOTIFS_EMAIL.find((m) => m.valeur === valeur)?.libelle ?? valeur

/** Variantes badge par statut email. */
export const VARIANTE_STATUT_EMAIL = {
  sent: "default",
  queued: "secondary",
  failed: "destructive",
}

/** Libellé d'un statut email. */
export const libelleStatutEmail = (valeur) =>
  ({ sent: "Envoyé", queued: "En file", failed: "Échoué" })[valeur] ?? valeur

/* ─── Erreurs ─────────────────────────────────────────────────────── */

/** Message d'erreur lisible — TOUJOURS via formatApiError (422 = tableau). */
export const messageErreurLogs = (err) => formatApiError(err) || "Action impossible"

/* ─── Queries ─────────────────────────────────────────────────────── */

/** Événements d'ingestion (liste plate sans total → pagination heuristique). */
export const useEventsQuery = (params) =>
  useQuery({
    queryKey: adminLogsKeys.events(params),
    queryFn: ({ signal }) => getEventLogs(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente,
  })

/** Messages de contact (liste plate sans total → pagination heuristique). */
export const useContactsQuery = (params) =>
  useQuery({
    queryKey: adminLogsKeys.contacts(params),
    queryFn: ({ signal }) => getContactMessages(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente,
  })

/** Stats journal technique (events E1-E4 + axes E5-E6 + contacts C1-C5). */
export const useLogsStatsQuery = (days = 30) =>
  useQuery({
    queryKey: adminLogsKeys.stats(days),
    queryFn: ({ signal }) => getLogsStats({ days }, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/** Emails transactionnels (liste plate sans total → pagination heuristique). */
export const useEmailsTxQuery = (params) =>
  useQuery({
    queryKey: adminLogsKeys.emailsTx(params),
    queryFn: ({ signal }) => getTransactionalEmails(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente,
  })

/** Stats emails tx (M1-M6, un seul appel : total/par_statut/par_motif/
 *  echecs_fenetre/par_jour). */
export const useEmailsTxStatsQuery = (days = 30) =>
  useQuery({
    queryKey: adminLogsKeys.emailsTxStats(days),
    queryFn: ({ signal }) => getTransactionalEmailStats({ days }, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/** Sources du référentiel public (filtre source_id des événements). */
export const useSourcesReferentiel = () => useReferentialsQuery()

/**
 * Résolution sous-run → run PARENT (fix lien « Voir le run » cycle 17).
 *
 * ⚠️ PIÈGE : les événements d'ingestion portent l'ID du SOUS-RUN source
 * (`source_scrape_runs.id`, EventLogRead.source_scrape_run_id) alors que
 * la page détail attend l'ID du run PARENT (`scrape_runs.id` — un run
 * parent groupe les sous-runs de toutes les sources du même scraping).
 * Lier /admin/scraping/runs/:id avec l'ID du sous-run → 404 systématique.
 *
 * Croisement local (pattern cycle 12) : la liste des runs (celle de la
 * page Scraping, clé adminScrapingKeys.runs) contient chaque run avec
 * ses source_runs[].id → on construit la Map sous-run → parent. Les
 * événements d'un run plus vieux que la fenêtre de la liste (limit 100)
 * n'y figurent pas : le lien est alors masqué (mieux qu'un 404).
 */
export const useRunsParents = () =>
  useQuery({
    queryKey: ["admin", "scraping", "runs", { limit: 100 }],
    queryFn: ({ signal }) => getRuns({ limit: 100 }, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/* ─── Mutation PATCH statut contact ────────────────────────────────── */

/**
 * Change le statut d'un message de contact. Invalide contacts + stats
 * (les compteurs C1-C5 dépendent du statut).
 */
export const useChangerStatutContact = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, status }) => updateContactStatus(contactId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "logs", "contacts"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "logs", "stats"] })
    },
    onError: () => {},
  })
}
