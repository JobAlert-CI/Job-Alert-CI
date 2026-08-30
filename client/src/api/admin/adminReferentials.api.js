import adminApi from "./adminAxios"

/**
 * API référentiels secondaires (super_admin) — onglets génériques :
 * contract-types · experience-levels · education-levels · locations.
 * Même composant CRUD réutilisé 4× côté UI.
 */

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

export const REFERENTIAL_TABS = [
  { key: "contract-types", label: "Types de contrat" },
  { key: "experience-levels", label: "Niveaux d'expérience" },
  { key: "education-levels", label: "Niveaux d'études" },
  { key: "locations", label: "Localisations" },
]

const MOCK_REFERENTIALS = {
  "contract-types": [
    { id: "ct-1", code: "CDI", label: "CDI", sort_order: 1, is_active: true },
    { id: "ct-2", code: "CDD", label: "CDD", sort_order: 2, is_active: true },
    { id: "ct-3", code: "stage", label: "Stage", sort_order: 3, is_active: true },
    { id: "ct-4", code: "freelance", label: "Freelance", sort_order: 4, is_active: true },
    { id: "ct-5", code: "interim", label: "Intérim", sort_order: 5, is_active: false },
  ],
  "experience-levels": [
    { id: "xl-1", code: "junior", label: "Junior (0-2 ans)", min_years: 0, max_years: 2, sort_order: 1, is_active: true },
    { id: "xl-2", code: "confirme", label: "Confirmé (3-5 ans)", min_years: 3, max_years: 5, sort_order: 2, is_active: true },
    { id: "xl-3", code: "senior", label: "Senior (6-9 ans)", min_years: 6, max_years: 9, sort_order: 3, is_active: true },
    { id: "xl-4", code: "expert", label: "Expert (10+ ans)", min_years: 10, max_years: null, sort_order: 4, is_active: true },
  ],
  "education-levels": [
    { id: "el-1", code: "bac", label: "Bac", rank: 1, sort_order: 1, is_active: true },
    { id: "el-2", code: "bac+2", label: "Bac+2 (BTS / DUT)", rank: 2, sort_order: 2, is_active: true },
    { id: "el-3", code: "licence", label: "Licence (Bac+3)", rank: 3, sort_order: 3, is_active: true },
    { id: "el-4", code: "maitrise", label: "Maîtrise (Bac+4)", rank: 4, sort_order: 4, is_active: true },
    { id: "el-5", code: "master", label: "Master / Ingénieur (Bac+5)", rank: 5, sort_order: 5, is_active: true },
  ],
  locations: [
    { id: "loc-1", country_code: "CI", city: "Abidjan", district: null, label: "Abidjan", normalized_label: "abidjan", is_remote: false, is_active: true },
    { id: "loc-2", country_code: "CI", city: "Yamoussoukro", district: null, label: "Yamoussoukro", normalized_label: "yamoussoukro", is_remote: false, is_active: true },
    { id: "loc-3", country_code: "CI", city: "Bouaké", district: null, label: "Bouaké", normalized_label: "bouake", is_remote: false, is_active: true },
    { id: "loc-4", country_code: "CI", city: "San-Pédro", district: null, label: "San-Pédro", normalized_label: "san-pedro", is_remote: false, is_active: true },
    { id: "loc-5", country_code: "CI", city: "Télétravail", district: null, label: "Télétravail", normalized_label: "teletravail", is_remote: true, is_active: true },
  ],
}

const buildResource = (resource) => ({
  fetchAll: async () => {
    try {
      const { data } = await adminApi.get(`/referentials/${resource}`)
      return data
    } catch (error) {
      if (error?.response) throw error
      await delay()
      return [...(MOCK_REFERENTIALS[resource] || [])]
    }
  },
  create: async (payload) => {
    const { data } = await adminApi.post(`/referentials/${resource}`, payload)
    return data
  },
  update: async (itemId, payload) => {
    const { data } = await adminApi.put(`/referentials/${resource}/${itemId}`, payload)
    return data
  },
  remove: async (itemId) => {
    await adminApi.delete(`/referentials/${resource}/${itemId}`)
  },
})

/* Instances réutilisées par l'onglet générique */
export const contractTypesApi = buildResource("contract-types")
export const experienceLevelsApi = buildResource("experience-levels")
export const educationLevelsApi = buildResource("education-levels")
export const locationsApi = buildResource("locations")

/** Résout l'instance CRUD d'un onglet référentiel par sa clé. */
export const resolveReferentialApi = (resource) => {
  switch (resource) {
    case "contract-types":
      return contractTypesApi
    case "experience-levels":
      return experienceLevelsApi
    case "education-levels":
      return educationLevelsApi
    case "locations":
      return locationsApi
    default:
      throw new Error(`Référentiel inconnu : ${resource}`)
  }
}

