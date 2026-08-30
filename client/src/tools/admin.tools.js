import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

/* Modules API */
import * as dashboardApi from "@/api/admin/adminDashboard.api"
import * as adminsApi from "@/api/admin/adminAdmins.api"
import * as auditApi from "@/api/admin/adminAudit.api"
import * as filieresApi from "@/api/admin/adminFilieres.api"
import * as sourcesApi from "@/api/admin/adminSources.api"
import * as referentialsApi from "@/api/admin/adminReferentials.api"
import * as offersApi from "@/api/admin/adminOffers.api"
import * as subscribersApi from "@/api/admin/adminSubscribers.api"
import * as scrapingApi from "@/api/admin/adminScraping.api"
import * as logsApi from "@/api/admin/adminLogs.api"
import * as contentApi from "@/api/admin/adminContent.api"
import * as settingsApi from "@/api/admin/adminSettings.api"
import * as aiApi from "@/api/admin/adminAi.api"

/* ════════════════════════════════════════════════════════════════════
   Clés de cache TanStack Query — back-office admin
   ════════════════════════════════════════════════════════════════════ */
export const adminKeys = {
  root: ["admin"],
  overview: ["admin", "dashboard", "overview"],
  trends: ["admin", "dashboard", "trends"],
  dashboardRuns: (params) => ["admin", "dashboard", "runs", params],
  admins: (params) => ["admin", "admins", params],
  auditLogs: (params) => ["admin", "audit", params],
  eventLogs: (params) => ["admin", "events", params],
  contacts: (params) => ["admin", "contacts", params],
  filieres: ["admin", "filieres"],
  specialites: (filiereId) => ["admin", "filieres", filiereId, "specialites"],
  sources: ["admin", "sources"],
  referential: (resource) => ["admin", "referentials", resource],
  offers: (params) => ["admin", "offers", params],
  offer: (id) => ["admin", "offers", "detail", id],
  subscribers: (params) => ["admin", "subscribers", params],
  subscriberSends: (id) => ["admin", "subscribers", id, "sends"],
  scrapingStatus: ["admin", "scraping", "status"],
  scrapeRuns: (params) => ["admin", "scraping", "runs", params],
  scrapeRun: (id) => ["admin", "scraping", "runs", "detail", id],
  runLogs: (id) => ["admin", "scraping", "runs", id, "logs"],
  articles: (params) => ["admin", "content", "articles", params],
  categories: ["admin", "content", "categories"],
  series: ["admin", "content", "series"],
  dailyTips: ["admin", "content", "daily-tips"],
  pages: ["admin", "content", "pages"],
  settings: ["admin", "settings"],
  aiKeys: ["admin", "ai", "keys"],
  aiJobs: (params) => ["admin", "ai", "jobs", params],
  aiAlerts: ["admin", "ai", "alerts"],
}

/* ─── Tableau de bord ─── */
export const useDashboardOverview = () =>
  useQuery({ queryKey: adminKeys.overview, queryFn: dashboardApi.fetchDashboardOverview })

export const useDashboardTrends = () =>
  useQuery({ queryKey: adminKeys.trends, queryFn: dashboardApi.fetchDashboardTrends })

export const useDashboardRuns = (params) =>
  useQuery({
    queryKey: adminKeys.dashboardRuns(params),
    queryFn: () => dashboardApi.fetchDashboardRuns(params),
  })

/* ─── Administrateurs ─── */
export const useAdmins = (params) =>
  useQuery({ queryKey: adminKeys.admins(params), queryFn: () => adminsApi.fetchAdmins(params) })

/* ─── Journal d'audit ─── */
export const useAuditLogs = (params) =>
  useQuery({ queryKey: adminKeys.auditLogs(params), queryFn: () => auditApi.fetchAuditLogs(params) })

/* ─── Filières ─── */
export const useFilieres = () =>
  useQuery({ queryKey: adminKeys.filieres, queryFn: filieresApi.fetchFilieres })

export const useSpecialites = (filiereId) =>
  useQuery({
    queryKey: adminKeys.specialites(filiereId),
    queryFn: () => filieresApi.fetchSpecialites(filiereId),
    enabled: Boolean(filiereId),
  })

/* ─── Sources ─── */
export const useSources = () =>
  useQuery({ queryKey: adminKeys.sources, queryFn: sourcesApi.fetchSources })

