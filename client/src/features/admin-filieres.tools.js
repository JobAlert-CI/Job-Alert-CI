import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getFilieres, createFiliere, updateFiliere, deleteFiliere,
  updateFiliereKeywords, simulateFiliere,
  getSpecialites, createSpecialite, updateSpecialite, deleteSpecialite,
} from "@/api/admin/referentials"
import { getOfferStatsByFiliere } from "@/api/public/stats"
import { getTopFilieres } from "@/api/admin/subscriber-stats"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des filières (/admin/filieres) — hooks TanStack.

   Référentiel stratégique (doc v3 §12) : la modification des
   mots-clés n'est plus à l'aveugle — simulate + avertissement
   « prochain scraping seulement ».

   Volatilité : référentiel quasi statique → staleTime 10 min ;
   invalidation agressive après CHAQUE mutation (le PUT keywords
   REMPLACE la liste entière — la page doit recharger l'existant).

   ⚠️ Vocabulaire vérifié LIVE (2026-09-06) :
   - FiliereRead expose désormais keywords: [{keyword, weight,
     is_active}] (exposé ce cycle, feu vert utilisateur) ;
   - simulate → {filiere_code, current_keyword_count,
     proposed_keyword_count, offers_affected_7_days, message}
     (la FIXTURE écrit matched_offers/sample_matches à tort — codé
     contre le live) ;
   - simulate ATTEND keywords: [{keyword, weight}] (list[dict]),
     pas une liste de strings (JSDoc referentials.js inexact) ;
   - codes réels : logistique-transport, tech-dev… (pas logistique).
   ───────────────────────────────────────────────────────────────────── */

export const adminFilieresKeys = {
  root: ["admin", "referentials", "filieres"],
  filiere: (id) => ["admin", "referentials", "filieres", id],
  specialites: (id) => ["admin", "referentials", "filieres", id, "specialites"],
  statsOffres: ["admin", "filieres", "stats", "offres-par-filiere"],
  statsAbonnes: (params) => ["admin", "filieres", "stats", "abonnes-par-filiere", params],
}

/* ─── Axes stats (cycle 12, sélection utilisateur) ──────────────────────
   Offres rattachées : /api/stats/offers/by-filiere (PUBLIC — live :
   [{id, code, label, total_offers, new_offers, color_hex}], ne liste
   que les filières PEUPLÉES, limit 1-500 pour tout couvrir).
   Abonnés rattachés : /api/admin/subscribers/stats/top-filieres
   (créé cycle 7 — [{filiere_id, code, label, subscribers_count}]).
   ⚠️ BORNES SERVEUR vérifiées live (bug remonté par l'utilisateur :
   compteur à 0 alors qu'un abonné existe) : top-filieres refuse
   limit > 50 (422 silencieux → data undefined → compteur 0) ;
   by-filiere accepte jusqu'à 500. On envoie les bornes exactes.
   Les compteurs front somment ces réponses : les filières vides
   sont absentes des deux endpoints (0 implicite). */

export const useStatsOffresParFiliere = (params = { limit: 500 }) =>
  useQuery({
    queryKey: adminFilieresKeys.statsOffres,
    queryFn: ({ signal }) => getOfferStatsByFiliere(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

export const useStatsAbonnesParFiliere = (params = { limit: 50 }) =>
  useQuery({
    queryKey: adminFilieresKeys.statsAbonnes(params),
    queryFn: ({ signal }) => getTopFilieres(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Message d'erreur lisible (détail serveur 400/404/409…). */
export const messageErreurReferentiel = (err) =>
  err?.response?.data?.detail || err?.message || "Action impossible"

/* ─── Liste des filières (mots-clés + spécialités préchargés) ────────── */

export const useAdminFilieresQuery = () =>
  useQuery({
    queryKey: adminFilieresKeys.root,
    queryFn: ({ signal }) => getFilieres({ signal }),
    // Référentiel quasi statique — mais l'éditeur de mots-clés doit
    // TOUJOURS partir de l'existant : refetch au montage suffit.
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

/* ─── CRUD filière ──────────────────────────────────────────────────── */

const useInvalidateFilieres = () => {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: adminFilieresKeys.root })
    // Le référentiel PUBLIC (sélecteurs du formulaire d'offre, filtres
    // abonnés…) doit suivre — clé canonique ["offres","referentials"]
    // (cf. lib/referentiels-query.js).
    queryClient.invalidateQueries({ queryKey: ["offres", "referentials"] })
  }
}

export const useCreateFiliere = () => {
  const invalidate = useInvalidateFilieres()
  return useMutation({ mutationFn: (data) => createFiliere(data), onSuccess: invalidate })
}

export const useUpdateFiliere = () => {
  const invalidate = useInvalidateFilieres()
  return useMutation({
    mutationFn: ({ id, data }) => updateFiliere(id, data),
    onSuccess: invalidate,
  })
}

export const useDeleteFiliere = () => {
  const invalidate = useInvalidateFilieres()
  return useMutation({
    mutationFn: (id) => deleteFiliere(id),
    onSuccess: invalidate,
  })
}

/* ─── Mots-clés (PUT remplace TOUTE la liste) ───────────────────────── */

export const useUpdateFiliereKeywords = () => {
  const invalidate = useInvalidateFilieres()
  return useMutation({
    mutationFn: ({ id, keywords }) => updateFiliereKeywords(id, { keywords }),
    onSuccess: invalidate,
  })
}

/* ─── Simulation d'impact (POST /filieres/simulate, SANS écriture) ──── */

/**
 * Mutation ponctuelle : le résultat ne se met pas en cache (chaque
 * test dépend de la liste saisie à l'instant).
 * ATTEND keywords: [{keyword, weight}] (vérifié live), min 1.
 */
export const useSimulateFiliere = () =>
  useMutation({
    mutationFn: (data) => simulateFiliere(data),
  })

/* ─── Spécialités ────────────────────────────────────────────────────── */

export const useAdminSpecialitesQuery = (filiereId, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminFilieresKeys.specialites(filiereId),
    queryFn: ({ signal }) => getSpecialites(filiereId, { signal }),
    enabled: !!filiereId && enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

const useInvalidateSpecialites = (filiereId) => {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: adminFilieresKeys.specialites(filiereId) })
    queryClient.invalidateQueries({ queryKey: adminFilieresKeys.root })
    queryClient.invalidateQueries({ queryKey: ["offres", "referentials"] })
  }
}

export const useCreateSpecialite = (filiereId) => {
  const invalidate = useInvalidateSpecialites(filiereId)
  return useMutation({ mutationFn: (data) => createSpecialite(filiereId, data), onSuccess: invalidate })
}

export const useUpdateSpecialite = (filiereId) => {
  const invalidate = useInvalidateSpecialites(filiereId)
  return useMutation({
    mutationFn: ({ id, data }) => updateSpecialite(id, data),
    onSuccess: invalidate,
  })
}

export const useDeleteSpecialite = (filiereId) => {
  const invalidate = useInvalidateSpecialites(filiereId)
  return useMutation({
    mutationFn: (id) => deleteSpecialite(id),
    onSuccess: invalidate,
  })
}
