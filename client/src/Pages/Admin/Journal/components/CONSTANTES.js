export const ACTIONS = [
  { valeur: "creation", libelle: "Création" },
  { valeur: "modification", libelle: "Modification" },
  { valeur: "suppression", libelle: "Suppression" },
  { valeur: "envoi", libelle: "Envoi" },
  { valeur: "connexion", libelle: "Connexion (depuis cycles récents)" },
  { valeur: "deconnexion", libelle: "Déconnexion (depuis l'audit 4)" },
  { valeur: "scraping", libelle: "Scraping" },
]

export const VARIANTE_ACTION = {
  creation: "secondary",
  modification: "secondary",
  suppression: "destructive",
  envoi: "outline",
  connexion: "outline",
  deconnexion: "outline",
  scraping: "outline",
}

/* Libellés courts des badges (sans la parenthèse de contexte). */
export const LIBELLE_COURT_ACTION = Object.fromEntries(
  ACTIONS.map((a) => [a.valeur, a.libelle.split(" (")[0]])
)