/* ─── Référentiels secondaires ─── */
export const useReferential = (resource) =>
  useQuery({
    queryKey: adminKeys.referential(resource),
    queryFn: () => referentialsApi.resolveReferentialApi(resource).fetchAll(),
    enabled: Boolean(resource),
  })

/* ─── Offres ─── */
export const useOffers = (params) =>
  useQuery({ queryKey: adminKeys.offers(params), queryFn: () => offersApi.fetchAdminOffers(params) })

export const useOffer = (offerId) =>
  useQuery({
    queryKey: adminKeys.offer(offerId),
    queryFn: () => offersApi.getOfferById(offerId),
    enabled: Boolean(offerId),
  })

/* ─── Abonnés ─── */
export const useSubscribers = (params) =>
  useQuery({ queryKey: adminKeys.subscribers(params), queryFn: () => subscribersApi.fetchSubscribers(params) })

export const useSubscriberSends = (subscriberId) =>
  useQuery({
    queryKey: adminKeys.subscriberSends(subscriberId),
    queryFn: () => subscribersApi.fetchSubscriberSends(subscriberId),
    enabled: Boolean(subscriberId),
  })

export const useSubscriberDetail = (subscriberId) =>
  useQuery({
    queryKey: ["admin", "subscribers", "detail", subscriberId],
    queryFn: () => subscribersApi.getSubscriberById(subscriberId),
    enabled: Boolean(subscriberId),
  })

/* ─── Scraping ─── */
export const useScrapingStatus = (pollMs = 15000) =>
  useQuery({ queryKey: adminKeys.scrapingStatus, queryFn: scrapingApi.fetchScrapingStatus, refetchInterval: pollMs })

export const useScrapeRuns = (params) =>
  useQuery({
    queryKey: adminKeys.scrapeRuns(params),
    queryFn: () => scrapingApi.fetchScrapeRuns(params),
    refetchInterval: params?.poll ? 8000 : false,
  })

export const useScrapeRunDetail = (runId, poll = false) =>
  useQuery({
    queryKey: adminKeys.scrapeRun(runId),
    queryFn: () => scrapingApi.getScrapeRunById(runId),
    enabled: Boolean(runId),
    refetchInterval: poll ? 8000 : false,
  })

export const useRunLogs = (runId) =>
  useQuery({
    queryKey: adminKeys.runLogs(runId),
    queryFn: () => scrapingApi.fetchRunLogs(runId),
    enabled: Boolean(runId),
  })

/* ─── Journaux techniques & contacts ─── */
export const useEventLogs = (params) =>
  useQuery({ queryKey: adminKeys.eventLogs(params), queryFn: () => logsApi.fetchEventLogs(params) })

export const useContacts = (params) =>
  useQuery({ queryKey: adminKeys.contacts(params), queryFn: () => logsApi.fetchContactMessages(params) })

/* ─── Contenu ─── */
export const useArticles = (params) =>
  useQuery({ queryKey: adminKeys.articles(params), queryFn: () => contentApi.fetchArticles(params) })

export const useCategories = () =>
  useQuery({ queryKey: adminKeys.categories, queryFn: contentApi.fetchCategories })

export const useSeries = () =>
  useQuery({ queryKey: adminKeys.series, queryFn: contentApi.fetchSeries })

export const useDailyTips = () =>
  useQuery({ queryKey: adminKeys.dailyTips, queryFn: contentApi.fetchDailyTips })

export const usePages = () =>
  useQuery({ queryKey: adminKeys.pages, queryFn: contentApi.fetchPages })

/* ─── Paramètres ─── */
export const useSettings = () =>
  useQuery({ queryKey: adminKeys.settings, queryFn: settingsApi.fetchSettings })

/* ─── IA ─── */
export const useAiKeys = () =>
  useQuery({ queryKey: adminKeys.aiKeys, queryFn: aiApi.fetchAiKeys })

export const useAiJobs = (params) =>
  useQuery({ queryKey: adminKeys.aiJobs(params), queryFn: () => aiApi.fetchAiJobs(params) })

export const useAiAlerts = () =>
  useQuery({ queryKey: adminKeys.aiAlerts, queryFn: aiApi.fetchAiAlerts })

/* ════════════════════════════════════════════════════════════════════
   Mutations — invalidation automatique des caches concernés
   ════════════════════════════════════════════════════════════════════ */
