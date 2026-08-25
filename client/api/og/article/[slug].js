/**
 * OG image dynamique — GET /api/og/article/[slug]  (Cf. Audit Lot 5, constat 1.5)
 *
 * Carte de partage 1200×630 pour les articles/conseils, même gabarit
 * marque que /api/og/offre/[id].js. Edge runtime (satori).
 */

const NAVY = "#0F2D4D"
const ORANGE = "#F5A623"
const SURFACE = "#F4F7F9"
const MUTED = "#43474E"

import { ImageResponse } from "@vercel/og"

export const config = { runtime: "edge" }

const div = (style, children) => ({ type: "div", props: { style, children } })

const clamp = (s, min, max) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim()
  if (!t || t.length < min) return t
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

export default async function handler(request) {
  const slug = new URL(request.url).pathname.split("/").pop()

  let article = null
  try {
    const apiOrigin = process.env.API_ORIGIN || "https://job-alert-ci-i6ur.onrender.com"
    const res = await fetch(`${apiOrigin}/api/articles/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
    })
    if (res.ok) article = await res.json()
  } catch {
    /* fallback visuel ci-dessous */
  }

  const titre = clamp(article?.seo_title || article?.title || "Conseils emploi en Côte d'Ivoire", 3, 110)
  const categorie =
    article?.categories?.[0]?.label || article?.category?.label || null
  const lecture = article?.reading_time || article?.reading_minutes || null

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
        div({ display: "flex", alignItems: "center", gap: 16 }, [
          div({ display: "flex", alignItems: "center", gap: 12 }, [
            div({ width: 14, height: 44, background: ORANGE, borderRadius: 4 }),
            div({ fontSize: 34, fontWeight: 800, color: NAVY }, "JobAlert CI"),
          ]),
          div({ flex: 1 }),
          div({ fontSize: 22, color: MUTED, fontWeight: 600 }, "Conseils emploi"),
        ]),

        div({ display: "flex", flexDirection: "column", gap: 20 }, [
          div({ fontSize: 56, fontWeight: 800, lineHeight: 1.18, color: NAVY }, titre),
          div({ display: "flex", alignItems: "center", gap: 14 }, [
            categorie &&
              div(
                { background: ORANGE, color: NAVY, fontSize: 26, fontWeight: 700, padding: "10px 26px", borderRadius: 999 },
                categorie,
              ),
            lecture && div({ fontSize: 24, color: MUTED, fontWeight: 600 }, `${lecture} min de lecture`),
          ]),
        ]),

        div({ display: "flex", alignItems: "center", gap: 12, color: MUTED, fontSize: 24 }, [
          div({ width: 40, height: 4, background: ORANGE, borderRadius: 2 }),
          "Un conseil pratique dans chaque récapitulatif · chaque matin à 8h00",
        ]),
      ],
    ),
    { width: 1200, height: 630 },
  )

  imageResponse.headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400")
  return imageResponse
}
