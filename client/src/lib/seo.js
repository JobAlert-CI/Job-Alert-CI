export const SITE_NAME = "JobAlert CI"
export const DEFAULT_SITE_URL = "https://job-alert-ci.vercel.app"

export const siteUrl = (import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "")

export const absoluteUrl = (path = "/") => {
  if (/^https?:\/\//i.test(path)) return path
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`
}

const description =
  "JobAlert CI collecte les offres d'emploi en Cote d'Ivoire chaque matin et vous envoie a 8h00 un recapitulatif gratuit, filtre par metier, sans doublons."

export const homeSeo = {
  title: "JobAlert CI | Offres d'emploi en Cote d'Ivoire chaque matin",
  description,
  path: "/",
  image: "/screen.png",
  imageAlt: "Apercu de JobAlert CI et de son recapitulatif d'offres d'emploi",
  keywords:
    "emploi Cote d'Ivoire, offres d'emploi Abidjan, alerte emploi CI, recrutement Cote d'Ivoire, jobs Abidjan, JobAlert CI",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: `${siteUrl}/`,
        logo: absoluteUrl("/logo2.svg"),
        email: "bonjour@jobalert.ci",
        areaServed: {
          "@type": "Country",
          name: "Cote d'Ivoire",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: `${siteUrl}/`,
        inLanguage: "fr-CI",
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
      {
        "@type": "Service",
        "@id": `${siteUrl}/#service`,
        name: "Alertes emploi quotidiennes en Cote d'Ivoire",
        provider: {
          "@id": `${siteUrl}/#organization`,
        },
        serviceType: "Alerte emploi par email",
        areaServed: {
          "@type": "Country",
          name: "Cote d'Ivoire",
        },
        audience: {
          "@type": "Audience",
          audienceType: "Candidats et chercheurs d'emploi",
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "XOF",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Est-ce vraiment gratuit ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Oui, JobAlert CI est gratuit. Aucune carte bancaire n'est demandee pour recevoir les alertes emploi.",
            },
          },
          {
            "@type": "Question",
            name: "A quelle heure arrive le recapitulatif ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Le recapitulatif arrive chaque jour a 8h00 par email, apres la collecte et le filtrage des offres.",
            },
          },
          {
            "@type": "Question",
            name: "D'ou viennent les offres ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Les offres sont collectees depuis plusieurs sources emploi, notamment EmploiDakar CI, GoAfrica, Novojob et LinkedIn.",
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: `${siteUrl}/`,
          },
        ],
      },
    ],
  },
}

export const howItWorksSeo = {
  title: "Comment ca marche | JobAlert CI",
  description:
    "Decouvrez comment JobAlert CI collecte, dedoublonne et filtre les offres d'emploi en Cote d'Ivoire avant de vous envoyer un recapitulatif gratuit a 8h00.",
  path: "/comment-ca-marche",
  image: "/screen.png",
  imageAlt: "Apercu de la page Comment ca marche de JobAlert CI",
  keywords:
    "comment ca marche JobAlert CI, fonctionnement alerte emploi, offres d'emploi Cote d'Ivoire, email emploi quotidien, dedoublonnage offres emploi",
  type: "article",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/comment-ca-marche#webpage`,
        url: `${siteUrl}/comment-ca-marche`,
        name: "Comment ca marche | JobAlert CI",
        description:
          "Decouvrez comment JobAlert CI collecte, dedoublonne et filtre les offres d'emploi en Cote d'Ivoire avant de vous envoyer un recapitulatif gratuit a 8h00.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
        primaryImageOfPage: absoluteUrl("/screen.png"),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/comment-ca-marche#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Comment ca marche",
            item: `${siteUrl}/comment-ca-marche`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/comment-ca-marche#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Pourquoi un email plutot qu'un tableau de bord ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Parce que le mode email pousse l'information vers vous chaque matin au lieu de vous demander de revenir consulter un site.",
            },
          },
          {
            "@type": "Question",
            name: "Comment une offre est-elle rattachee a une filiere ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Par analyse de mots-cles dans l'intitule du poste, puis validation dans la chaine de filtrage avant l'envoi du recapitulatif.",
            },
          },
          {
            "@type": "Question",
            name: "Que se passe-t-il si une source est en panne ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Les autres sources continuent de fonctionner et les erreurs sont journalisees sans interrompre le recapitulatif quotidien.",
            },
          },
        ],
      },
    ],
  },
}