export const useAdminMutations = () => {
  const queryClient = useQueryClient()

  const invalidate = (...keys) => {
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }))
  }
  const invalidateAll = (...extra) => {
    queryClient.invalidateQueries({ queryKey: ["admin"], ...extra })
  }

  /* Administrateurs */
  const createAdminMutation = useMutation({
    mutationFn: adminsApi.createAdmin,
    onSuccess: () => invalidate(adminKeys.admins()),
  })
  const updateAdminMutation = useMutation({
    mutationFn: ({ id, data }) => adminsApi.updateAdmin(id, data),
    onSuccess: () => invalidate(adminKeys.admins()),
  })
  const updateAdminRoleMutation = useMutation({
    mutationFn: ({ id, role }) => adminsApi.updateAdminRole(id, role),
    onSuccess: () => invalidate(adminKeys.admins()),
  })
  const toggleAdminStatusMutation = useMutation({
    mutationFn: adminsApi.toggleAdminStatus,
    onSuccess: () => invalidate(adminKeys.admins()),
  })
  const deleteAdminMutation = useMutation({
    mutationFn: adminsApi.deleteAdmin,
    onSuccess: () => invalidate(adminKeys.admins()),
  })

  /* Filières */
  const createFiliereMutation = useMutation({
    mutationFn: filieresApi.createFiliere,
    onSuccess: () => invalidate(adminKeys.filieres),
  })
  const updateFiliereMutation = useMutation({
    mutationFn: ({ id, data }) => filieresApi.updateFiliere(id, data),
    onSuccess: () => invalidate(adminKeys.filieres),
  })
  const updateKeywordsMutation = useMutation({
    mutationFn: ({ id, keywords }) => filieresApi.updateFiliereKeywords(id, keywords),
    onSuccess: () => invalidate(adminKeys.filieres),
  })
  const deleteFiliereMutation = useMutation({
    mutationFn: filieresApi.deleteFiliere,
    onSuccess: () => invalidate(adminKeys.filieres),
  })
  const createSpecialiteMutation = useMutation({
    mutationFn: ({ filiereId, data }) => filieresApi.createSpecialite(filiereId, data),
    onSuccess: (_data, vars) => invalidate(adminKeys.specialites(vars.filiereId), adminKeys.filieres),
  })
  const updateSpecialiteMutation = useMutation({
    mutationFn: ({ id, data, filiereId }) => filieresApi.updateSpecialite(id, data).then(() => ({ filiereId })),
    onSuccess: ({ filiereId }) => invalidate(adminKeys.specialites(filiereId), adminKeys.filieres),
  })
  const deleteSpecialiteMutation = useMutation({
    mutationFn: ({ id, filiereId }) => filieresApi.deleteSpecialite(id).then(() => ({ filiereId })),
    onSuccess: ({ filiereId }) => invalidate(adminKeys.specialites(filiereId), adminKeys.filieres),
  })

  /* Sources */
  const createSourceMutation = useMutation({
    mutationFn: sourcesApi.createSource,
    onSuccess: () => invalidate(adminKeys.sources),
  })
  const updateSourceMutation = useMutation({
    mutationFn: ({ id, data }) => sourcesApi.updateSource(id, data),
    onSuccess: () => invalidate(adminKeys.sources),
  })
  const updateSourceStatusMutation = useMutation({
    mutationFn: ({ id, status }) => sourcesApi.updateSourceStatus(id, status),
    onSuccess: () => invalidate(adminKeys.sources, adminKeys.scrapingStatus),
  })
  const deleteSourceMutation = useMutation({
    mutationFn: sourcesApi.deleteSource,
    onSuccess: () => invalidate(adminKeys.sources),
  })

  /* Référentiels génériques — créés pour chaque ressource (règles des hooks :
     pas de useMutation dans une fonction appelée dynamiquement) */
  const makeReferentialMutations = (resource) => {
    const api = referentialsApi.resolveReferentialApi(resource)
    return {
      create: useMutation({
        mutationFn: api.create,
        onSuccess: () => invalidate(adminKeys.referential(resource)),
      }),
      update: useMutation({
        mutationFn: ({ id, data }) => api.update(id, data),
        onSuccess: () => invalidate(adminKeys.referential(resource)),
      }),
      remove: useMutation({
        mutationFn: api.remove,
        onSuccess: () => invalidate(adminKeys.referential(resource)),
      }),
    }
  }
  const referentialMutations = {
    "contract-types": makeReferentialMutations("contract-types"),
    "experience-levels": makeReferentialMutations("experience-levels"),
    "education-levels": makeReferentialMutations("education-levels"),
    locations: makeReferentialMutations("locations"),
  }

  /* Offres */
  const createOfferMutation = useMutation({
    mutationFn: offersApi.createOffer,
    onSuccess: () => invalidateAll(),
  })
  const updateOfferMutation = useMutation({
    mutationFn: ({ id, data }) => offersApi.updateOffer(id, data),
    onSuccess: () => invalidateAll(),
  })
  const updateOfferVisibilityMutation = useMutation({
    mutationFn: ({ id, visible }) => offersApi.updateOfferVisibility(id, visible),
    onSuccess: () => invalidate(adminKeys.offers(), adminKeys.overview),
  })
  const updateOfferStatusMutation = useMutation({
    mutationFn: ({ id, status }) => offersApi.updateOfferStatus(id, status),
    onSuccess: () => invalidate(adminKeys.offers()),
  })
  const deleteOfferMutation = useMutation({
    mutationFn: offersApi.deleteOffer,
    onSuccess: () => invalidate(adminKeys.offers(), adminKeys.overview),
  })
  const bulkStatusMutation = useMutation({
    mutationFn: ({ offerIds, status }) => offersApi.bulkUpdateStatus(offerIds, status),
    onSuccess: () => invalidate(adminKeys.offers()),
  })

  /* Abonnés */
  const updateSubscriberMutation = useMutation({
    mutationFn: ({ id, data }) => subscribersApi.updateSubscriber(id, data),
    onSuccess: () => invalidateAll(),
  })
  const updateSubscriberStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }) => subscribersApi.updateSubscriberStatus(id, status, reason),
    onSuccess: () => invalidateAll(),
  })
  const sendCustomEmailMutation = useMutation({
    mutationFn: ({ id, offerIds, subject }) => subscribersApi.sendCustomEmail(id, offerIds, subject),
    onSuccess: (_d, vars) => invalidate(adminKeys.subscriberSends(vars.id), adminKeys.overview),
  })
  const anonymizeSubscriberMutation = useMutation({
    mutationFn: subscribersApi.anonymizeSubscriber,
    onSuccess: () => invalidate(adminKeys.subscribers(), adminKeys.overview),
  })

  /* Scraping */
  const triggerScrapeMutation = useMutation({
    mutationFn: scrapingApi.triggerScrape,
    onSuccess: () => invalidateAll(),
  })

  /* Contacts */
  const updateContactStatusMutation = useMutation({
    mutationFn: ({ id, status }) => logsApi.updateContactStatus(id, status),
    onSuccess: () => invalidate(adminKeys.contacts()),
  })

  /* Contenu */
  const articleMutations = {
    create: useMutation({ mutationFn: contentApi.createArticle, onSuccess: () => invalidateAll() }),
    update: useMutation({
      mutationFn: ({ id, data }) => contentApi.updateArticle(id, data),
      onSuccess: () => invalidateAll(),
    }),
    updateStatus: useMutation({
      mutationFn: ({ id, status }) => contentApi.updateArticleStatus(id, status),
      onSuccess: () => invalidate(adminKeys.articles()),
    }),
    toggleFeatured: useMutation({
      mutationFn: ({ id, isFeatured, featuredOrder }) =>
        contentApi.toggleArticleFeatured(id, isFeatured, featuredOrder),
      onSuccess: () => invalidate(adminKeys.articles()),
    }),
    remove: useMutation({ mutationFn: contentApi.deleteArticle, onSuccess: () => invalidateAll() }),
    addSection: useMutation({
      mutationFn: ({ articleId, data }) => contentApi.addSection(articleId, data),
      onSuccess: () => invalidateAll(),
    }),
    reorderSections: useMutation({
      mutationFn: ({ articleId, sectionIds }) => contentApi.reorderSections(articleId, sectionIds),
      onSuccess: () => invalidateAll(),
    }),
    deleteSection: useMutation({ mutationFn: contentApi.deleteSection, onSuccess: () => invalidateAll() }),
  }

  const categoryMutations = {
    create: useMutation({ mutationFn: contentApi.createCategory, onSuccess: () => invalidate(adminKeys.categories) }),
    update: useMutation({
      mutationFn: ({ id, data }) => contentApi.updateCategory(id, data),
      onSuccess: () => invalidate(adminKeys.categories),
    }),
    remove: useMutation({
      mutationFn: contentApi.deleteCategory,
      onSuccess: () => invalidate(adminKeys.categories),
    }),
  }

  const seriesMutations = {
    create: useMutation({ mutationFn: contentApi.createSeries, onSuccess: () => invalidate(adminKeys.series) }),
    update: useMutation({
      mutationFn: ({ id, data }) => contentApi.updateSeries(id, data),
      onSuccess: () => invalidate(adminKeys.series),
    }),
    remove: useMutation({ mutationFn: contentApi.deleteSeries, onSuccess: () => invalidate(adminKeys.series) }),
    updateArticles: useMutation({
      mutationFn: ({ id, articleIds }) => contentApi.updateSeriesArticles(id, articleIds),
      onSuccess: () => invalidate(adminKeys.series),
    }),
  }

  const tipMutations = {
    create: useMutation({ mutationFn: contentApi.createDailyTip, onSuccess: () => invalidate(adminKeys.dailyTips) }),
    update: useMutation({
      mutationFn: ({ id, data }) => contentApi.updateDailyTip(id, data),
      onSuccess: () => invalidate(adminKeys.dailyTips),
    }),
    remove: useMutation({
      mutationFn: contentApi.deleteDailyTip,
      onSuccess: () => invalidate(adminKeys.dailyTips),
    }),
  }

  const pageMutations = {
    create: useMutation({ mutationFn: contentApi.createPage, onSuccess: () => invalidate(adminKeys.pages) }),
    update: useMutation({
      mutationFn: ({ id, data }) => contentApi.updatePage(id, data),
      onSuccess: () => invalidate(adminKeys.pages),
    }),
    remove: useMutation({ mutationFn: contentApi.deletePage, onSuccess: () => invalidate(adminKeys.pages) }),
  }

  /* Paramètres */
  const bulkUpdateSettingsMutation = useMutation({
    mutationFn: settingsApi.bulkUpdateSettings,
    onSuccess: () => invalidate(adminKeys.settings),
  })

  /* IA */
  const aiKeyMutations = {
    create: useMutation({ mutationFn: aiApi.createAiKey, onSuccess: () => invalidate(adminKeys.aiKeys) }),
    update: useMutation({
      mutationFn: ({ id, data }) => aiApi.updateAiKey(id, data),
      onSuccess: () => invalidate(adminKeys.aiKeys),
    }),
    remove: useMutation({ mutationFn: aiApi.deleteAiKey, onSuccess: () => invalidate(adminKeys.aiKeys) }),
    test: useMutation({ mutationFn: aiApi.testAiKey }),
  }
  const ackAiAlertMutation = useMutation({
    mutationFn: aiApi.acknowledgeAiAlert,
    onSuccess: () => invalidate(adminKeys.aiAlerts),
  })
  const runAiJobMutation = useMutation({
    mutationFn: aiApi.runAiJob,
    onSuccess: () => invalidate(adminKeys.aiJobs()),
  })

  return {
    // admins
    createAdminMutation,
    updateAdminMutation,
    updateAdminRoleMutation,
    toggleAdminStatusMutation,
    deleteAdminMutation,
    // filieres
    createFiliereMutation,
    updateFiliereMutation,
    updateKeywordsMutation,
    deleteFiliereMutation,
    createSpecialiteMutation,
    updateSpecialiteMutation,
    deleteSpecialiteMutation,
    // sources
    createSourceMutation,
    updateSourceMutation,
    updateSourceStatusMutation,
    deleteSourceMutation,
    // referentiels
    referentialMutations,
    // offres
    createOfferMutation,
    updateOfferMutation,
    updateOfferVisibilityMutation,
    updateOfferStatusMutation,
    deleteOfferMutation,
    bulkStatusMutation,
    // abonnés
    updateSubscriberMutation,
    updateSubscriberStatusMutation,
    sendCustomEmailMutation,
    anonymizeSubscriberMutation,
    // scraping
    triggerScrapeMutation,
    // contacts
    updateContactStatusMutation,
    // contenu
    articleMutations,
    categoryMutations,
    seriesMutations,
    tipMutations,
    pageMutations,
    // paramètres
    bulkUpdateSettingsMutation,
    // IA
    aiKeyMutations,
    ackAiAlertMutation,
    runAiJobMutation,
  }
}





