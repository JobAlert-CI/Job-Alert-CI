import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  Activity, BrainCircuit, Briefcase, Building2, ChevronRight, FileClock,
  Globe, KeyRound, LayoutDashboard, LogOut, Menu, Newspaper, Radar,
  ScrollText, Search, Settings2, ShieldCheck, Users,
} from "lucide-react"
import { cn } from "cn"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { ROLE_LABELS, SESSION_REVOQUEE_MESSAGE } from "@/features/admin-auth.tools"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAdminGlobalSearchQuery } from "@/features/admin-search.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useNotify } from "@/contexts/Notify.context"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"

/* ─────────────────────────────────────────────────────────────────────
   Layout back-office : sidebar filtrée par rôle + header avec
   recherche globale + menu compte. Séparé du layout public (Header /
   Footer) : aucune navigation publique n'apparaît ici.

   Les entrées portent les rôles EXACTS de require_roles côté serveur
   (vérifiés router par router en Phase 0) :
   - dashboard            → get_current_admin seul (tous rôles)
   - offers + export offres → super_admin, gestionnaire_offres
   - companies            → super_admin
   - subscribers + sending + emails transactionnels + export abonnés
                          → super_admin, gestionnaire_utilisateurs
   - scraping             → super_admin
   - referentials (filieres, sources, contract-types…) → super_admin
   - content              → super_admin, moderateur
   - admins               → super_admin
   - logs (audit + events + contacts) → super_admin
   - settings             → super_admin
   - ai                   → super_admin
   - system health        → super_admin
   ───────────────────────────────────────────────────────────────────── */

const NAV_SECTIONS = [
  {
    titre: "Pilotage",
    items: [
      { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, roles: [] },
      { to: "/admin/scraping", label: "Scraping", icon: Radar, roles: ["super_admin"] },
      { to: "/admin/ia", label: "Normalisation IA", icon: BrainCircuit, roles: ["super_admin"] },
      { to: "/admin/systeme", label: "Santé du système", icon: Activity, roles: ["super_admin"] },
    ],
  },
  {
    titre: "Métier",
    items: [
      { to: "/admin/offres", label: "Offres", icon: Briefcase, roles: ["super_admin", "gestionnaire_offres"] },
      { to: "/admin/entreprises", label: "Entreprises", icon: Building2, roles: ["super_admin"] },
      { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["super_admin", "gestionnaire_utilisateurs"] },
    ],
  },
  {
    titre: "Référentiels",
    items: [
      { to: "/admin/filieres", label: "Filières", icon: KeyRound, roles: ["super_admin"] },
      { to: "/admin/sources", label: "Sources", icon: Globe, roles: ["super_admin"] },
    ],
  },
  {
    titre: "Contenu & sécurité",
    items: [
      { to: "/admin/contenu", label: "Contenu", icon: Newspaper, roles: ["super_admin", "moderateur"] },
      { to: "/admin/administrateurs", label: "Administrateurs", icon: ShieldCheck, roles: ["super_admin"] },
      { to: "/admin/journal", label: "Journal d'activité", icon: ScrollText, roles: ["super_admin"] },
      { to: "/admin/logs", label: "Logs & emails", icon: FileClock, roles: ["super_admin"] },
      { to: "/admin/parametres", label: "Paramètres", icon: Settings2, roles: ["super_admin"] },
    ],
  },
]

/* ─── Sidebar ───────────────────────────────────────────────────────── */

const NavItem = ({ item, onNavigate }) => {
  const Icone = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === "/admin"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          isActive
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        )
      }
    >
      <Icone className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