const makeBreadcrumb = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
})

const normalizeText = (value = "") => String(value).replace(/\s+/g, " ").trim()
const clampText = (value, max = 180) => {
  const text = normalizeText(value)
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

const joinKeywords = (...parts) =>
  [...new Set(parts.flat(Infinity).map(normalizeText).filter(Boolean))].join(", ")

const sortSourceEntries = (entries = []) =>
  [...entries]
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))

export const offresSeo = ({ total = 0, nouveaux = 0, parSource = {}, offers = [] } = {}) => {
  const topOffers = offers.slice(0, 12)
  const topSources = sortSourceEntries(Object.entries(parSource))
    .slice(0, 3)
    .map(([source, count]) => `${count} sur ${source}`)
  const descriptionParts = [
    `Consultez ${Number(total).toLocaleString("fr-FR")} offres d'emploi en Cote d'Ivoire,`,
    `dont ${Number(nouveaux).toLocaleString("fr-FR")} nouvelles aujourd'hui,`,
    "filtrees et triees chaque matin par JobAlert CI.",
  ]
  if (topSources.length) descriptionParts.push(`Sources principales: ${topSources.join(", ")}.`)

  const description = clampText(descriptionParts.join(" "))

  return {
    title: "Offres d'emploi en Cote d'Ivoire | JobAlert CI",
    description,
    path: "/offres",
    image: "/screen.png",
    imageAlt: "Apercu de la page Offres d'emploi sur JobAlert CI",
    keywords:
      "offres d'emploi Cote d'Ivoire, emplois Abidjan, alerte emploi CI, offres du jour, recrutement Cote d'Ivoire, JobAlert CI",
    type: "website",
    locale: "fr_CI",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `${siteUrl}/offres#webpage`,
          url: `${siteUrl}/offres`,
          name: "Offres d'emploi en Cote d'Ivoire | JobAlert CI",
          description,
          inLanguage: "fr-CI",
          isPartOf: {
            "@id": `${siteUrl}/#website`,
          },
          about: {
            "@id": `${siteUrl}/#service`,
          },
          primaryImageOfPage: absoluteUrl("/screen.png"),
        },
        makeBreadcrumb([
          { name: "Accueil", url: `${siteUrl}/` },
          { name: "Offres d'emploi", url: `${siteUrl}/offres` },
        ]),
        {
          "@type": "ItemList",
          "@id": `${siteUrl}/offres#itemlist`,
          name: "Offres mises en avant",
          numberOfItems: topOffers.length,
          itemListElement: topOffers.map((offer, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `${offer.titre} — ${offer.entreprise}`,
            url: `${siteUrl}/offres/${offer.id}`,
          })),
        },
      ],
    },
  }
}

