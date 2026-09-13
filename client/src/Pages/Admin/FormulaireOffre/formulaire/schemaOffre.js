import { z } from "zod"

/* ─────────────────────────────────────────────────────────────────────
   Schéma de validation du formulaire d'offre.
   Remplace la logique manuelle `requisComplets` : les règles du
   contrat serveur (schemas/offers.py) sont encodées ici et appliquées
   en temps réel par zodResolver.
   - requis : title (2-300), company_name (1-255), source_code, source_url
   - optionnels : le reste (chaîne vide autorisée, convertie en null
     au moment du payload — voir construirePayload).
───────────────────────────────────────────────────────────────────── */
export const schemaOffre = z.object({
  title: z
    .string()
    .min(2, "Le titre doit contenir au moins 2 caractères.")
    .max(300, "300 caractères maximum."),
  company_name: z
    .string()
    .min(1, "Le nom de l'entreprise est requis.")
    .max(255, "255 caractères maximum."),
  source_code: z.string().min(1, "La source est requise."),
  source_url: z
    .string()
    .min(5, "L'URL est trop courte.")
    .max(1000, "1000 caractères maximum.")
    .url("L'URL est invalide."),
  source_reference: z.string().max(255).optional(),
  filiere_code: z.string().optional(),
  contract_type_code: z.string().optional(),
  experience_level_code: z.string().optional(),
  education_level_code: z.string().optional(),
  location_label: z.string().max(255).optional(),
  salary_raw: z.string().max(255).optional(),
  published_at: z.string().optional(),
  intro: z.string().optional(),
  missions: z.array(z.string()),
  profile_requirements: z.array(z.string()),
  benefits: z.array(z.string()),
  tags: z.array(z.string()),
})