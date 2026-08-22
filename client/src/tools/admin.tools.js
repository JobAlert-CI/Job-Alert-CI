import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchAllLogs, fetchAuditLogs, fetchEventLogs } from "@/api/admin/adminLogs.api"
import { fetchScrapeRuns, fetchScrapingStatus, triggerScrape, updateScraperSchedule } from "@/api/admin/adminScraping.api"
import {
  deleteAdmin,
  fetchAdmins,
  fetchSubscribers,
  promoteUserToAdmin,
  updateAdminPermissions,
  updateSubscriberStatus,
} from "@/api/admin/adminUsers.api"
import {
  createOffer,
  deleteOffer,
  fetchAdminOffers,
  updateOffer,
  updateOfferStatus,
  updateOfferVisibility,
} from "@/api/admin/adminOffers.api"
import {
  createFiliere,
  createSource,
  deleteFiliere,
  deleteSource,
  fetchAdminFilieres,
  fetchAdminSources,
  updateFiliere,
  updateFiliereKeywords,
  updateSource,
  updateSourceStatus,
} from "@/api/admin/adminReferentials.api"

/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE TANSTACK QUERY ADMIN
════════════════════════════════════════════════════════════════════ */
export const adminKeys = {
  root: ["admin"],
  stats: ["admin", "stats"],
  logs: (params) => ["admin", "logs", params],
  scrapers: ["admin", "scrapers"],
  scrapeRuns: (params) => ["admin", "scrapeRuns", params],
  subscribers: (params) => ["admin", "subscribers", params],
  admins: (params) => ["admin", "admins", params],
  offers: (params) => ["admin", "offers", params],
  sources: ["admin", "sources"],
  filieres: ["admin", "filieres"],
}

/* ─── Hooks de Lecture ─── */

export const useAdminLogs = (params = {}) =>
  useQuery({
    queryKey: adminKeys.logs(params),
    queryFn: () => fetchAllLogs(params),
  })

export const useAdminAuditLogs = (params = {}) =>
  useQuery({
    queryKey: ["admin", "logs", "audit", params],
    queryFn: () => fetchAuditLogs(params),
  })

export const useAdminEventLogs = (params = {}) =>
  useQuery({
    queryKey: ["admin", "logs", "events", params],
    queryFn: () => fetchEventLogs(params),
  })

export const useAdminScrapers = () =>
  useQuery({
    queryKey: adminKeys.scrapers,
    queryFn: fetchScrapingStatus,
    refetchInterval: 15000, // rafraîchissement doux
  })

export const useAdminScrapeRuns = (params = {}) =>
  useQuery({
    queryKey: adminKeys.scrapeRuns(params),
    queryFn: () => fetchScrapeRuns(params),
  })

export const useAdminSubscribers = (params = {}) =>
  useQuery({
    queryKey: adminKeys.subscribers(params),
    queryFn: () => fetchSubscribers(params),
  })

export const useAdminAdmins = (params = {}) =>
  useQuery({
    queryKey: adminKeys.admins(params),
    queryFn: () => fetchAdmins(params),
  })

export const useAdminOffers = (params = {}) =>
  useQuery({
    queryKey: adminKeys.offers(params),
    queryFn: () => fetchAdminOffers(params),
  })

export const useAdminSources = () =>
  useQuery({
    queryKey: adminKeys.sources,
    queryFn: fetchAdminSources,
  })

export const useAdminFilieres = () =>
  useQuery({
    queryKey: adminKeys.filieres,
    queryFn: fetchAdminFilieres,
  })

/* ─── Mutations globales ─── */

