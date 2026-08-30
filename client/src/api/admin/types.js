/**
 * JobAlert CI — Types & enums de l'API admin (S7).
 *
 * Le projet est en JavaScript : les schémas backend (Pydantic) sont
 * transcrits ici en constantes d'enum + typedefs JSDoc, ce qui donne
 * l'autocomplétion et la vérification dans l'IDE sans étape de build TS.
 */

/** @typedef {"super_admin" | "gestionnaire_offres" | "gestionnaire_utilisateurs" | "moderateur"} AdminRole */

export const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: "super_admin",
  OFFER_MANAGER: "gestionnaire_offres",
  USER_MANAGER: "gestionnaire_utilisateurs",
  MODERATOR: "moderateur",
});

export const ADMIN_ROLE_LABELS = Object.freeze({
  super_admin: "Super administrateur",
  gestionnaire_offres: "Gestionnaire d'offres",
  gestionnaire_utilisateurs: "Gestionnaire d'utilisateurs",
  moderateur: "Modérateur",
});

/** @typedef {"creation" | "modification" | "suppression" | "envoi" | "connexion" | "scraping"} AdminAction */
export const ADMIN_ACTIONS = Object.freeze([
  "creation",
  "modification",
  "suppression",
  "envoi",
  "connexion",
  "scraping",
]);

export const ADMIN_ACTION_LABELS = Object.freeze({
  creation: "Création",
  modification: "Modification",
  suppression: "Suppression",
  envoi: "Envoi",
  connexion: "Connexion",
  scraping: "Scraping",
});

/** @typedef {"active" | "expired" | "filled" | "archived" | "duplicate" | "hidden"} OfferStatus */
export const OFFER_STATUSES = Object.freeze([
  "active",
  "expired",
  "filled",
  "archived",
  "duplicate",
  "hidden",
]);

export const OFFER_STATUS_LABELS = Object.freeze({
  active: "Active",
  expired: "Expirée",
  filled: "Pourvue",
  archived: "Archivée",
  duplicate: "Doublon",
  hidden: "Masquée",
});

/** @typedef {"scraping" | "manual" | "import"} OfferOrigin */
export const OFFER_ORIGINS = Object.freeze(["scraping", "manual", "import"]);

/** @typedef {"active" | "unsubscribed" | "bouncing" | "paused" | "pending" | "deleted"} SubscriberStatus */
export const SUBSCRIBER_STATUSES = Object.freeze([
  "active",
  "unsubscribed",
  "bouncing",
  "paused",
  "pending",
  "deleted",
]);

export const SUBSCRIBER_STATUS_LABELS = Object.freeze({
  active: "Actif",
  unsubscribed: "Désabonné",
  bouncing: "Rebond",
  paused: "En pause",
  pending: "En attente",
  deleted: "Anonymisé",
});

/** @typedef {"active" | "paused" | "error" | "disabled"} SourceStatus */
export const SOURCE_STATUSES = Object.freeze(["active", "paused", "error", "disabled"]);

export const SOURCE_STATUS_LABELS = Object.freeze({
  active: "Active",
  paused: "En pause",
  error: "En erreur",
  disabled: "Désactivée",
});

/** @typedef {"pending" | "running" | "success" | "partial_failure" | "failed"} ScrapeRunStatus */
export const SCRAPE_RUN_STATUSES = Object.freeze([
  "pending",
  "running",
  "success",
  "partial_failure",
  "failed",
]);

/** @typedef {"info" | "warning" | "error"} LogLevel */
export const LOG_LEVELS = Object.freeze(["info", "warning", "error"]);

/** @typedef {"draft" | "published" | "archived"} ContentStatus */
export const CONTENT_STATUSES = Object.freeze(["draft", "published", "archived"]);

export const CONTENT_STATUS_LABELS = Object.freeze({
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
});

/** @typedef {"new" | "read" | "replied" | "archived" | "spam"} ContactStatus */
export const CONTACT_STATUSES = Object.freeze(["new", "read", "replied", "archived", "spam"]);

export const CONTACT_STATUS_LABELS = Object.freeze({
  new: "Nouveau",
  read: "Lu",
  replied: "Répondu",
  archived: "Archivé",
  spam: "Spam",
});

/* ════════════════════════════════════════════════════════════════
   Matrice rôles → pages visibles (sidebar + gardes de route)
   ════════════════════════════════════════════════════════════════ */
export const ROLE_PAGES = Object.freeze({
  super_admin: "*",
  gestionnaire_offres: ["/admin", "/admin/offres"],
  gestionnaire_utilisateurs: ["/admin", "/admin/utilisateurs"],
  moderateur: ["/admin", "/admin/contenu"],
});

