import { createContext, useContext, useEffect, useMemo, useRef } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Logs & emails (cycle 17).
   Trois onglets aux filtres serveur distincts, UN contexte pour toute
   la page (les onglets partagent l'URL) :
   - Événements : level, source_id, plage de dates ;
   - Contacts   : status (vocabulaire API : new|read|replied|archived|spam) ;
   - Emails tx  : purpose (6 valeurs), status, recherche to_email
     (debouncée, le hook de la page enveloppe setScalar BRUT).
   Pagination : listes PLATES sans total → pages séparées par onglet
   et heuristique len == limit côté page.
───────────────────────────────────────────────────────────────────── */

const TAILLE_PAGE_EVENTS = 50
const TAILLE_PAGE_CONTACTS = 20
const TAILLE_PAGE_EMAILS = 50

const CONFIG_FILTRES_LOGS_ADMIN = {
  scalars: [
    { key: "onglet", param: "onglet", defaut: "events" },
    { key: "niveau", param: "niveau", defaut: "" },
    { key: "source", param: "source", defaut: "" },
    { key: "debutEvents", param: "debut_events", defaut: "" },
    { key: "finEvents", param: "fin_events", defaut: "" },
    { key: "statutContact", param: "statut", defaut: "" },
    { key: "motif", param: "motif", defaut: "" },
    { key: "statutEmail", param: "statut_email", defaut: "" },
    { key: "recherche", param: "recherche", defaut: "" },
    { key: "pageEvents", param: "page_events", defaut: "1" },
    { key: "pageContacts", param: "page_contacts", defaut: "1" },
    { key: "pageEmails", param: "page_emails", defaut: "1" },
  ],
}

const FiltresLogsContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresLogsAdmin = () => {
  const ctx = useContext(FiltresLogsContext)
  if (!ctx) {
    throw new Error("useFiltresLogsAdmin doit être utilisé sous <FiltresLogsAdminProvider>")
  }
  return ctx
}

const _page = (valeur) => Math.max(1, parseInt(valeur, 10) || 1)

export const FiltresLogsAdminProvider = ({ children }) => {
  const { valeurs, setScalar } = useUrlFilters(CONFIG_FILTRES_LOGS_ADMIN)

  /* Reset RÉACTIF de la page de chaque onglet : dès que la signature de
     ses filtres change, sa page revient à 1 — sans jamais doubler les
     setScalar dans les setters. */
  const signatureEvents = `${valeurs.niveau}|${valeurs.source}|${valeurs.debutEvents}|${valeurs.finEvents}`
  const signatureContacts = valeurs.statutContact
  const signatureEmails = `${valeurs.motif}|${valeurs.statutEmail}|${valeurs.recherche}`
  const signaturesPrecedentes = useRef({
    events: signatureEvents,
    contacts: signatureContacts,
    emails: signatureEmails,
  })

  useEffect(() => {
    if (signaturesPrecedentes.current.events !== signatureEvents) {
      signaturesPrecedentes.current.events = signatureEvents
      if (valeurs.pageEvents !== "1") setScalar("page_events", "1")
    }
    if (signaturesPrecedentes.current.contacts !== signatureContacts) {
      signaturesPrecedentes.current.contacts = signatureContacts
      if (valeurs.pageContacts !== "1") setScalar("page_contacts", "1")
    }
    if (signaturesPrecedentes.current.emails !== signatureEmails) {
      signaturesPrecedentes.current.emails = signatureEmails
      if (valeurs.pageEmails !== "1") setScalar("page_emails", "1")
    }
  }, [
    signatureEvents, signatureContacts, signatureEmails,
    valeurs.pageEvents, valeurs.pageContacts, valeurs.pageEmails, setScalar,
  ])

  const valeur = useMemo(
    () => ({
      onglet: ["events", "contacts", "emails"].includes(valeurs.onglet) ? valeurs.onglet : "events",
      niveau: valeurs.niveau,
      source: valeurs.source,
      // Audit 4, A.7 : plage de dates des événements (AAAA-MM-JJ, inclusives).
      debutEvents: valeurs.debutEvents,
      finEvents: valeurs.finEvents,
      statutContact: valeurs.statutContact,
      motif: valeurs.motif,
      statutEmail: valeurs.statutEmail,
      recherche: valeurs.recherche,
      pageEvents: _page(valeurs.pageEvents),
      pageContacts: _page(valeurs.pageContacts),
      pageEmails: _page(valeurs.pageEmails),
      paramsEvents: {
        level: valeurs.niveau || undefined,
        source_id: valeurs.source || undefined,
        date_debut: valeurs.debutEvents || undefined,
        date_fin: valeurs.finEvents || undefined,
        limit: TAILLE_PAGE_EVENTS,
        offset: (_page(valeurs.pageEvents) - 1) * TAILLE_PAGE_EVENTS,
      },
      paramsContacts: {
        status: valeurs.statutContact || undefined,
        limit: TAILLE_PAGE_CONTACTS,
        offset: (_page(valeurs.pageContacts) - 1) * TAILLE_PAGE_CONTACTS,
      },
      // Recherche email : ilike partiel — le % encadre le terme (le serveur
      // fait un ilike si le motif contient %, match exact sinon).
      paramsEmails: {
        purpose: valeurs.motif || undefined,
        status: valeurs.statutEmail || undefined,
        to_email: valeurs.recherche ? `%${valeurs.recherche}%` : undefined,
        limit: TAILLE_PAGE_EMAILS,
        offset: (_page(valeurs.pageEmails) - 1) * TAILLE_PAGE_EMAILS,
      },
      setScalar, // BRUT — la recherche debouncée l'enveloppe côté page
      /* UN seul setScalar par setter — la remise à 1 de la page est
         gérée par l'effet réactif ci-dessus. */
      setOnglet: (v) => setScalar("onglet", v),
      setNiveau: (v) => setScalar("niveau", v),
      setSource: (v) => setScalar("source", v),
      setDebutEvents: (v) => setScalar("debut_events", v),
      setFinEvents: (v) => setScalar("fin_events", v),
      setStatutContact: (v) => setScalar("statut", v),
      setMotif: (v) => setScalar("motif", v),
      setStatutEmail: (v) => setScalar("statut_email", v),
      setPageEvents: (v) => setScalar("page_events", v),
      setPageContacts: (v) => setScalar("page_contacts", v),
      setPageEmails: (v) => setScalar("page_emails", v),
      reinitialiserEvents: () => {
        setScalar("niveau", "")
        setScalar("source", "")
        setScalar("debut_events", "")
        setScalar("fin_events", "")
      },
      reinitialiserContacts: () => setScalar("statut", ""),
      reinitialiserEmails: () => {
        setScalar("motif", "")
        setScalar("statut_email", "")
        setScalar("recherche", "")
      },
    }),
    [valeurs, setScalar]
  )

  return <FiltresLogsContext.Provider value={valeur}>{children}</FiltresLogsContext.Provider>
}