export const useAdminMutations = () => {
  const queryClient = useQueryClient()

  const invalidate = (...keys) => {
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }))
  }

  // Scraping
  const triggerScrapeMutation = useMutation({
    mutationFn: triggerScrape,
    onSuccess: () => {
      invalidate(adminKeys.scrapers, ["admin", "scrapeRuns"], ["admin", "logs"], adminKeys.offers)
    },
  })

  const updateScheduleMutation = useMutation({
    mutationFn: ({ sourceCode, data }) => updateScraperSchedule(sourceCode, data),
    onSuccess: () => invalidate(adminKeys.scrapers, ["admin", "logs"]),
  })

  // Users & Admins
  const promoteUserMutation = useMutation({
    mutationFn: promoteUserToAdmin,
    onSuccess: () => invalidate(adminKeys.admins, adminKeys.subscribers, ["admin", "logs"]),
  })

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ adminId, data }) => updateAdminPermissions(adminId, data),
    onSuccess: () => invalidate(adminKeys.admins, ["admin", "logs"]),
  })

  const deleteAdminMutation = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: () => invalidate(adminKeys.admins, ["admin", "logs"]),
  })

  const updateSubscriberStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSubscriberStatus(id, status),
    onSuccess: () => invalidate(adminKeys.subscribers, ["admin", "logs"]),
  })

  // Offres
  const createOfferMutation = useMutation({
    mutationFn: createOffer,
    onSuccess: () => invalidate(adminKeys.offers, ["admin", "logs"]),
  })

  const updateOfferMutation = useMutation({
    mutationFn: ({ id, data }) => updateOffer(id, data),
    onSuccess: () => invalidate(adminKeys.offers, ["admin", "logs"]),
  })

  const updateOfferStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateOfferStatus(id, status),
    onSuccess: () => invalidate(adminKeys.offers, ["admin", "logs"]),
  })

  const updateOfferVisibilityMutation = useMutation({
    mutationFn: ({ id, visible }) => updateOfferVisibility(id, visible),
    onSuccess: () => invalidate(adminKeys.offers, ["admin", "logs"]),
  })

  const deleteOfferMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => invalidate(adminKeys.offers, ["admin", "logs"]),
  })

  // Sources
  const createSourceMutation = useMutation({
    mutationFn: createSource,
    onSuccess: () => invalidate(adminKeys.sources, ["admin", "logs"]),
  })

  const updateSourceMutation = useMutation({
    mutationFn: ({ id, data }) => updateSource(id, data),
    onSuccess: () => invalidate(adminKeys.sources, ["admin", "logs"]),
  })

  const updateSourceStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSourceStatus(id, status),
    onSuccess: () => invalidate(adminKeys.sources, adminKeys.scrapers, ["admin", "logs"]),
  })

  const deleteSourceMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => invalidate(adminKeys.sources, ["admin", "logs"]),
  })

  // Filières
  const createFiliereMutation = useMutation({
    mutationFn: createFiliere,
    onSuccess: () => invalidate(adminKeys.filieres, ["admin", "logs"]),
  })

  const updateFiliereMutation = useMutation({
    mutationFn: ({ id, data }) => updateFiliere(id, data),
    onSuccess: () => invalidate(adminKeys.filieres, ["admin", "logs"]),
  })

  const updateKeywordsMutation = useMutation({
    mutationFn: ({ id, keywords }) => updateFiliereKeywords(id, keywords),
    onSuccess: () => invalidate(adminKeys.filieres, ["admin", "logs"]),
  })

  const deleteFiliereMutation = useMutation({
    mutationFn: deleteFiliere,
    onSuccess: () => invalidate(adminKeys.filieres, ["admin", "logs"]),
  })

  return {
    triggerScrapeMutation,
    updateScheduleMutation,
    promoteUserMutation,
    updatePermissionsMutation,
    deleteAdminMutation,
    updateSubscriberStatusMutation,
    createOfferMutation,
    updateOfferMutation,
    updateOfferStatusMutation,
    updateOfferVisibilityMutation,
    deleteOfferMutation,
    createSourceMutation,
    updateSourceMutation,
    updateSourceStatusMutation,
    deleteSourceMutation,
    createFiliereMutation,
    updateFiliereMutation,
    updateKeywordsMutation,
    deleteFiliereMutation,
  }
}