/**
 * Vérifie qu'un rôle peut accéder à un chemin /admin donné.
 * @param {AdminRole} role
 * @param {string} path chemin commençant par /admin
 * @returns {boolean}
 */
export const roleCanAccess = (role, path) => {
  if (!role) return false;
  const allowed = ROLE_PAGES[role];
  if (!allowed) return false;
  if (allowed === "*") return true;
  if (allowed.includes(path)) return true;
  // Les sous-routes héritent du droit de la page parente :
  // /admin/utilisateurs/:id, /admin/utilisateurs/:id/envoyer, /admin/scraping/runs/:id…
  return allowed.some((base) => base !== "/admin" && (path === base || path.startsWith(`${base}/`)));
};

/**
 * Un rôle voit-il un item de navigation ?
 * @param {AdminRole|null} role
 * @param {string[] | "*"} roles liste des rôles autorisés pour l'item
 */
export const roleMatches = (role, roles) =>
  roles === "*" || (Array.isArray(roles) && roles.includes(role));

/* ─── Typedefs des schémas API (miroir des modèles Pydantic) ─── */

/**
 * @typedef {Object} TokenRead
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {string} admin_id
 * @property {AdminRole} role
 */

/**
 * @typedef {Object} AdminRead
 * @property {string} id
 * @property {string} email
 * @property {string} full_name
 * @property {AdminRole} role
 * @property {boolean} is_active
 * @property {string|null} last_login_at
 * @property {string|null} created_at
 */

/**
 * @typedef {Object} DashboardOverviewRead
 * @property {number} offers_total
 * @property {number} offers_active
 * @property {number} subscribers_total
 * @property {number} subscribers_active
 * @property {number} contact_messages_new
 * @property {number} sources_active
 * @property {string|null} last_scrape_run_at
 * @property {ScrapeRunStatus|null} last_scrape_status
 * @property {number} pending_digests
 */

/**
 * @typedef {Object} SourceRead
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string} slug
 * @property {string} base_url
 * @property {string|null} logo_path
 * @property {string|null} color_hex
 * @property {SourceStatus} status
 * @property {number} priority
 * @property {boolean} supports_scraping
 * @property {number} anti_scraping_level
 * @property {string|null} default_scan_time
 * @property {string|null} description
 * @property {boolean} is_primary
 */

/**
 * @typedef {Object} FiliereSpecialtyRead
 * @property {string} id
 * @property {string} code
 * @property {string} label
 * @property {number} sort_order
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} FiliereRead
 * @property {string} id
 * @property {string} code
 * @property {string} label
 * @property {string} slug
 * @property {string|null} hue
 * @property {string|null} tagline
 * @property {string|null} description
 * @property {number} sort_order
 * @property {boolean} is_active
 * @property {FiliereSpecialtyRead[]} specialties
 */

/**
 * @typedef {Object} ContractTypeRead
 * @property {string} id
 * @property {string} code
 * @property {string} label
 * @property {number} sort_order
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} ExperienceLevelRead
 * @property {string} id
 * @property {string} code
 * @property {string} label
 * @property {number|null} min_years
 * @property {number|null} max_years
 * @property {number} sort_order
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} EducationLevelRead
 * @property {string} id
 * @property {string} code
 * @property {string} label
 * @property {number|null} rank
 * @property {number} sort_order
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} LocationRead
 * @property {string} id
 * @property {string} country_code
 * @property {string} city
 * @property {string|null} district
 * @property {string} label
 * @property {boolean} is_remote
 * @property {boolean} is_active
 */

/**
 * @typedef {Object} CompanyRead
 * @property {string} id
 * @property {string} name
 * @property {string} normalized_name
 */

/**
 * @typedef {Object} OfferDetailRead
 * @property {string|null} intro
 * @property {string[]|null} missions
 * @property {string[]|null} profile_requirements
 * @property {string[]|null} benefits
 * @property {string[]|null} tags
 */

/**
 * @typedef {Object} OfferRead
 * @property {string} id
 * @property {string} title
 * @property {OfferStatus} status
 * @property {OfferOrigin} origin
 * @property {boolean} visible_site
 * @property {string|null} source_url
 * @property {string|null} location_raw
 * @property {string|null} salary_raw
 * @property {string|null} published_at
 * @property {string|null} expires_at
 * @property {string|null} application_deadline_at
 * @property {string} collected_at
 * @property {CompanyRead|null} company
 * @property {SourceRead|null} source
 * @property {LocationRead|null} location
 * @property {FiliereRead|null} primary_filiere
 * @property {ContractTypeRead|null} contract_type
 * @property {ExperienceLevelRead|null} experience_level
 * @property {EducationLevelRead|null} education_level
 * @property {OfferDetailRead|null} detail
 */

