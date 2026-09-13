/* ─────────────────────────────────────────────────────────────────────
   Utilitaires du formulaire, hors du corps du composant pour ne pas
   être recréés à chaque rendu.
───────────────────────────────────────────────────────────────────── */

/* Valeurs initiales à partir d'une offre existante (édition) ou d'un
   objet vide (création). Sert de `defaultValues` à react-hook-form :
   indispensable pour que `isDirty` fonctionne en mode édition. */
export const valeursInitiales = (offre) => ({
  title: offre?.title ?? "",
  company_name: offre?.company?.name ?? "",
  source_code: offre?.source?.code ?? "",
  source_url: offre?.source_url ?? "",
  source_reference: offre?.source_reference ?? "",
  filiere_code: offre?.primary_filiere?.code ?? "",
  contract_type_code: offre?.contract_type?.code ?? "",
  experience_level_code: offre?.experience_level?.code ?? "",
  education_level_code: offre?.education_level?.code ?? "",
  location_label: offre?.location?.label ?? "",
  salary_raw: offre?.salary_raw ?? "",
  intro: offre?.detail?.intro ?? "",
  published_at: offre?.published_at ? offre.published_at.slice(0, 10) : "",
  missions: offre?.detail?.missions ?? [],
  profile_requirements: offre?.detail?.profile_requirements ?? [],
  benefits: offre?.detail?.benefits ?? [],
  tags: offre?.detail?.tags ?? [],
})

/* Nettoie une liste de chaînes : retire les entrées vides et les espaces. */
const listesPropres = (liste) => (liste ?? []).map((v) => v.trim()).filter(Boolean)

/* Construit le payload OfferCreate / OfferUpdate depuis les valeurs du
   formulaire : codes référentiel, listes nettoyées, chaînes vides → null,
   dates en ISO. Exactement le contrat attendu par le serveur. */
export const construirePayload = (valeurs) => ({
  title: valeurs.title.trim(),
  company_name: valeurs.company_name.trim(),
  source_code: valeurs.source_code,
  source_url: valeurs.source_url.trim(),
  source_reference: valeurs.source_reference?.trim() || null,
  filiere_code: valeurs.filiere_code || null,
  contract_type_code: valeurs.contract_type_code || null,
  experience_level_code: valeurs.experience_level_code || null,
  education_level_code: valeurs.education_level_code || null,
  location_label: valeurs.location_label?.trim() || null,
  salary_raw: valeurs.salary_raw?.trim() || null,
  intro: valeurs.intro?.trim() || null,
  published_at: valeurs.published_at ? new Date(valeurs.published_at).toISOString() : null,
  missions: listesPropres(valeurs.missions),
  profile_requirements: listesPropres(valeurs.profile_requirements),
  benefits: listesPropres(valeurs.benefits),
  tags: listesPropres(valeurs.tags),
})