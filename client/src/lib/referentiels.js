// Données — à brancher sur l'API (tables filieres + offres, v2.0)
import {
  Building2, Calculator, Code2, GraduationCap, Handshake, HardHat,
  Megaphone, ShieldCheck, Sprout, Stethoscope, Truck, Users, UtensilsCrossed,
} from "lucide-react"
import { HUES } from "@/lib/hues"

/* colorHex : couleur exacte par filière (aligne le fallback local sur le
   champ color_hex renvoyé par l'API). */
export const FILIERES_META = [
  { code: "tech-dev", label: "Tech & Dev", icon: Code2, hue: "sky", actives: 34, nouvelles: 6, abonnes: 1840,
    tagline: "Développement, data, infra & produit digital",
    desc: "Du full-stack à la data, en passant par le mobile et le cloud : la filière la plus dynamique du marché ivoirien.",
    keywords: ["développeur", "ingénieur logiciel", "full-stack", "devops", "data", "mobile"],
    specialites: ["Développement web", "Data & IA", "Cloud & Infra", "Mobile"] },
  { code: "marketing-com", label: "Marketing & Com", icon: Megaphone, hue: "fuchsia", actives: 21, nouvelles: 4, abonnes: 1120,
    tagline: "Marque, contenu, médias & growth",
    desc: "Communication, brand et création : les métiers qui donnent une voix aux entreprises de Côte d'Ivoire.",
    keywords: ["communication", "community", "marketing", "graphiste", "brand"],
    specialites: ["Communication", "Marketing digital", "Création & Design", "Médias"] },
  { code: "commercial-vente", label: "Commercial & Vente", icon: Handshake, hue: "orange", actives: 18, nouvelles: 3, abonnes: 960,
    tagline: "Vente, grands comptes & développement d'affaires",
    desc: "Terrain, négociation et grands comptes : le moteur de la croissance des entreprises ivoiriennes.",
    keywords: ["commercial", "vente", "business developer", "grands comptes"],
    specialites: ["Vente terrain", "B2B & Grands comptes", "Retail", "Téléconseil"] },
  { code: "comptabilite-finance", label: "Comptabilité & Finance", icon: Calculator, hue: "emerald", actives: 16, nouvelles: 3, abonnes: 1310,
    tagline: "Finance, audit, contrôle & gestion",
    desc: "Banques, cabinets et grands groupes : la place financière d'Abidjan embauche.",
    keywords: ["comptable", "audit", "contrôle de gestion", "finance"],
    specialites: ["Comptabilité", "Audit", "Contrôle de gestion", "Banque"] },
  { code: "ressources-humaines", label: "Ressources Humaines", icon: Users, hue: "violet", actives: 15, nouvelles: 2, abonnes: 890,
    tagline: "Recrutement, paie, formation & développement RH",
    desc: "Recrutement, paie et formation : celles et ceux qui font grandir les équipes.",
    keywords: ["recrutement", "rh", "paie", "formation", "ressources humaines"],
    specialites: ["Recrutement", "Paie & ADP", "Formation", "Gestion RH"] },
  { code: "btp-genie-civil", label: "BTP & Génie Civil", icon: HardHat, hue: "amber", actives: 14, nouvelles: 2, abonnes: 720,
    tagline: "Chantiers, génie civil & infrastructures",
    desc: "Des chantiers d'Abidjan aux routes de l'intérieur : les métiers qui construisent la Côte d'Ivoire.",
    keywords: ["chantier", "génie civil", "conducteur de travaux", "topographe"],
    specialites: ["Conduite de travaux", "Études & ingénierie", "Chantier", "Topographie"] },
  { code: "logistique-transport", label: "Logistique & Transport", icon: Truck, hue: "cyan", actives: 12, nouvelles: 2, abonnes: 640,
    tagline: "Transit, douane, supply chain & distribution",
    desc: "Transit, douane et supply chain : la colonne vertébrale du premier hub portuaire d'Afrique de l'Ouest.",
    keywords: ["logistique", "transit", "douane", "supply chain", "magasinier"],
    specialites: ["Transit & Douane", "Supply chain", "Transport", "Magasinage"] },
  { code: "sante-medical", label: "Santé & Médical", icon: Stethoscope, hue: "rose", actives: 11, nouvelles: 2, abonnes: 830,
    tagline: "Soins, pharma, labo & professions médicales",
    desc: "Soignants, pharmaciens et techniciens : les métiers au service de la santé des Ivoiriens.",
    keywords: ["infirmier", "médecin", "pharmacien", "laboratoire", "sage-femme"],
    specialites: ["Soins infirmiers", "Médecine", "Pharmacie", "Laboratoire"] },
  { code: "administration", label: "Administration", icon: Building2, hue: "blue", actives: 10, nouvelles: 1, abonnes: 580,
    tagline: "Assistanat, gestion & services généraux",
    desc: "Le socle de toute organisation : assistanat, office management et services généraux.",
    keywords: ["assistant", "office manager", "secrétaire", "services généraux"],
    specialites: ["Assistanat de direction", "Office management", "Secrétariat", "Services généraux"] },
  { code: "education-formation", label: "Éducation & Formation", icon: GraduationCap, hue: "indigo", actives: 9, nouvelles: 1, abonnes: 510,
    tagline: "Enseignement, pédagogie & formation professionnelle",
    desc: "Écoles, ONG et instituts : transmettre et former, un secteur qui se réinvente.",
    keywords: ["enseignant", "formateur", "pédagogie", "professeur"],
    specialites: ["Enseignement", "Formation professionnelle", "Pédagogie", "Éducation spécialisée"] },
  { code: "hotellerie-restauration", label: "Hôtellerie & Restauration", icon: UtensilsCrossed, hue: "teal", actives: 8, nouvelles: 1, abonnes: 450,
    tagline: "Cuisine, salle, hébergement & hospitalité",
    desc: "Hôtels, restaurants et traiteurs : l'hospitalité ivoirienne en plein essor.",
    keywords: ["chef", "serveur", "hôtellerie", "restauration", "barman"],
    specialites: ["Cuisine", "Salle & Bar", "Hébergement", "Traiteur"] },
  { code: "agriculture-agrobusiness", label: "Agriculture & Agrobusiness", icon: Sprout, hue: "lime", actives: 7, nouvelles: 1, abonnes: 390,
    tagline: "Du champ à l'usine : cacao, cajou & agro-industrie",
    desc: "La filière cacao-cajou et l'agro-industrie embauchent, du champ à l'usine.",
    keywords: ["agronome", "agricole", "plantation", "agro-industrie"],
    specialites: ["Agronomie", "Production", "Transformation", "Plantation"] },
  { code: "securite-gardiennage", label: "Sécurité & Gardiennage", icon: ShieldCheck, hue: "red", actives: 6, nouvelles: 1, abonnes: 310,
    tagline: "Sûreté, gardiennage & protection des sites",
    desc: "Entreprises et sites sensibles : des métiers de confiance, en CDI comme en mission.",
    keywords: ["agent de sécurité", "gardiennage", "sûreté", "cynophile"],
    specialites: ["Gardiennage", "Sûreté aéroportuaire", "Cynophile", "Supervision"] },
].map((f) => ({ ...f, colorHex: HUES[f.hue]?.hex ?? null }))

export const SOURCES = [
  { code: "EmploiDakar CI", bg: "#0F2D4D", short: "ED" },
  { code: "GoAfrica", bg: "#0F766E", short: "GA" },
  { code: "Novojob", bg: "#B45309", short: "NJ" },
  { code: "LinkedIn", bg: "#0A66C2", short: "in", linkedin: true },
]

export const CONTRATS = ["CDI", "CDD", "Stage", "Mission", "Alternance"]
export const EXPERIENCES = ["Débutant", "1-3 ans", "3-5 ans", "5 ans+"]
export const NIVEAUX = ["Bac", "Bac+2", "Bac+3", "Bac+5", "Bac+8"]
export const SORTS = [
  { k: "recent", l: "Plus récentes" },
  { k: "old", l: "Plus anciennes" },
  { k: "az", l: "Titre A → Z" },
  { k: "ent", l: "Entreprise A → Z" },
]