/**
 * @typedef {Object} SubscriberRead
 * @property {string} id
 * @property {string} email
 * @property {string|null} full_name
 * @property {string|null} city
 * @property {SubscriberStatus} status
 * @property {boolean} wants_career_tips
 * @property {string|null} admin_notes
 * @property {string|null} source
 * @property {string} subscribed_at
 * @property {{ id: string, filiere_id: string, priority: number }[]} filiere_links
 */

/**
 * @typedef {Object} EmailDigestRead
 * @property {string} id
 * @property {string} subscriber_id
 * @property {string} digest_date
 * @property {string} status
 * @property {string|null} subject
 * @property {number} offer_count
 * @property {string|null} sent_at
 */

/**
 * @typedef {Object} SourceScrapeRunRead
 * @property {string} id
 * @property {string} source_id
 * @property {ScrapeRunStatus} status
 * @property {string|null} started_at
 * @property {string|null} finished_at
 * @property {number|null} duration_ms
 * @property {number} raw_count
 * @property {number} inserted_count
 * @property {number} updated_count
 * @property {number} duplicate_count
 * @property {number} error_count
 * @property {string|null} error_message
 */

/**
 * @typedef {Object} ScrapeRunRead
 * @property {string} id
 * @property {string} run_date
 * @property {ScrapeRunStatus} status
 * @property {string|null} started_at
 * @property {string|null} finished_at
 * @property {string} triggered_by
 * @property {number} total_raw
 * @property {number} total_inserted
 * @property {number} total_updated
 * @property {number} total_duplicates
 * @property {number} total_errors
 * @property {string|null} notes
 * @property {SourceScrapeRunRead[]} source_runs
 */

/**
 * @typedef {Object} ScrapingStatusRead
 * @property {string} source_code
 * @property {string} source_name
 * @property {string|null} last_run_at
 * @property {ScrapeRunStatus|null} last_status
 * @property {number|null} last_duration_ms
 * @property {string|null} last_error
 * @property {number} total_runs
 */

/**
 * @typedef {Object} AdminActionLogRead
 * @property {string} id
 * @property {string} admin_id
 * @property {AdminAction} action
 * @property {string} target_table
 * @property {string|null} target_id
 * @property {Object|null} details
 * @property {string} created_at
 */

/**
 * @typedef {Object} EventLogRead
 * @property {string} id
 * @property {string} module
 * @property {LogLevel} niveau
 * @property {string} action
 * @property {string|null} offer_id
 * @property {string|null} source_scrape_run_id
 * @property {string|null} raw_url
 * @property {string|null} message
 * @property {string} created_at
 */

/**
 * @typedef {Object} ContactMessageAdminRead
 * @property {string} id
 * @property {string} full_name
 * @property {string} email
 * @property {string} subject_label
 * @property {string} message
 * @property {ContactStatus} status
 * @property {string|null} replied_at
 * @property {string} created_at
 */

/**
 * @typedef {Object} SiteSettingRead
 * @property {string} key
 * @property {string} value
 * @property {string|null} description
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ArticleListItem
 * @property {string} id
 * @property {string|null} slug
 * @property {string|null} title
 * @property {string|null} excerpt
 * @property {ContentStatus|null} status
 * @property {boolean} is_featured
 * @property {number} view_count
 * @property {string|null} published_at
 * @property {string|null} category_id
 */

/**
 * @typedef {Object} ContentPageRead
 * @property {string} id
 * @property {string} content_type
 * @property {string} slug
 * @property {string} title
 * @property {string|null} excerpt
 * @property {Object|Array|null} body
 * @property {ContentStatus} status
 * @property {string|null} seo_title
 * @property {string|null} seo_description
 * @property {string[]|null} keywords
 */

/**
 * @typedef {Object} DailyTipRead
 * @property {string} id
 * @property {string} text
 * @property {number} rotation_order
 * @property {boolean} is_active
 * @property {string|null} category_id
 */

/** Clé IA (page /admin/ia, backend à venir). */
/**
 * @typedef {Object} AiKeyRead
 * @property {string} id
 * @property {string} provider
 * @property {string|null} label
 * @property {string} api_key_masked
 * @property {number} priority
 * @property {boolean} is_active
 */

