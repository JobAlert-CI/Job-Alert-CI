import { Filter, MailCheck, Fingerprint, Radar } from "lucide-react"

const REASSURANCES = [
  "100 % gratuit, sans mot de passe",
  "1 seul email par jour, pas plus",
  "Désinscription en 1 clic",
]

const QUESTIONS = [
  {
    id: "q1",
    question: "Est-ce vraiment gratuit ?",
    reponse:
      "Oui, à 100 % et pour toujours. Aucune carte bancaire, aucun frais caché : JobAlert CI ne vous demandera jamais de payer pour recevoir des offres.",
  },
  {
    id: "q2",
    question: "À quelle heure arrive le récapitulatif ?",
    reponse:
      "À 8h00 précises, chaque jour. Le scraping se termine à 6h15 et le filtrage à 7h00 — votre email est prêt avant votre premier café.",
  },
  {
    id: "q3",
    question: "D'où viennent les offres ?",
    reponse:
      "De 4 sources majeures scannées chaque matin : EmploiDakar CI, GoAfrica, Novojob et LinkedIn. Chaque offre affiche sa source d'origine et un lien direct vers l'annonce.",
  },
  {
    id: "q4",
    question: "Quels secteurs sont couverts ?",
    reponse:
      "13 filières métiers : Tech & Dev, Marketing & Com, Commercial & Vente, Comptabilité & Finance, RH, BTP & Génie Civil, Logistique & Transport, Santé & Médical, Administration, Éducation & Formation, Hôtellerie & Restauration, Agriculture & Agrobusiness, Sécurité & Gardiennage.",
  },
  {
    id: "q5",
    question: "Comment modifier mes filières ou me désinscrire ?",
    reponse:
      "Chaque email contient deux liens en bas de page : l'un pour gérer vos filières, l'autre pour vous désinscrire en un clic — sans mot de passe ni formulaire.",
  },
  {
    id: "q6",
    question: "Puis-je recevoir les alertes sur WhatsApp ?",
    reponse:
      "Pas encore. L'email est pour l'instant notre canal unique afin de garantir la fiabilité de la chaîne quotidienne. WhatsApp et SMS sont sur la feuille de route.",
  },
  {
    id: "q7",
    question: "Mes données sont-elles protégées ?",
    reponse:
      "Votre adresse email ne sert qu'à vous envoyer vos offres. Elle n'est jamais partagée, jamais revendue, et vous pouvez supprimer votre compte à tout moment.",
  },
]

const TEMOIGNAGES = [
  {
    vedette: true,
    initiales: "AD",
    nom: "Awa D.",
    ville: "Bouaké",
    secteur: "Ressources Humaines",
    avatar: "bg-violet-500",
    texte:
      "Je passais mes matinées à ouvrir dix sites un par un. Maintenant, tout arrive à 8h00 dans un seul email — et c'est dans mon tout premier récap que j'ai trouvé l'offre de Responsable RH que j'occupe aujourd'hui.",
    resultat: "Embauchée 3 semaines après son inscription",
  },
  {
    initiales: "JK",
    nom: "Jean-Paul K.",
    ville: "San Pédro",
    secteur: "Tech & Dev",
    avatar: "bg-sky-600",
    texte:
      "Alerte reçue à 8h00 pile, candidature envoyée à 8h20. Entretien la semaine suivante, CDI signé dans la foulée.",
    resultat: "CDI signé en 12 jours",
  },
  {
    initiales: "MK",
    nom: "Moussa K.",
    ville: "Abidjan",
    secteur: "Comptabilité & Finance",
    avatar: "bg-emerald-600",
    texte:
      "Dès la première semaine, une offre d'Expert-Comptable qui cochait toutes mes cases. Le filtrage par filière est d'une précision redoutable.",
    resultat: "3 entretiens décrochés en 1 mois",
  },
  {
    initiales: "SK",
    nom: "Salimata K.",
    ville: "Korhogo",
    secteur: "Santé & Médical",
    avatar: "bg-rose-600",
    texte:
      "Infirmière de nuit, je n'avais jamais le temps d'ouvrir les sites d'emploi. Le récap m'a apporté l'offre de la Clinique Farah sur un plateau — j'ai postulé entre deux gardes.",
    resultat: "Nouveau poste en 3 semaines",
  },
  {
    initiales: "YB",
    nom: "Yao B.",
    ville: "Yamoussoukro",
    secteur: "BTP & Génie Civil",
    avatar: "bg-amber-600",
    texte:
      "Une offre de conducteur de travaux arrivée un mardi, un chantier qui démarrait le lundi suivant. Sans l'alerte de 8h00, je passais complètement à côté.",
    resultat: "CDD transformé en CDI",
  },
  {
    initiales: "FC",
    nom: "Fatou C.",
    ville: "Abidjan",
    secteur: "Marketing & Com",
    avatar: "bg-fuchsia-600",
    texte:
      "J'ai fait le compte : en un mois, le récap m'a remonté plus d'offres pertinentes que trois mois de recherche manuelle, site par site.",
    resultat: "12 candidatures ciblées en 1 mois",
  },
]

