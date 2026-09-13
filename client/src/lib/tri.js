/* ─────────────────────────────────────────────────────────────────────
   Utilitaires de tri côté client — partagés entre les tables admin
   (Runs récents, Administrateurs, et toute future table triable).
   Format « colonne » associé à EnteteTriable :
     { cle, libelle, directionInitiale?, triValeur, className? }

   Améliorations par rapport au premier pattern (RunsRecents) :
   • Les valeurs vides (null / undefined / "") de `triValeur` restent
     en FIN de liste dans les DEUX sens — l'ancien `reverse()` global
     les faisait remonter en tête en desc.
   • Le sens est appliqué multiplicativement dans le comparateur,
     jamais par inversion du tableau trié.
   • Le cycle d'en-tête est centralisé :
     sens initial de la colonne → sens inverse → null (ordre serveur).
   ───────────────────────────────────────────────────────────────────── */

const estVide = (v) => v === null || v === undefined || v === ""

/**
 * Comparateur « français » robuste : nombres (a - b), textes et dates
 * ISO (localeCompare numeric) ; valeurs vides toujours rejetées en fin,
 * quel que soit le sens.
 */
const comparerValeurs = (a, b, sens) => {
  const videA = estVide(a)
  const videB = estVide(b)
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
  return cmp * sens
}

/**
 * Retourne une copie triée de `liste` selon la colonne et la direction.
 * `colonne` inconnue ou `direction` nulle → la liste est retournée
 * telle quelle (ordre serveur).
 */
export const trierSelonColonne = (liste, colonne, direction) => {
  if (!colonne || !direction) return liste
  const sens = direction === "asc" ? 1 : -1
  return [...liste].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b), sens))
}

/**
 * Cycle de tri d'un en-tête : premier clic = sens naturel de la
 * colonne, deuxième = sens inverse, troisième = null (retour à l'ordre
 * serveur, en-tête visuellement inactif).
 */
export const cycleTriSuivant = (precedent, colonne) => {
  const initial = colonne.directionInitiale ?? "desc"
  if (precedent?.cle !== colonne.cle) return { cle: colonne.cle, direction: initial }
  if (precedent.direction === initial) {
    return { cle: colonne.cle, direction: initial === "asc" ? "desc" : "asc" }
  }
  return null
}