export const offreSeo = ({ offre, meta, detail, relatedOffers = [] } = {}) => {
  if (!offre || !meta) {
    return {
      title: "Offre introuvable | JobAlert CI",
      description:
        "L'offre demandee est introuvable. Retournez a la liste des offres d'emploi sur JobAlert CI.",
      path: "/offres",
      image: "/screen.png",
      imageAlt: "Offre introuvable sur JobAlert CI",
      type: "website",
      locale: "fr_CI",
      noindex: true,
    }
  }

  const title = `${offre.titre} — ${offre.entreprise} · ${offre.ville} | JobAlert CI`
  const description = clampText(
    detail?.intro
      ? `${detail.intro} Offre ${offre.contrat} ${meta.label} a ${offre.ville}, collecte sur ${offre.source}.`
      : `${offre.titre} chez ${offre.entreprise} a ${offre.ville}, offre ${offre.contrat} ${meta.label} collecte sur ${offre.source}.`
  )

  const keywords = joinKeywords(
    offre.titre,
    offre.entreprise,
    offre.ville,
    offre.contrat,
    offre.source,
    meta.label,
    meta.keywords,
    detail?.tags || []
  )

  const itemList = relatedOffers.slice(0, 8)

  return {
    title,
    description,
    path: `/offres/${offre.id}`,
    image: "/screen.png",
    imageAlt: `${offre.titre} chez ${offre.entreprise} sur JobAlert CI`,
    keywords,
    type: "website",
    locale: "fr_CI",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${siteUrl}/offres/${offre.id}#webpage`,
          url: `${siteUrl}/offres/${offre.id}`,
          name: title,
          description,
          inLanguage: "fr-CI",
          isPartOf: {
            "@id": `${siteUrl}/#website`,
          },
          about: {
            "@id": `${siteUrl}/#service`,
          },
          primaryImageOfPage: absoluteUrl("/screen.png"),
        },
        makeBreadcrumb([
          { name: "Accueil", url: `${siteUrl}/` },
          { name: "Offres d'emploi", url: `${siteUrl}/offres` },
          { name: offre.titre, url: `${siteUrl}/offres/${offre.id}` },
        ]),
        ...(itemList.length
          ? [
              {
                "@type": "ItemList",
                "@id": `${siteUrl}/offres/${offre.id}#related`,
                name: `Offres similaires a ${offre.titre}`,
                itemListElement: itemList.map((offer, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  name: `${offer.titre} — ${offer.entreprise}`,
                  url: `${siteUrl}/offres/${offer.id}`,
                })),
              },
            ]
          : []),
      ],
    },
  }
}

export const filieresSeo = (filieres = []) => ({
  title: "Filières métiers | JobAlert CI",
  description:
    "Explorez les 13 filières métiers couvertes par JobAlert CI et trouvez les offres d'emploi pertinentes en Côte d'Ivoire, triées et filtrées chaque matin à 8h00.",
  path: "/filieres",
  image: "/screen.png",
  imageAlt: "Vue des filières métiers sur JobAlert CI",
  keywords:
    "filières métiers Côte d'Ivoire, offres d'emploi par filière, emploi Abidjan, JobAlert CI, alerte emploi par secteur",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/filieres#webpage`,
        url: `${siteUrl}/filieres`,
        name: "Filières métiers | JobAlert CI",
        description:
          "Explorez les 13 filières métiers couvertes par JobAlert CI et trouvez les offres d'emploi pertinentes en Côte d'Ivoire, triées et filtrées chaque matin à 8h00.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "Filières", url: `${siteUrl}/filieres` },
      ]),
      {
        "@type": "ItemList",
        "@id": `${siteUrl}/filieres#itemlist`,
        name: "Filières couvertes",
        itemListElement: filieres.map((f, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: f.label,
          url: `${siteUrl}/filieres/${f.code}`,
        })),
      },
    ],
  },
})