const STEPS_HOW = [
  { time: "06h00", icon: Radar, title: "Collecte", desc: "Plusieurs scrapers parcourent les sites sources en parallèle, la panne d'une source ne bloque jamais les autres.", hex: "#F5A623", metric: "+42 offres brutes collectées" },
  { time: "06h45", icon: Fingerprint, title: "Dédoublonnage", desc: "Chaque annonce reçoit un hash unique calculé depuis son lien.", hex: "#0F2D4D", metric: "12 doublons écartés" },
  { time: "07h15", icon: Filter, title: "Filtrage", desc: "Les offres sont matchées avec vos 1 à 3 filières métiers.", hex: "#2ECC71", metric: "3 offres matchées pour vous" },
  { time: "08h00", icon: MailCheck, title: "Envoi", desc: "Votre récapitulatif personnalisé part par email, 3 tentatives en cas de panne SMTP.", hex: "#F5A623", metric: "Livré à 08h00:00" },
];

const EMAIL_JOBS = [
  { t: "Développeur Full-Stack React / Node", e: "Digital Hub CI" },
  { t: "Ingénieur DevOps Cloud", e: "Wave Mobile Money" },
  { t: "Tech Lead Java", e: "SGI Africa" },
];

const OFFRES_FILTREES = [
  { titre: "Responsable RH", entreprise: "Orange Côte d'Ivoire", ok: true },
  { titre: "Comptable senior", entreprise: "Groupe SIFCA", ok: true },
  { titre: "Développeur Full-Stack", entreprise: "Tech Solutions CI", ok: false },
]

const QUESTIONS_HOW = [
  {
    id: "q1", question: "Pourquoi un email plutôt qu'un tableau de bord ?",
    reponse: "Parce que c'est plus rapide. Le mode « push » vous évite de penser à vérifier : l'information vient à vous chaque matin, au lieu d'ajouter un site de plus à consulter. C'est aussi le meilleur moyen de ne rien manquer."
  },
  {
    id: "q2", question: "Comment une offre est-elle rattachée à une filière ?",
    reponse: "Par analyse de mots-clés dans l'intitulé du poste : « développeur » ou « ingénieur logiciel » → Tech & Dev, « conducteur de travaux » → BTP & Génie Civil… Les listes de mots-clés sont maintenues et affinées en continu."
  },
  {
    id: "q3", question: "Que se passe-t-il si une source est en panne ?",
    reponse: "Rien de visible pour vous : chaque scraper est isolé, l'erreur est journalisée avec horodatage, et les trois autres sources continuent d'alimenter votre récapitulatif normalement."
  },
  {
    id: "q4", question: "Et si aucune offre ne correspond à mes filières aujourd'hui ?",
    reponse: "Vous ne recevez rien. Pas d'email vide, pas de remplissage : votre boîte mail reste propre, et la chaîne reprend le lendemain matin."
  },
  {
    id: "q5", question: "Pourquoi 8h00 précisément ?",
    reponse: "Pour que votre récapitulatif soit là au moment où vous commencez votre journée — avant que les meilleures offres ne reçoivent leurs premières candidatures."
  },
  {
    id: "q6", question: "Puis-je changer de filières après mon inscription ?",
    reponse: "Oui. Chaque email contient un lien pour gérer vos filières ou vous désinscrire en un clic — sans mot de passe ni formulaire."
  },
]

/* ------------------------------------------------------------------ */
/*  Fallbacks visuels                                                 */
/* ------------------------------------------------------------------ */

const JOBS_APERCU = [
  {
    id: "mock-1",
    title: "Développeur Full-Stack",
    company: { name: "Groupe SIFCA · Abidjan" },
    source: { name: "Novojob", code: "novojob" },
    primary_filiere: { hue: "sky" },
  },
  {
    id: "mock-2",
    title: "Responsable RH",
    company: { name: "Orange Côte d'Ivoire · Abidjan" },
    source: { name: "LinkedIn", code: "linkedin" },
    primary_filiere: { hue: "violet" },
    linkedin: true,
  },
  {
    id: "mock-3",
    title: "Conducteur de travaux",
    company: { name: "Bouygues CI · Yamoussoukro" },
    source: { name: "GoAfrica", code: "goafrica" },
    primary_filiere: { hue: "amber" },
  },
  {
    id: "mock-4",
    title: "Infirmier(ère) diplômé(e)",
    company: { name: "Clinique Farah · Abidjan" },
    source: { name: "EmploiDakar CI", code: "emploidakar" },
    primary_filiere: { hue: "rose" },
  },
]

export {
  REASSURANCES, QUESTIONS, TEMOIGNAGES, JOBS_APERCU,
  STEPS_HOW, EMAIL_JOBS, OFFRES_FILTREES, QUESTIONS_HOW
}