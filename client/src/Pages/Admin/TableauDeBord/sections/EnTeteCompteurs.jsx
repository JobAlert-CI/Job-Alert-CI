import { useAdminOverviewQuery } from "@/features/admin-dashboard.tools"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur } from "../components/EtatsSection"
import { Badge } from "@/components/ui/badge"
import StatusChip from "@/components/shared/StatusChip"

/* ─────────────────────────────────────────────────────────────────────
   Section 1 — En-tête du dashboard : salutation + 6 compteurs +
   état du dernier run + digests en attente. Un seul appel agrégé
   (getOverview) alimente toute la section (doc v3 §2 : "chargement
   d'un seul appel agrégé pour tout l'en-tête").
   ───────────────────────────────────────────────────────────────────── */

const libelleStatutRun = {
  success: "Réussi",
  running: "En cours",
  pending: "En attente",
  failed: "Échoué",
}

const EnTeteCompteurs = () => {
  const { profile } = useAdminAuth()
  const { data, isLoading, isError, refetch } = useAdminOverviewQuery()

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger la vue d'ensemble." />
  }

  const statutRun = data?.last_scrape_status
  const aRun = !!data?.last_scrape_run_at
  const chipTone = statutRun === "success" ? "emerald" : statutRun === "running" || statutRun === "pending" ? "navy" : "orange"

  return (
    <section aria-label="Vue d'ensemble" className="flex flex-col gap-4">
      {/* Salutation + statut du dernier run */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-bold">
            Bonjour {profile?.full_name?.split(" ")[0] ?? ""} 👋
          </h1>
          <p className="text-xs text-muted-foreground">
            Voici l'état du système en un coup d'œil.
          </p>
        </div>
        {aRun && (
          <StatusChip tone={chipTone} ping={statutRun === "running"} tooltip={`Dernier scraping : ${libelleStatutRun[statutRun] ?? statutRun}`}>
            Dernier scraping : {libelleStatutRun[statutRun] ?? statutRun}
          </StatusChip>
        )}
        {!isLoading && data?.pending_digests > 0 && (
          <Badge variant="secondary">
            {data.pending_digests} digest{data.pending_digests > 1 ? "s" : ""} en file
          </Badge>
        )}
      </div>

      {/* 6 compteurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <CarteCompteur label="Offres totales" valeur={data?.offers_total} chargement={isLoading} href="/admin/offres" />
        <CarteCompteur label="Offres actives" valeur={data?.offers_active} chargement={isLoading} href="/admin/offres" query="?status=active" />
        <CarteCompteur label="Abonnés" valeur={data?.subscribers_total} chargement={isLoading} href="/admin/utilisateurs" />
        <CarteCompteur label="Abonnés actifs" valeur={data?.subscribers_active} chargement={isLoading} href="/admin/utilisateurs" query="?status=active" />
        <CarteCompteur label="Messages nouveaux" valeur={data?.contact_messages_new} chargement={isLoading} href="/admin/logs" />
        <CarteCompteur label="Sources actives" valeur={data?.sources_active} chargement={isLoading} href="/admin/sources" />
      </div>
    </section>
  )
}

export default EnTeteCompteurs