const SidebarNav = ({ role, onNavigate }) => {
  const sectionsVisibles = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !item.roles.length || item.roles.includes(role)
        ),
      })).filter((section) => section.items.length > 0),
    [role]
  )

  return (
    <nav aria-label="Navigation du back-office" className="flex flex-col gap-5 p-3">
      {sectionsVisibles.map((section) => (
        <div key={section.titre} className="flex flex-col gap-1">
          <p className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
            {section.titre}
          </p>
          {section.items.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  )
}

/* ─── Recherche globale ─────────────────────────────────────────────── */

const SearchResultGroup = ({ titre, items, renderLabel, renderHref, onNavigate }) => {
  if (!items?.length) return null
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 pt-1.5 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
        {titre}
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(renderHref(item))}
          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="truncate">{renderLabel(item)}</span>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  )
}

/**
 * Recherche globale : input → debounce 350 ms → GET /api/admin/search.
 * Résultats groupés par type, plafonnés à 10 par groupe. Fermée au clic
 * extérieur / Escape. Le rôle moderateur n'a pas accès à la route
 * (require_roles serveur) : message dédié au lieu d'une erreur 403 brute.
 */
const GlobalSearch = () => {
  const { role } = useAdminAuth()
  const navigate = useNavigate()
  const [valeur, setValeur] = useState("")
  const [valeurCommittee, setValeurCommittee] = useState("")
  const [ouvert, setOuvert] = useState(false)
  const containerRef = useRef(null)

  // Debounce local : la saisie ne déclenche jamais d'appel immédiat.
  useEffect(() => {
    const timer = setTimeout(() => setValeurCommittee(valeur.trim()), 350)
    return () => clearTimeout(timer)
  }, [valeur])

  const { data, isFetching } = useAdminGlobalSearchQuery(valeurCommittee, {
    enabled: ouvert,
  })

  // Fermeture au clic extérieur + Escape.
  useEffect(() => {
    if (!ouvert) return
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOuvert(false)
      }
    }
    const onKeyDown = (e) => e.key === "Escape" && setOuvert(false)
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [ouvert])

  const aResultats = !!(
    data &&
    (data.offers?.length || data.subscribers?.length || data.companies?.length)
  )
  const goto = useCallback(
    (href) => {
      navigate(href)
      setOuvert(false)
    },
    [navigate]
  )

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={valeur}
          onChange={(e) => {
            setValeur(e.target.value)
            setOuvert(true)
          }}
          onFocus={() => setOuvert(true)}
          placeholder="Rechercher une offre, un abonné, une entreprise…"
          aria-label="Recherche globale (offres, abonnés, entreprises)"
          aria-expanded={ouvert}
          className="pl-8"
        />
        {isFetching && ouvert && (
          <Spinner className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
        )}
      </div>

      {ouvert && role !== "moderateur" && (
        <div
          role="listbox"
          aria-label="Résultats de recherche globale"
          className="absolute top-full left-0 z-50 mt-1.5 w-full rounded-lg border border-border bg-popover p-1.5 shadow-lg"
        >
          {!valeurCommittee ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Saisissez au moins un caractère pour lancer la recherche.
            </p>
          ) : isFetching && !data ? (
            <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Spinner className="size-3.5" /> Recherche en cours…
            </p>
          ) : !aResultats ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Aucun résultat pour « {valeurCommittee} ».
            </p>
          ) : (
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              <SearchResultGroup
                titre="Offres"
                items={data.offers}
                renderLabel={(o) => o.title}
                renderHref={(o) => `/admin/offres/${o.id}`}
                onNavigate={goto}
              />
              <SearchResultGroup
                titre="Abonnés"
                items={data.subscribers}
                renderLabel={(s) => s.full_name ? `${s.full_name} (${s.email})` : s.email}
                renderHref={(s) => `/admin/utilisateurs/${s.id}`}
                onNavigate={goto}
              />
              <SearchResultGroup
                titre="Entreprises"
                items={data.companies}
                renderLabel={(c) => c.name}
                renderHref={(c) => `/admin/entreprises?focus=${c.id}`}
                onNavigate={goto}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Menu compte ────────────────────────────────────────────────────── */

const CompteMenu = ({ profile, onLogout }) => {
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "—"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 px-2 font-medium">
            <span className="hidden max-w-40 truncate sm:inline">
              {profile?.full_name || "Compte"}
            </span>
            <Badge variant="secondary">{roleLabel}</Badge>
          </Button>
        }
      />
      <DropdownMenuContent align="end" side="bottom" className="min-w-48">
        {/* base-ui : label de groupe TOUJOURS dans <DropdownMenuGroup>. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate">{profile?.email}</span>
            <span className="block text-[10px] text-muted-foreground">{roleLabel}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout} className="cursor-pointer">
          <LogOut className="size-3.5" aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Layout ─────────────────────────────────────────────────────────── */

const AdminLayout = () => {
  const { profile, role, logout } = useAdminAuth()
  const notify = useNotify()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false)
  const [sessionRevoquee, setSessionRevoquee] = useState(false)

  // Cycle 15 : compte créé avec mot de passe temporaire → barrière de
  // sécurité. /me expose must_change_password (vérifié serveur) : tant
  // qu'il est true, AUCUNE page admin n'est accessible — l'écran de
  // changement de mot de passe est le seul chemin. Couvre le cas d'un
  // onglet déjà ouvert ou d'un refresh token encore valide.
  useEffect(() => {
    if (profile?.must_change_password) {
      navigate("/admin/premiere-connexion", { replace: true })
    }
  }, [profile?.must_change_password, navigate])

  // Détection transverse : axiosAdmin émet "jobalert:admin-session-revoquee"
  // quand le refresh échoue (famille révoquée serveur). queryClient.clear()
  // est déjà déclenché côté queryClient.js — ici on n'affiche que le message.
  useEffect(() => {
    const onRevoke = () => setSessionRevoquee(true)
    window.addEventListener("jobalert:admin-session-revoquee", onRevoke)
    return () => window.removeEventListener("jobalert:admin-session-revoquee", onRevoke)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      // Serveur injoignable : tokens déjà purgés par la mutation (onMutate),
      // la déconnexion locale reste valide.
    } finally {
      notify("Déconnexion réussie", "success")
      navigate("/admin/connexion", { replace: true })
    }
  }, [logout, navigate, notify])

  // Message dédié quand la famille de refresh a été révoquée serveur
  // (reuse détecté) : invitation à se reconnecter, pas une erreur générique.
  useEffect(() => {
    if (sessionRevoquee) {
      notify(SESSION_REVOQUEE_MESSAGE, "warning", 0)
    }
  }, [sessionRevoquee, notify])

  return (
    <div className="flex min-h-svh bg-background">
      {/* Sidebar desktop */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/50 lg:flex"
        aria-label="Barre latérale du back-office"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <Link to="/" className="text-sm font-black text-primary">
            JobAlert CI
          </Link>
          <Badge variant="outline" className="text-[10px]">
            Back-office
          </Badge>
        </div>
        <SidebarNav role={role} />
        <div className="mt-auto border-t border-border p-3 text-[10px] text-muted-foreground">
          v1 — accès restreint
        </div>
      </aside>

      {/* Sidebar mobile (Sheet) */}
      {isMobile && (
        <Sheet open={menuMobileOuvert} onOpenChange={setMenuMobileOuvert}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border">
              <SheetTitle>JobAlert CI — Back-office</SheetTitle>
              <SheetDescription className="sr-only">
                Navigation du back-office
              </SheetDescription>
            </SheetHeader>
            <SidebarNav role={role} onNavigate={() => setMenuMobileOuvert(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-sm sm:px-4">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuMobileOuvert(true)}
            >
              <Menu className="size-4" aria-hidden />
            </Button>
          )}
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <CompteMenu profile={profile} onLogout={handleLogout} />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
