export { default as api } from "./axiosInstance";
export { default as adminApi } from "./admin/axiosAdmin";
export * from "./errors";
export { cleanParams } from "./utils";

export * as articlesApi from "./public/articles";
export * as contactApi from "./public/contact";
export * as filieresApi from "./public/filieres";
export * as offersApi from "./public/offers";
export * as referentialsApi from "./public/referentials";
export * as seoApi from "./public/seo";
export * as sourcesApi from "./public/sources";
export * as statsApi from "./public/stats";
export * as subscriptionsApi from "./public/subscriptions";

/* Back-office admin : chaque module cible un domaine du back-office
   (cf. server/api/v1/admin/ pour la reference des routes). */
export * as adminAuthApi from "./admin/auth";
export * as adminDashboardApi from "./admin/dashboard";
export * as adminOffersApi from "./admin/offers";
export * as adminSubscribersApi from "./admin/subscribers";
export * as adminSendingApi from "./admin/sending";
export * as adminScrapingApi from "./admin/scraping";
export * as adminCompaniesApi from "./admin/companies";
export * as adminReferentialsApi from "./admin/referentials";
export * as adminContentApi from "./admin/content";
export * as adminAdminsApi from "./admin/admins";
export * as adminLogsApi from "./admin/logs";
export * as adminSettingsApi from "./admin/settings";
export * as adminAiApi from "./admin/ai";
export * as adminSystemApi from "./admin/system";
