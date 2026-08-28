import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}


export function getInitials(name) {
  if (!name) return ""
  const words = name.trim().split(/[\s-]+/) // Sépare par les espaces ou tirets
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  // S'il n'y a qu'un seul mot (ex: "JobIvoire"), on prend les deux premières lettres
  return name.substring(0, 2).toUpperCase()
}