export const filiereSeo = ({ meta, filiere, offres = [] }) => {
  if (!meta) {
    return {
      title: "Filière introuvable | JobAlert CI",
      description:
        "La filière demandée n'existe pas ou n'est plus disponible. Retournez à la liste des filières métiers sur JobAlert CI.",
      path: `/filieres/${filiere || ""}`,
      image: "/screen.png",
      imageAlt: "Filière introuvable sur JobAlert CI",
      type: "website",
      locale: "fr_CI",
      noindex: true,
    }
  }

  const topOffers = offres.slice(0, 8)
  const description = `${meta.label} sur JobAlert CI : ${meta.actives} offres actives, ${meta.abonnes.toLocaleString("fr-FR")} abonnés et des nouvelles offres filtrées chaque matin à 8h00.`

  return {
    title: `${meta.label} | Offres d'emploi en Côte d'Ivoire | JobAlert CI`,
    description,
    path: `/filieres/${meta.code}`,
    image: "/screen.png",
    imageAlt: `Offres d'emploi ${meta.label} sur JobAlert CI`,
    keywords: `${meta.label}, offres d'emploi ${meta.label} Côte d'Ivoire, alerte emploi ${meta.label}, JobAlert CI, ${meta.keywords.join(", ")}`,
    type: "website",
    locale: "fr_CI",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${siteUrl}/filieres/${meta.code}#webpage`,
          url: `${siteUrl}/filieres/${meta.code}`,
          name: `${meta.label} | Offres d'emploi en Côte d'Ivoire | JobAlert CI`,
          description,
          inLanguage: "fr-CI",
          isPartOf: {
            "@id": `${siteUrl}/#website`,
          },
          about: {
            "@id": `${siteUrl}/#service`,
          },
          primaryImageOfPage: absoluteUrl("/screen.png"),
        },
        makeBreadcrumb([
          { name: "Accueil", url: `${siteUrl}/` },
          { name: "Filières", url: `${siteUrl}/filieres` },
          { name: meta.label, url: `${siteUrl}/filieres/${meta.code}` },
        ]),
        {
          "@type": "ItemList",
          "@id": `${siteUrl}/filieres/${meta.code}#itemlist`,
          name: `Offres ${meta.label}`,
          itemListElement: topOffers.map((offer, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `${offer.titre} — ${offer.entreprise}`,
          })),
        },
      ],
    },
  }
}

export const conseilsSeo = ({ total = 0, categories = [], featuredArticles = [] } = {}) => {
  const topArticles = featuredArticles.slice(0, 8)
  const topCategories = categories
    .slice(0, 4)
    .map((cat) => cat.label)
    .filter(Boolean)

  const description = clampText(
    `Explorez ${Number(total).toLocaleString("fr-FR")} conseils emploi en Cote d'Ivoire, ` +
      `ecrits a partir des offres collectees par JobAlert CI et classes par theme. ` +
      "CV, entretien, salaire, marche et recherche d'emploi au meme endroit."
  )

  return {
    title: "Conseils emploi en Cote d'Ivoire | JobAlert CI",
    description,
    path: "/conseils",
    image: "/screen.png",
    imageAlt: "Apercu de la bibliotheque de conseils JobAlert CI",
    keywords: joinKeywords(
      "conseils emploi Cote d'Ivoire",
      "conseils recherche emploi Abidjan",
      "CV entretien salaire",
      topCategories,
      "JobAlert CI"
    ),
    type: "website",
    locale: "fr_CI",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `${siteUrl}/conseils#webpage`,
          url: `${siteUrl}/conseils`,
          name: "Conseils emploi en Cote d'Ivoire | JobAlert CI",
          description,
          inLanguage: "fr-CI",
          isPartOf: {
            "@id": `${siteUrl}/#website`,
          },
          about: {
            "@id": `${siteUrl}/#service`,
          },
          primaryImageOfPage: absoluteUrl("/screen.png"),
        },
        makeBreadcrumb([
          { name: "Accueil", url: `${siteUrl}/` },
          { name: "Conseils", url: `${siteUrl}/conseils` },
        ]),
        {
          "@type": "ItemList",
          "@id": `${siteUrl}/conseils#itemlist`,
          name: "Conseils mis en avant",
          numberOfItems: topArticles.length,
          itemListElement: topArticles.map((article, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: article.titre,
            url: `${siteUrl}/conseils/${article.slug}`,
          })),
        },
      ],
    },
  }
}

