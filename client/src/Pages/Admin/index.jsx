import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import Seo from "@/components/seo/Seo"
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuth.context"
import { ToastProvider, useToast } from "./components/AdminToast"
import { HeroAdmin } from "./components/HeroAdmin"
import { AdminTicker } from "./components/AdminTicker"
import { AdminTabsBar } from "./components/AdminTabsBar"
import { AdminConfirmDialog } from "./components/AdminConfirmDialog"
import { AdminLogin } from "./AdminLogin"
import { useAdminMutations } from "@/tools/admin.tools"

// Sections
import { DashboardSection } from "./sections/DashboardSection"
import { LogsSection } from "./sections/LogsSection"
import { ScrapersSection } from "./sections/ScrapersSection"
import { UsersSection } from "./sections/UsersSection"
import { OffersSection } from "./sections/OffersSection"
import { SourcesSection } from "./sections/SourcesSection"
import { FilieresSection } from "./sections/FilieresSection"

// Registre déclaratif pur des composants (aucun switch utilisé)
const SECTION_REGISTRY = {
  dashboard: DashboardSection,
  logs: LogsSection,
  scrapers: ScrapersSection,
  users: UsersSection,
  offers: OffersSection,
  sources: SourcesSection,
  filieres: FilieresSection,
}

const AdminPageContent = () => {
  const { isAuthenticated, loading } = useAdminAuth()
  const toast = useToast()
  const { triggerScrapeMutation } = useAdminMutations()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get("tab") || "dashboard"
  const [confirmScrapeOpen, setConfirmScrapeOpen] = useState(false)

  const handleSelectTab = (tabId) => {
    setSearchParams({ tab: tabId })
  }

  const handleGlobalScrape = async () => {
    try {
      await triggerScrapeMutation.mutateAsync({ notes: "Scraping manuel déclenché depuis le Héro" })
      toast.success("Collecte déclenchée", "Le scraping de toutes les sources actives a démarré.")
    } catch {
      toast.error("Erreur", "Impossible d'initier la collecte.")
    } finally {
      setConfirmScrapeOpen(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-brand-navy border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-on-surface-variant">
            Chargement de la console d'administration...
          </span>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <AdminLogin />
  }

  const ActiveComponent = SECTION_REGISTRY[activeTab] || SECTION_REGISTRY.dashboard

  return (
    <>
      <Seo
        title="JobAlert CI | Console d'Administration"
        description="Espace d'administration et de supervision des offres, scrapers et abonnements JobAlert CI."
        path="/admin"
      />
      <main className="min-h-screen bg-surface dark:bg-zinc-950 pb-20">
        <AdminTicker />
        <HeroAdmin onTriggerScrapeClick={() => setConfirmScrapeOpen(true)} />
        <AdminTabsBar activeTab={activeTab} onSelectTab={handleSelectTab} />

        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12 pt-8">
          <ActiveComponent onNavigateSection={handleSelectTab} />
        </div>

        <AdminConfirmDialog
          isOpen={confirmScrapeOpen}
          onClose={() => setConfirmScrapeOpen(false)}
          onConfirm={handleGlobalScrape}
          title="Lancer une collecte manuelle immédiate ?"
          message="Tous les robots de scraping (Novojob, LinkedIn, EmploiDakar, GoAfrica) vont scanner les annonces fraîches et les intégrer au flux."
          confirmText="Démarrer la collecte"
          variant="primary"
          loading={triggerScrapeMutation.isPending}
        />
      </main>
    </>
  )
}

const Admin = () => (
  <AdminAuthProvider>
    <ToastProvider>
      <AdminPageContent />
    </ToastProvider>
  </AdminAuthProvider>
)

export default Admin
