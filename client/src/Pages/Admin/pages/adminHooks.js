/**
 * Adaptateur local des hooks admin — nommage court utilisé par les pages.
 * Toute la logique (cache, invalidations, fallback démo) vit dans tools/admin.tools.js.
 */
import {
  useAdmins,
  useAdminMutations,
  useAuditLogs,
  useFilieres,
  useSources,
  useOffers,
  useSubscribers,
  useReferential,
  useSubscriberDetail,
  useSubscriberSends,
  useScrapingStatus,
  useScrapeRuns,
  useScrapeRunDetail,
  useRunLogs,
  useSettings,
  useAiKeys,
  useAiJobs,
  useAiAlerts,
  useArticles,
  useCategories,
  useSeries,
  useDailyTips,
  usePages,
  useEventLogs,
  useContacts,
} from "@/tools/admin.tools"
import { useOffer } from "@/tools/admin.tools"

export const useAdminAdminsSafe = useAdmins
export const useAdminsSafe = useAdmins
export const useSafeMutations = useAdminMutations
export const useAuditLogsSafe = useAuditLogs
export const useFilieresSafe = useFilieres
export const useSourcesSafe = useSources
export const useOffersSafe = useOffers
export const useSubscribersSafe = useSubscribers
export const useReferentialSafe = useReferential
export const useOfferSafe = useOffer
export const useSubscriberDetailSafe = useSubscriberDetail
export const useSubscriberSendsSafe = useSubscriberSends
export const useScrapingStatusSafe = useScrapingStatus
export const useScrapeRunsSafe = useScrapeRuns
export const useRunDetailSafe = useScrapeRunDetail
export const useRunLogsSafe = useRunLogs
export const useSettingsSafe = useSettings
export const useAiKeysSafe = useAiKeys
export const useAiJobsSafe = useAiJobs
export const useAiAlertsSafe = useAiAlerts
export const useArticlesSafe = useArticles
export const useCategoriesSafe = useCategories
export const useSeriesSafe = useSeries
export const useDailyTipsSafe = useDailyTips
export const usePagesSafe = usePages
export const useEventLogsSafe = useEventLogs
export const useContactsSafe = useContacts

/* Alias direct : plusieurs pages importent le hook de mutations sous son nom d'origine */
export { useAdminMutations }