export const conseilSeo = ({ article, cat, contenu, slug } = {}) => {
  if (!article) {
    return {
      title: "Conseil introuvable | JobAlert CI",
      description:
        "Le conseil demande est introuvable. Retournez a la bibliotheque de conseils emploi sur JobAlert CI.",
      path: "/conseils",
      image: "/screen.png",
      imageAlt: "Conseil introuvable sur JobAlert CI",
      type: "website",
      locale: "fr_CI",
      noindex: true,
    }
  }

  const articleSlug = slug || article.slug
  const title = `${article.titre} | Conseils emploi | JobAlert CI`
  const description = clampText(
    contenu?.intro
      ? `${contenu.intro} ${article.extrait}`
      : `${article.extrait} Conseil emploi ecrit a partir des offres collectees par JobAlert CI.`
  )
  const categoryLabel = cat?.label || article.cat
  const keywords = joinKeywords(
    article.titre,
    categoryLabel,
    "conseils emploi Cote d'Ivoire",
    article.extrait,
    contenu?.tags || []
  )

  return {
    title,
    description,
    path: `/conseils/${articleSlug}`,
    image: "/screen.png",
    imageAlt: `${article.titre} sur JobAlert CI`,
    keywords,
    type: "article",
    locale: "fr_CI",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          "@id": `${siteUrl}/conseils/${articleSlug}#article`,
          mainEntityOfPage: `${siteUrl}/conseils/${articleSlug}`,
          headline: article.titre,
          description,
          articleSection: categoryLabel,
          inLanguage: "fr-CI",
          isPartOf: {
            "@id": `${siteUrl}/#website`,
          },
          about: {
            "@id": `${siteUrl}/#service`,
          },
          author: {
            "@type": "Organization",
            name: SITE_NAME,
            url: `${siteUrl}/`,
          },
          publisher: {
            "@id": `${siteUrl}/#organization`,
          },
          image: absoluteUrl("/screen.png"),
        },
        makeBreadcrumb([
          { name: "Accueil", url: `${siteUrl}/` },
          { name: "Conseils", url: `${siteUrl}/conseils` },
          { name: article.titre, url: `${siteUrl}/conseils/${articleSlug}` },
        ]),
      ],
    },
  }
}

export const mentionsLegalesSeo = () => ({
  title: "Mentions legales JobAlert CI | Donnees, cookies et contact",
  description:
    "Consultez les mentions legales de JobAlert CI : editeur du site, donnees personnelles, cookies, propriete intellectuelle, responsabilite et contact.",
  path: "/mentions-legales",
  image: "/screen.png",
  imageAlt: "Mentions legales de JobAlert CI",
  keywords:
    "mentions legales JobAlert CI, donnees personnelles, cookies, propriete intellectuelle, responsabilite, contact",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/mentions-legales#webpage`,
        url: `${siteUrl}/mentions-legales`,
        name: "Mentions legales JobAlert CI | Donnees, cookies et contact",
        description:
          "Consultez les mentions legales de JobAlert CI : editeur du site, donnees personnelles, cookies, propriete intellectuelle, responsabilite et contact.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
        primaryImageOfPage: absoluteUrl("/screen.png"),
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "Mentions legales", url: `${siteUrl}/mentions-legales` },
      ]),
    ],
  },
})

export const faqSeo = () => ({
  title: "FAQ JobAlert CI | Gratuit, sources et alerte 8h00",
  description:
    "Trouvez les reponses aux questions frequentes sur JobAlert CI : gratuit, collecte, sources, alerte emploi a 8h00, confidentialite et inscription.",
  path: "/faq",
  image: "/screen.png",
  imageAlt: "Foire aux questions JobAlert CI",
  keywords:
    "FAQ JobAlert CI, questions frequentes, alerte emploi 8h00, sources, confidentialite, inscription",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/faq#faqpage`,
        url: `${siteUrl}/faq`,
        name: "FAQ JobAlert CI | Gratuit, sources et alerte 8h00",
        description:
          "Trouvez les reponses aux questions frequentes sur JobAlert CI : gratuit, collecte, sources, alerte emploi a 8h00, confidentialite et inscription.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "FAQ", url: `${siteUrl}/faq` },
      ]),
    ],
  },
})

