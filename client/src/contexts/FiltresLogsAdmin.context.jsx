import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Logs & emails (cycle 17).

   Trois onglets aux filtres serveur distincts, UN context pour toute la
   page (les onglets partagent l'URL) :
   - Événements : level, source_id ;
   - Contacts   : status (vocabulaire API : new|read|replied|archived|spam) ;
   - Emails tx  : purpose (6 valeurs), status, recherche to_email (debouncée,
     le hook de la page enveloppe setScalar BRUT — piège « q=query »).

   Pagination : les 3 listes sont PLATES sans total → pages séparées par
   onglet (page_events, page_contacts, page_emails) et heuristique
   len == limit côté page, pattern PaginationListe.

   Expose `onglet` pour que les compteurs/charts de chaque onglet
   n'invalident que leurs clés.
   ───────────────────────────────────────────────────────────────────── */

const TAILLE_PAGE_EVENTS = 50
const TAILLE_PAGE_CONTACTS = 20
const TAILLE_PAGE_EMAILS = 50

const CONFIG_FILTRES_LOGS_ADMIN = {
  scalars: [
    { key: "onglet", param: "onglet", defaut: "events" },
    { key: "niveau", param: "niveau", defaut: "" },
    { key: "source", param: "source", defaut: "" },
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

  const valeur = useMemo(
    () => ({
      onglet: ["events", "contacts", "emails"].includes(valeurs.onglet) ? valeurs.onglet : "events",
      niveau: valeurs.niveau,
      source: valeurs.source,
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
      setScalar, // BRUT — la recherche debouncée le reçoit directement
      setOnglet: (v) => setScalar("onglet", v),
      setNiveau: (v) => { setScalar("niveau", v); setScalar("page_events", "1") },
      setSource: (v) => { setScalar("source", v); setScalar("page_events", "1") },
      setStatutContact: (v) => { setScalar("statut", v); setScalar("page_contacts", "1") },
      setMotif: (v) => { setScalar("motif", v); setScalar("page_emails", "1") },
      setStatutEmail: (v) => { setScalar("statut_email", v); setScalar("page_emails", "1") },
      setPageEvents: (v) => setScalar("page_events", v),
      setPageContacts: (v) => setScalar("page_contacts", v),
      setPageEmails: (v) => setScalar("page_emails", v),
      reinitialiserEvents: () => { setScalar("niveau", ""); setScalar("source", ""); setScalar("page_events", "1") },
      reinitialiserContacts: () => { setScalar("statut", ""); setScalar("page_contacts", "1") },
      reinitialiserEmails: () => { setScalar("motif", ""); setScalar("statut_email", ""); setScalar("recherche", ""); setScalar("page_emails", "1") },
    }),
    [valeurs, setScalar]
  )

  return <FiltresLogsContext.Provider value={valeur}>{children}</FiltresLogsContext.Provider>
}
