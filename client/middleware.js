/**
 * ─────────────────────────────────────────────────────────────────────
 * MIDDLEWARE EDGE — Injection des métadonnées sociales (Cf. Audit Lot 5)
 * ─────────────────────────────────────────────────────────────────────
 * La SPA pose ses meta tags en useEffect (src/components/seo/Seo.jsx) :
 * Googlebot s'en sort, mais Facebook / LinkedIn / WhatsApp n'exécutent
 * pas JavaScript → les partages d'offres et d'articles affichaient un
 * titre générique sans description.
 *
 * Ce middleware intercepte /offres/:id et /conseils/:slug pour les
 * crawlers sociaux et renvoie l'index.html enrichi des vraies métas
 * (OpenGraph, Twitter Cards, JSON-LD JobPosting/Article).
 *
 * L'API est interrogée une fois par partage (cache edge 5 min) —
 * jamais dans le chemin critique du rendu navigateur : les vrais
 * visiteurs reçoivent l'index.html tel quel si l'API échoue.
 */

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://job-alert-ci.vercel.app").replace(/\/+$/, "")
const API_ORIGIN = process.env.API_ORIGIN || "https://job-alert-ci-i6ur.onrender.com"
/* À définir dans le dashboard Vercel (Production + Preview) :
   - SITE_URL    : domaine public du site (défaut : job-alert-ci.vercel.app)
   - API_ORIGIN  : origine de l'API FastAPI (défaut : API Render job-alert-ci-i6ur)
   Les valeurs par défaut rendent le middleware fonctionnel sans config. */

/* Les crawlers sociaux ciblés (pas besoin de matcher Googlebot :
   il exécute le JS et lit déjà les tags posés par Seo.jsx). */
const SOCIAL_BOTS = /(facebookexternalhit|facebookcatalog|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|slackbot|embedly|quora link preview|vkshare|bluesky)/i

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const clampText = (s = "", max = 200) => {
  const t = String(s).replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

const metaTag = (attrs) => `<meta ${attrs} />`

const ogBlock = ({ title, description, url, type = "website", image }) => `
${metaTag(`property="og:title" content="${esc(title)}"`)}
${metaTag(`property="og:description" content="${esc(description)}"`)}
${metaTag(`property="og:url" content="${esc(url)}"`)}
${metaTag(`property="og:type" content="${type}"`)}
${metaTag(`property="og:image" content="${esc(image)}"`)}
${metaTag(`name="twitter:card" content="summary_large_image"`)}
${metaTag(`name="twitter:title" content="${esc(title)}"`)}
${metaTag(`name="twitter:description" content="${esc(description)}"`)}
${metaTag(`name="twitter:image" content="${esc(image)}"`)}
${metaTag(`name="description" content="${esc(description)}"`)}
${metaTag(`link rel="canonical" href="${esc(url)}"`)}
<script id="structured-data-social" type="application/ld+json">${JSON.stringify(
  { "@context": "https://schema.org", "@type": type === "article" ? "Article" : "WebPage", headline: title, description, url },
).replace(/</g, "\\u003c")}</script>`

async function offreMetas(id) {
  const res = await fetch(`${API_ORIGIN}/api/offers/${encodeURIComponent(id)}`, {
    headers: { accept: "application/json" },
  })
  if (!res.ok) return null
  const o = await res.json()
  const titre = o.title || "Offre d'emploi"
  const entreprise = o.company?.name || ""
  const ville = o.location?.label || o.location_raw || "Côte d'Ivoire"
  const contrat = o.contract_type?.label
  const filiere = o.primary_filiere?.label
  const salaire = o.salary_raw
  const intro = clampText(o.detail?.intro || "", 140)
  const parts = [
    intro,
    `Poste ${contrat ? contrat.toLowerCase() : ""}${filiere ? ` en ${filiere.toLowerCase()}` : ""} à ${ville}`,
    salaire ? `Rémunération : ${salaire}.` : "",
    `Collectée sur ${o.source?.name || o.source?.code || "nos sources"} par JobAlert CI.`,
  ].filter(Boolean)
  const description = clampText(parts.join(" "))
  const slugOrId = o.slug || o.id || id
  const url = `${SITE_URL}/offres/${slugOrId}`

  /* Image dynamique par offre (carte navy/orange générée à la demande,
     cf. client/api/og/offre/[id].js) ; fallback screenshot si échec. */
  const image = `${SITE_URL}/api/og/offre/${encodeURIComponent(slugOrId)}`

  const jobPosting = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: titre,
    description: intro || description,
    datePosted: o.published_at || o.first_seen_at || undefined,
    validThrough: o.application_deadline_at || undefined,
    employmentType: contrat || undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: entreprise,
      logo: o.company?.logo_url || undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: ville, addressCountry: "CI" },
    },
    ...(salaire
      ? { estimatedSalary: { "@type": "MonetaryAmount", currency: "XOF", value: { "@type": "QuantitativeValue", value: salaire } } }
      : {}),
    directApply: Boolean(o.canonical_url || o.source_url),
    url,
  }

  return {
    title: `${titre} — ${entreprise} · ${ville} | JobAlert CI`,
    block:
      ogBlock({ title: `${titre} — ${entreprise}`, description, url, image }) +
      `<script id="structured-data-jobposting" type="application/ld+json">${JSON.stringify(jobPosting).replace(/</g, "\\u003c")}</script>`,
  }
}

