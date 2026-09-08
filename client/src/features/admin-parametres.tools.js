import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getSettings, updateSetting, bulkUpdateSettings } from "@/api/admin/settings"
import { formatApiError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Page Paramètres du site (/admin/parametres) — hooks TanStack (cycle 18,
   doc v3 §18).

   super_admin uniquement. GET /settings renvoie TOUT (pas de pagination,
   table petite) → filtres/recherche LOCAUX, pas de Context URL.

   Cycle 18 serveur (feu vert) : les paramètres sont désormais CONSOMMÉS
   au runtime (services/site_settings_service.py) — la valeur admin
   prévaut sur l'environnement, une valeur invalide retombe sur l'env
   sans crash métier. La page a donc un effet RÉEL sur le site.

   Validation par type de clé (miroir des bornes serveur) :
   - booléennes → Switch ; numériques bornées → input number ;
   - texte ≤ 10000 ; clé ≤ 100, description ≤ 500 (422 sinon).

   Mutations :
   - PUT /{key} (upsert transparent : jamais distinguer créer/modifier) ;
   - POST /bulk { [key]: value } pour la sauvegarde groupée.

   Cache : référentiel quasi-statique → staleTime 5 min, invalidation
   agressive après chaque mutation (liste + les consommateurs runtime
   n'ont pas d'autre cache côté admin).
   ───────────────────────────────────────────────────────────────────── */

export const adminParametresKeys = {
  root: ["admin", "parametres"],
  liste: ["admin", "parametres", "liste"],
}

/* ─── Types de clés (validation front, miroir serveur) ──────────────── */

/** Clés booléennes → rendu Switch. */
export const CLES_BOOLEENNES = new Set(["email_confirmation_required"])

/** Clés numériques bornées → rendu input number (bornes = validation serveur). */
export const CLES_NUMERIQUES = {
  confirm_email_token_ttl_hours: { min: 1, max: 720 },
}

/**
 * Type d'une clé : "booleen" | "nombre" | "texte" — pilote le rendu
 * et la validation du champ inline.
 */
export const typeCle = (cle) => {
  if (CLES_BOOLEENNES.has(cle)) return "booleen"
  if (CLES_NUMERIQUES[cle]) return "nombre"
  return "texte"
}

/**
 * Valide une valeur AVANT l'envoi (le serveur valide aussi — 422 attendu
 * si contourné). Renvoie un message d'erreur ou null si valide.
 */
export const validerValeur = (cle, valeur) => {
  const type = typeCle(cle)
  if (type === "booleen") {
    return ["true", "false"].includes(String(valeur).trim().toLowerCase())
      ? null
      : "Valeur booléenne attendue (true / false)"
  }
  if (type === "nombre") {
    const n = Number(valeur)
    const { min, max } = CLES_NUMERIQUES[cle]
    if (!Number.isFinite(n) || !Number.isInteger(n))
      return "Nombre entier attendu"
    if (n < min || n > max) return `Entre ${min} et ${max} attendu`
    return null
  }
  if (String(valeur).length > 10000) return "10 000 caractères maximum"
  return null
}

/**
 * Normalise la valeur avant envoi : booléen → "true"/"false", nombre →
 * chaîne entière (le serveur stocke du texte).
 */
export const normaliserValeur = (cle, valeur) => {
  if (typeCle(cle) === "booleen") return String(valeur).toLowerCase()
  if (typeCle(cle) === "nombre") return String(parseInt(valeur, 10))
  return String(valeur)
}

/* ─── Groupes par préfixe (rendu en sections) ──────────────────────── */

/** Préfixe clé → libellé de groupe (ordre d'affichage). */
export const GROUPES_PARAMETRES = [
  { prefixe: "email_confirmation_", libelle: "Confirmation d'email" },
  { prefixe: "confirm_email_", libelle: "Confirmation d'email" },
  { prefixe: "email_from_", libelle: "Expéditeur" },
  { prefixe: "support_", libelle: "Support" },
]

/** Groupe d'affichage d'une clé (fallback « Autres »). */
export const groupeDe = (cle) =>
  GROUPES_PARAMETRES.find((g) => cle.startsWith(g.prefixe))?.libelle ?? "Autres paramètres"

/* ─── Erreurs ──────────────────────────────────────────────────────── */

/** Message d'erreur lisible — formatApiError obligatoire (422 = tableau). */
export const messageErreurParametres = (err) => formatApiError(err) || "Action impossible"

/* ─── Queries ──────────────────────────────────────────────────────── */

/** Liste complète des paramètres (petite table, requête unique). */
export const useParametresQuery = () =>
  useQuery({
    queryKey: adminParametresKeys.liste,
    queryFn: ({ signal }) => getSettings({ signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/* ─── Mutations ─────────────────────────────────────────────────────── */

/** Invalide la liste après toute écriture. */
const _invalider = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: adminParametresKeys.root })

/** Sauvegarde UNE clé (upsert : création et modification identiques). */
export const useSauvegarderParametre = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cle, valeur, description }) => updateSetting(cle, { value: valeur, description }),
    onSuccess: () => _invalider(queryClient),
  })
}

/** Sauvegarde groupée { [cle]: valeur } — barre « Enregistrer tout ». */
export const useSauvegarderBulk = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings) => bulkUpdateSettings(settings),
    onSuccess: () => _invalider(queryClient),
  })
}
