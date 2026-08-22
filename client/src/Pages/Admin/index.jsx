import { useState } from "react"
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuth.context"
import { ToastProvider } from "./components/AdminToast"
import { AdminSidebar } from "./components/AdminSidebar"
import { AdminHeader } from "./components/AdminHeader"
import { AdminLogin } from "./AdminLogin"

// Sections
import { DashboardSection } from "./sections/DashboardSection"
import { LogsSection } from "./sections/LogsSection"
import { ScrapersSection } from "./sections/ScrapersSection"
import { UsersSection } from "./sections/UsersSection"
import { OffersSection } from "./sections/OffersSection"
import { SourcesSection } from "./sections/SourcesSection"
import { FilieresSection } from "./sections/FilieresSection"

const AdminDashboardContent = () => {
  const { isAuthenticated, loading } = useAdminAuth()

  const [activeSection, setActiveSection] = useState("dashboard")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-brand-navy border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-on-surface-variant">
            Initialisation de l'espace administration...
          </span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AdminLogin />
  }

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardSection onNavigateSection={(sec) => setActiveSection(sec)} />
      case "logs":
        return <LogsSection />
      case "scrapers":
        return <ScrapersSection />
      case "users":
        return <UsersSection />
      case "offers":
        return <OffersSection />
      case "sources":
        return <SourcesSection />
      case "filieres":
        return <FilieresSection />
      default:
        return <DashboardSection onNavigateSection={(sec) => setActiveSection(sec)} />
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-surface dark:bg-zinc-950 text-on-surface dark:text-zinc-100 font-sans antialiased">
      {/* Sidebar */}
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          activeSection={activeSection}
          onMobileOpen={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {renderSection()}
        </main>
      </div>
    </div>
  )
}

const Admin = () => {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <AdminDashboardContent />
      </ToastProvider>
    </AdminAuthProvider>
  )
}

export default Admin
