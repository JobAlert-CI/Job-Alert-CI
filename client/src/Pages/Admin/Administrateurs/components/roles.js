/* Rôles admin — miroir exact de l'enum serveur (AdminRoleLiteral).
   Fichier séparé pour react-refresh/only-export-components (partagé
   entre DialogCreation et DialogsEdition). */

export const ROLES = [
  { valeur: "moderateur", libelle: "Modérateur" },
  { valeur: "gestionnaire_offres", libelle: "Gestionnaire offres" },
  { valeur: "gestionnaire_utilisateurs", libelle: "Gestionnaire utilisateurs" },
  { valeur: "super_admin", libelle: "Super admin" },
]
