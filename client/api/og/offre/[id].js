/**
 * OG image dynamique — GET /api/og/offre/[id]  (Cf. Audit Lot 5, constat 1.5)
 *
 * Carte de partage 1200×630 aux couleurs de la marque (navy/orange),
 * générée à la demande par offre. Servie en edge runtime (satori), cache
 * CDN 1 h. Le middleware edge l'utilise comme og:image des partages.
 *
 * Format sans JSX : les éléments sont des objets { type, props } —
 * c'est exactement ce que le JSX compile, et satori l'accepte tel quel
 * (les fonctions Vercel hors framework ne transpilent pas le JSX).
 */

const NAVY = "#0F2D4D"
const ORANGE = "#F5A623"
const SURFACE = "#F4F7F9"
const MUTED = "#43474E"

import { ImageResponse } from "@vercel/og"

export const config = { runtime: "edge" }

const el = (type, props) => ({ type, props })
const div = (style, children) => el("div", { style, children })

const clamp = (s, min, max) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim()
  if (!t || t.length < min) return t
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

export default async function handler(request) {
  const id = new URL(request.url).pathname.split("/").pop()

  let offre = null
  try {
    const apiOrigin = process.env.API_ORIGIN || "https://job-alert-ci-i6ur.onrender.com"
    const res = await fetch(`${apiOrigin}/api/offers/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    })
    if (res.ok) offre = await res.json()
  } catch {
    /* fallback visuel ci-dessous */
  }

  const titre = clamp(offre?.title || "Offres d'emploi en Côte d'Ivoire", 3, 110)
  const entreprise = clamp(offre?.company?.name || "JobAlert CI", 1, 60)
  const ville = offre?.location?.label || offre?.location_raw || "Côte d'Ivoire"
  const contrat = offre?.contract_type?.label || null
  const salaire = clamp(offre?.salary_raw, 1, 40)

  const imageResponse = new ImageResponse(
    div(
      {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: SURFACE,
        padding: 64,
        fontFamily: "sans-serif",
      },
      [
        /* Bande supérieure marque */
        div({ display: "flex", alignItems: "center", gap: 16 }, [
          div({ display: "flex", alignItems: "center", gap: 12 }, [
            div({ width: 14, height: 44, background: ORANGE, borderRadius: 4 }),
            div({ fontSize: 34, fontWeight: 800, color: NAVY }, "JobAlert CI"),
          ]),
          div({ flex: 1 }),
          div({ fontSize: 22, color: MUTED, fontWeight: 600 }, ville),
        ]),

        /* Corps */
        div({ display: "flex", flexDirection: "column", gap: 20 }, [
          div({ fontSize: 58, fontWeight: 800, lineHeight: 1.15, color: NAVY }, titre),
          div({ display: "flex", alignItems: "center", gap: 14 }, [
            div(
              { background: ORANGE, color: NAVY, fontSize: 28, fontWeight: 700, padding: "10px 26px", borderRadius: 10 },
              entreprise,
            ),
            contrat &&
              div(
                { border: `2px solid ${NAVY}33`, color: NAVY, fontSize: 24, fontWeight: 600, padding: "8px 22px", borderRadius: 10 },
                contrat,
              ),
            salaire &&
              div(
                { border: `2px solid ${ORANGE}66`, background: `${ORANGE}1A`, color: NAVY, fontSize: 24, fontWeight: 600, padding: "8px 22px", borderRadius: 10 },
                salaire,
              ),
          ]),
        ]),

        /* Pied */
        div({ display: "flex", alignItems: "center", gap: 12, color: MUTED, fontSize: 24 }, [
          div({ width: 40, height: 4, background: ORANGE, borderRadius: 2 }),
          "Récapitulatif quotidien des offres · chaque matin à 8h00 · jobalert.ci",
        ]),
      ],
    ),
    { width: 1200, height: 630 },
  )

  imageResponse.headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400")
  return imageResponse
}
