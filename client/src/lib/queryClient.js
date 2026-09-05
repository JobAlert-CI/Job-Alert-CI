
import { QueryClient } from "@tanstack/react-query"

/**
 * Client de cache unique et partagé par toute l'application.
 * - staleTime : les données restent "fraîches" 5 min → aucun refetch inutile
 * - gcTime    : le cache survit 30 min → retour sur la page = affichage instantané
 * - retry     : 2 tentatives (backoff exponentiel) avant de déclarer une erreur
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

/* ─── Session admin révoquée : signal transverse ──────────────────────
   Quand axiosAdmin subit un 401 que même la rotation de refresh ne
   résout pas (famille révoquée serveur, cf. api/v1/admin/auth.py N10),
   l'intercepteur purge les tokens. Les requêtes admin en vol échouent
   alors en chaîne. On écoute un événement DOM dédié émis par
   l'intercepteur — plus simple et plus découplé que de coupler
   queryClient au contexte React (le client vit hors de l'arbre).

   L'événement "jobalert:admin-session-revoquee" est écouté par le
   AdminLayout pour afficher le message dédié. */
if (typeof window !== "undefined") {
  window.addEventListener("jobalert:admin-session-revoquee", () => {
    // Purge complète : aucune donnée admin ne doit survivre à une
    // session révoquée (convention prompt §4 "Cache").
    queryClient.clear()
  })
}
