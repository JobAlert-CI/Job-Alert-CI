// src/lib/filiere-icons.js
import {
  Truck,
  GraduationCap,
  Briefcase,
  Code2,
  Megaphone,
  Calculator,
  Users,
  HardHat,
  Stethoscope,
  Building2,
  Utensils,
  Sprout,
  Shield,
  Circle,
} from "lucide-react"

/**
 * Registre des icônes de filières.
 * Les clés correspondent aux valeurs possibles de `icon_name`.
 */
export const filiereIconRegistry = {
  // Icônes principales
  truck: Truck,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  code: Code2,
  megaphone: Megaphone,
  calculator: Calculator,
  users: Users,
  "hard-hat": HardHat,
  stethoscope: Stethoscope,
  building: Building2,
  "building-2": Building2,
  utensils: Utensils,
  sprout: Sprout,
  shield: Shield,

  // Alias utiles si l'API renvoie des variantes
  graduationcap: GraduationCap,
  graduation: GraduationCap,
  truckicon: Truck,
  logistics: Truck,
  education: GraduationCap,
  health: Stethoscope,
  medical: Stethoscope,
  construction: HardHat,
  btp: HardHat,
  finance: Calculator,
  accounting: Calculator,
  hr: Users,
  marketing: Megaphone,
  sales: Briefcase,
  tech: Code2,
  dev: Code2,
}

/**
 * Fallback par code de filière.
 * Utile si `icon_name` est absent.
 */
export const filiereCodeIconFallback = {
  "tech-dev": Code2,
  "marketing-com": Megaphone,
  "commercial-vente": Briefcase,
  "comptabilite-finance": Calculator,
  "ressources-humaines": Users,
  "btp-genie-civil": HardHat,
  "logistique-transport": Truck,
  "sante-medical": Stethoscope,
  administration: Building2,
  "education-formation": GraduationCap,
  "hotellerie-restauration": Utensils,
  "agriculture-agrobusiness": Sprout,
  "securite-gardiennage": Shield,
}

const normalizeIconName = (value) => {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
}

/**
 * Récupère une icône de filière depuis `icon_name` ou `code`.
 */
export function getFiliereIcon({
  iconName,
  filiereCode,
  fallback: FallbackIcon = Circle,
}) {
  const normalized = normalizeIconName(iconName)
  const compact = normalized.replace(/-/g, "")

  const Icon =
    filiereIconRegistry[normalized] ||
    filiereIconRegistry[compact] ||
    filiereCodeIconFallback[filiereCode] ||
    FallbackIcon

  return Icon
}