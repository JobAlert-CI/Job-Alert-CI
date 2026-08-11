// src/lib/queryClient.js
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