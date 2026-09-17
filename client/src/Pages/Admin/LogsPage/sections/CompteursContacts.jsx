import { Archive, Inbox, MailOpen, OctagonAlert, Reply } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { STATUTS_CONTACT, useLogsStatsQuery, } from "@/features/admin-logs.tools"

const ICON_COMPT = {
  new: Inbox,
  read: MailOpen,
  replied: Reply,
  archived: Archive,
  spam: OctagonAlert,
}

const CompteursContacts = () => {
  const { data: stats, isError, refetch } = useLogsStatsQuery(30)
  return (
    <TransitionEtat etat={isError ? "erreur" : "donnees"} >
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 xl:grid-cols-5">
          {STATUTS_CONTACT.map((s, i) => (
            <CarteCompteur
              key={`statut-${s.valeur}`}
              label={`${s.libelle} (30 j)`}
              valeur={stats?.contacts_par_statut?.[s.valeur] ?? 0}
              icone={ICON_COMPT[s.valeur]}
              href="/admin/logs"
              query={`?onglet=contacts&statut=${s.valeur}`}
              className={i in [0, 1, 2] ? "sm:col-span-2 xl:col-span-1" : i === 3 ? "sm:col-span-3 xl:col-span-1" : "col-span-2 sm:col-span-3 xl:col-span-1"}
            />
          ))}
        </div>
      )}
    </TransitionEtat>
  )
}

export default CompteursContacts