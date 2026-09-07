import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getSources, createSource, updateSource, updateSourceStatus, deleteSource,
} from "@/api/admin/referentials"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des sources (/admin/sources) — hooks TanStack.

   Piloter les sites scrapés (doc v3 §13) : activer/désactiver vite en
   cas d'incident (blocage anti-scraping, structure HTML modifiée).

   Vocabulaire vérifié LIVE (2026-09-06, 6 sources) :
   - SourceRead expose TOUT (anti_scraping_level, notes, is_primary,
     default_scan_time…) — pas de piège FiliereRead ici ;
   - status en base : active|paused|error|disabled — mais
     PATCH /{id}/status n'accepte QUE active|paused|disabled (Literal
     serveur, le JSDoc client dit "error" à tort) ;
   - mettre en pause EXCLUT la source du prochain trigger scraping
     (celui-ci ne sélectionne que les status='active').

   ⚠️ Doc v3 §13 : la planification Celery est câblée sur des codes en
   dur (goafrica, jobivoire, educarriere) — désactiver une source ne
   change PAS la planification ; ajouter une source nécessite une
   intervention code côté beat.

   Cache : référentiel quasi statique → staleTime 10 min ;
   invalidation après chaque mutation, y compris le référentiel
   PUBLIC ["offres","referentials"] (les filtres publics listent les
   sources) et le cache scraping/status (les cartes sources de la
   page Scraping dépendent du statut).
   ───────────────────────────────────────────────────────────────────── */

export const adminSourcesKeys = {
  root: ["admin", "referentials", "sources"],
}

/** Message d'erreur lisible (détail serveur 400/404…). */
export const messageErreurSource = (err) =>
  err?.response?.data?.detail || err?.message || "Action impossible"

/* Valeurs de statut acceptées par PATCH /status (Literal serveur). */
export const STATUTS_PATCH = ["active", "paused", "disabled"]

const useInvalidateSources = () => {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: adminSourcesKeys.root })
    // Référentiel public (filtres /offres) + état des sources de la
    // page Scraping (le statut change leur prochain passage).
    queryClient.invalidateQueries({ queryKey: ["offres", "referentials"] })
    queryClient.invalidateQueries({ queryKey: ["admin", "scraping"] })
  }
}

export const useAdminSourcesQuery = () =>
  useQuery({
    queryKey: adminSourcesKeys.root,
    queryFn: ({ signal }) => getSources({ signal }),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

export const useCreateSource = () => {
  const invalidate = useInvalidateSources()
  return useMutation({ mutationFn: (data) => createSource(data), onSuccess: invalidate })
}

export const useUpdateSource = () => {
  const invalidate = useInvalidateSources()
  return useMutation({
    mutationFn: ({ id, data }) => updateSource(id, data),
    onSuccess: invalidate,
  })
}

/** Bascule rapide active/paused/disabled — isolée du formulaire complet. */
export const useChangerStatutSource = () => {
  const invalidate = useInvalidateSources()
  return useMutation({
    mutationFn: ({ id, status }) => updateSourceStatus(id, status),
    onSuccess: invalidate,
  })
}

export const useDeleteSource = () => {
  const invalidate = useInvalidateSources()
  return useMutation({ mutationFn: (id) => deleteSource(id), onSuccess: invalidate })
}