export const contactSeo = () => ({
  title: "Contact JobAlert CI | Support, source et partenariat",
  description:
    "Contactez l'equipe JobAlert CI pour une question sur le service, votre alerte emploi, une source a ajouter ou un partenariat.",
  path: "/contact",
  image: "/screen.png",
  imageAlt: "Page de contact JobAlert CI",
  keywords:
    "contact JobAlert CI, support, partenariat, source, question alerte, email",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        "@id": `${siteUrl}/contact#webpage`,
        url: `${siteUrl}/contact`,
        name: "Contact JobAlert CI | Support, source et partenariat",
        description:
          "Contactez l'equipe JobAlert CI pour une question sur le service, votre alerte emploi, une source a ajouter ou un partenariat.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
        primaryImageOfPage: absoluteUrl("/screen.png"),
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "Contact", url: `${siteUrl}/contact` },
      ]),
    ],
  },
})

export const sourcesSeo = ({ total = 4 } = {}) => ({
  title: "Sources JobAlert CI | 4 sources emploi surveillees",
  description:
    `Découvrez les ${Number(total).toLocaleString("fr-FR")} sources surveillées par JobAlert CI : EmploiDakar CI, GoAfrica, Novojob et LinkedIn, avec collecte, dédoublonnage et fiabilite du flux.`,
  path: "/sources",
  image: "/screen.png",
  imageAlt: "Sources surveillées par JobAlert CI",
  keywords:
    "sources JobAlert CI, EmploiDakar CI, GoAfrica, Novojob, LinkedIn, collecte offres emploi",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/sources#webpage`,
        url: `${siteUrl}/sources`,
        name: "Sources JobAlert CI | 4 sources emploi surveillees",
        description:
          `Découvrez les ${Number(total).toLocaleString("fr-FR")} sources surveillées par JobAlert CI : EmploiDakar CI, GoAfrica, Novojob et LinkedIn, avec collecte, dédoublonnage et fiabilite du flux.`,
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
        primaryImageOfPage: absoluteUrl("/screen.png"),
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "Sources", url: `${siteUrl}/sources` },
      ]),
    ],
  },
})

export const registeredSeo = () => ({
  title: "Inscription JobAlert CI | Alerte emploi gratuite a 8h00",
  description:
    "Créez votre alerte emploi JobAlert CI en quelques minutes : choisissez 1 a 3 filieres, recevez vos offres a 8h00 et desinscrivez-vous en un clic.",
  path: "/inscription",
  image: "/screen.png",
  imageAlt: "Inscription JobAlert CI",
  keywords:
    "inscription JobAlert CI, alerte emploi 8h00, filieres emploi, offres d'emploi Cote d'Ivoire, gratuit",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/inscription#webpage`,
        url: `${siteUrl}/inscription`,
        name: "Inscription JobAlert CI | Alerte emploi gratuite a 8h00",
        description:
          "Créez votre alerte emploi JobAlert CI en quelques minutes : choisissez 1 a 3 filieres, recevez vos offres a 8h00 et desinscrivez-vous en un clic.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
        primaryImageOfPage: absoluteUrl("/screen.png"),
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "Inscription", url: `${siteUrl}/inscription` },
      ]),
    ],
  },
})

export const confirmationSeo = () => ({
  title: "Confirmation d'inscription | JobAlert CI",
  description:
    "Confirmez votre adresse email pour activer votre alerte quotidienne d'offres d'emploi JobAlert CI.",
  path: "/inscription/confirmation",
  image: "/screen.png",
  imageAlt: "Confirmation d'inscription JobAlert CI",
  keywords: "confirmation email, validation alerte emploi, JobAlert CI",
  type: "website",
  locale: "fr_CI",
  structuredData: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/inscription/confirmation#webpage`,
        url: `${siteUrl}/inscription/confirmation`,
        name: "Confirmation d'inscription | JobAlert CI",
        description:
          "Confirmez votre adresse email pour activer votre alerte quotidienne d'offres d'emploi JobAlert CI.",
        inLanguage: "fr-CI",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        about: {
          "@id": `${siteUrl}/#service`,
        },
        primaryImageOfPage: absoluteUrl("/screen.png"),
      },
      makeBreadcrumb([
        { name: "Accueil", url: `${siteUrl}/` },
        { name: "Inscription", url: `${siteUrl}/inscription` },
        { name: "Confirmation", url: `${siteUrl}/inscription/confirmation` },
      ]),
    ],
  },
})