async function articleMetas(slug) {
  const res = await fetch(`${API_ORIGIN}/api/articles/${encodeURIComponent(slug)}`, {
    headers: { accept: "application/json" },
  })
  if (!res.ok) return null
  const a = await res.json()
  const titre = a.seo_title || a.title || "Conseil emploi"
  const description = clampText(a.seo_description || a.excerpt || "Conseils emploi en Côte d'Ivoire par JobAlert CI.")
  const url = `${SITE_URL}/conseils/${a.slug || slug}`
  /* Carte OG dynamique par article (client/api/og/article/[slug].js) */
  const image = `${SITE_URL}/api/og/article/${encodeURIComponent(a.slug || slug)}`
  const published = a.published_at || undefined

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titre,
    description,
    datePublished: published,
    ...(published ? { dateModified: a.updated_at || published } : {}),
    author: { "@type": "Organization", name: "JobAlert CI", url: SITE_URL },
    publisher: { "@type": "Organization", name: "JobAlert CI", url: SITE_URL },
    mainEntityOfPage: url,
    image,
  }

  return {
    title: `${titre} | JobAlert CI`,
    block:
      ogBlock({ title: titre, description, url, type: "article", image }) +
      `<script id="structured-data-article" type="application/ld+json">${JSON.stringify(articleLd).replace(/</g, "\\u003c")}</script>`,
  }
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url)

  /* Uniquement GET de pages HTML sur les deux gabarits à contenu dynamique */
  if (request.method !== "GET") return
  const matchOffre = pathname.match(/^\/offres\/([^/]+)$/)
  const matchArticle = pathname.match(/^\/conseils\/([^/]+)$/)
  if (!matchOffre && !matchArticle) return

  /* Les navigateurs réels ne paient pas le coût API : index.html direct */
  const ua = request.headers.get("user-agent") || ""
  const isSocialBot = SOCIAL_BOTS.test(ua)
  if (!isSocialBot) return

  try {
    const metas = matchOffre ? await offreMetas(decodeURIComponent(matchOffre[1])) : await articleMetas(decodeURIComponent(matchArticle[1]))
    if (!metas) return
    const pageRes = await fetch(new URL("/index.html", request.url))
    const html = await pageRes.text()
    const enriched = html.replace("</head>", `${metas.block}\n</head>`)
    return new Response(enriched, {
      status: 200,
      headers: {
        "content-type": "text/html;charset=UTF-8",
        /* Cache court côté edge : une offre modifiée doit se propager vite */
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        "x-robots-tag": "index, follow",
      },
    })
  } catch {
    return /* API down → SPA standard, jamais de page cassée */
  }
}

export const config = {
  /* Exclut assets statiques et routes API ; cible les deux gabarits dynamiques */
  matcher: ["/offres/:path*", "/conseils/:path*"],
}
