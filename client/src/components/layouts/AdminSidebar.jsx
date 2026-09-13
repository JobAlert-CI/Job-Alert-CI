import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  BrainCircuit, Briefcase, Building2, ChevronDown, ChevronLeft,
  ChevronRight, FileClock, Globe, HeartPulse, KeyRound, LayoutDashboard, Newspaper,
  PanelsTopLeft, Radar, ScrollText, Search, Settings2, ShieldCheck, User, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { Input } from "../ui/input";


const NAV_SECTIONS = [
  {
    titre: "Pilotage",
    items: [
      { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, end: true, rail: true },
      { to: "/admin/scraping", label: "Scraping", icon: Radar },
      {
        to: "/admin/ia",
        label: "Normalisation IA",
        icon: BrainCircuit,
        children: [
          { onglet: "pilotage", label: "Pilotage" },
          { onglet: "statistiques", label: "Statistiques" },
        ],
        rail: true
      },
      {
        to: "/admin/systeme",
        label: "Santé du système",
        icon: HeartPulse,
        children: [
          { onglet: "sante", label: "Santé" },
          { onglet: "evenements", label: "Événements système" },
          { onglet: "planification", label: "Planification" },
        ],
        rail: true
      },
    ],
  },
  {
    titre: "Métier",
    items: [
      { to: "/admin/offres", label: "Offres", icon: Briefcase, rail: true },
      { to: "/admin/entreprises", label: "Entreprises", icon: Building2 },
      {
        to: "/admin/utilisateurs",
        label: "Utilisateurs",
        icon: Users,
        children: [
          { onglet: "pilotage", label: "Pilotage" },
          { onglet: "statistiques", label: "Statistiques" },
        ],
        rail: true
      },
    ],
  },
  {
    titre: "Référentiels",
    items: [
      { to: "/admin/filieres", label: "Filières", icon: KeyRound },
      { to: "/admin/sources", label: "Sources", icon: Globe },
    ],
  },
  {
    titre: "Contenu & sécurité",
    items: [
      {
        to: "/admin/contenu",
        label: "Contenu",
        icon: Newspaper,
        children: [
          { onglet: "articles", label: "Articles" },
          { onglet: "categories", label: "Catégories" },
          { onglet: "series", label: "Séries" },
          { onglet: "conseils", label: "Conseils du jour" },
          { onglet: "pages", label: "Pages statiques" },
        ],
      },
      { to: "/admin/administrateurs", label: "Administrateurs", icon: ShieldCheck, rail: true },
      { to: "/admin/journal", label: "Journal d'activité", icon: ScrollText, rail: true },
      {
        to: "/admin/logs",
        label: "Logs & emails",
        icon: FileClock,
        children: [
          { onglet: "evenements", label: "Événements techniques" },
          { onglet: "contacts", label: "Messages de contact" },
          { onglet: "emails", label: "Emails transactionnels" },
        ],
      },
      { to: "/admin/parametres", label: "Paramètres", icon: Settings2 },
    ],
  },
];

const RAIL_ICONS = NAV_SECTIONS
  .flatMap((section) => section.items)
  .filter((item) => item.rail);

const estActif = (item, pathname) =>
  item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);

const AdminSidebar = () => {
  const { pathname, search } = useLocation();
  const onglet = useMemo(() => new URLSearchParams(search).get("onglet"), [search]);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Mobile & tablette : la sidebar démarre repliée.
  // - Mobile  : rien d'affiché (pas de rail), seul le bouton flottant subsiste.
  // - Tablette : seul le rail d'icônes est visible par défaut.
  const [replie, setReplie] = useState(isMobile || isTablet);

  const [requete, setRequete] = useState("");
  const [ouverts, setOuverts] = useState(() =>
    NAV_SECTIONS.flatMap((s) => s.items)
      .filter((i) => i.children && estActif(i, pathname))
      .map((i) => i.to),
  );
  const panneauRef = useRef(null);

  const sections = useMemo(() => {
    const q = requete.trim().toLowerCase();
    if (!q) return NAV_SECTIONS;
    return NAV_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((s) => s.items.length > 0);
  }, [requete]);

  const basculer = (to) =>
    setOuverts((p) => (p.includes(to) ? p.filter((x) => x !== to) : [...p, to]));

  // Le viewport passe en mobile → on replie systématiquement.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isMobile || isTablet) setReplie(true);
  }, [isMobile, isTablet]);

  // Mobile + panneau ouvert : overlay. Fermeture au clic extérieur / Escape,
  // et gel du défilement de l'arrière-plan.
  useEffect(() => {
    if (!isMobile || replie) return;
    const onPointerDown = (e) => {
      if (panneauRef.current && !panneauRef.current.contains(e.target)) {
        setReplie(true);
      }
    };
    const onKeyDown = (e) => e.key === "Escape" && setReplie(true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isMobile, replie]);

  // Sur mobile, cliquer un lien referme le panneau.
  const fermerSiMobile = () => {
    if (isMobile) setReplie(true);
  };

  return (
    <aside className="sticky top-0 z-999 flex h-screen shrink-0 bg-brand-navy text-surface-variant">
      {/* Rail d'icônes — masqué sur mobile : seul le bouton « déplier » subsiste */}
      <div className="hidden w-14 flex-col items-center gap-1 border-r border-outline-variant/20 py-3 md:flex">
        <div className="mb-3 grid size-9 place-items-center rounded-lg text-surface-variant">
          <PanelsTopLeft
            className="size-5 cursor-pointer"
            aria-hidden
            onClick={() => setReplie(!replie)}
          />
        </div>
        {RAIL_ICONS.map((item) => {
          const actif = estActif(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "group grid size-9 place-items-center rounded-lg transition-colors",
                actif
                  ? "bg-brand-orange text-white"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100",
              )}
            >
              <item.icon
                className={cn("size-4.5 group-hover:scale-110", actif && "scale-110")}
                aria-hidden
              />
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            to="/admin/parametres"
            title="Paramètres"
            aria-label="Paramètres"
            className={cn(
              "group grid size-9 place-items-center rounded-lg transition-colors",
              estActif({ to: "/admin/parametres" }, pathname)
                ? "bg-brand-orange text-white"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100",
            )}
          >
            <Settings2
              className={cn(
                "size-4.5 group-hover:scale-110",
                estActif({ to: "/admin/parametres" }, pathname) && "scale-110",
              )}
              aria-hidden
            />
          </Link>
          <button
            type="button"
            aria-label="Mon compte"
            className="grid size-8 place-items-center rounded-full border border-slate-700 text-slate-400 transition-colors hover:text-slate-100"
          >
            <User className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Backdrop mobile — ferme le panneau au toucher hors panneau */}
      {isMobile && !replie && (
        <div
          className="fixed inset-0 z-40 bg-brand-navy/50 md:hidden"
          onClick={() => setReplie(true)}
          aria-hidden
        />
      )}

      {/* Panneau : overlay coulissant sur mobile, colonne fluide sur desktop */}
      <div
        ref={panneauRef}
        aria-hidden={isMobile && replie}
        inert={replie || undefined}
        className={cn(
          "flex flex-col overflow-hidden transition-[width,transform] duration-300",
          isMobile
            ? cn(
              "fixed inset-y-0 left-0 z-50 w-67 border-r border-outline-variant/20 bg-brand-navy",
              replie ? "-translate-x-full" : "translate-x-0",
            )
            : cn("border-r border-slate-800", replie ? "w-0" : "w-67"),
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">
            Tableau de bord
          </h2>
          <button
            type="button"
            onClick={() => setReplie(true)}
            aria-label="Replier le panneau"
            className="text-slate-400 transition-colors hover:text-slate-100"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
            <Input
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Recherche dans le back-office"
              className="w-full bg-transparent! text-[13px] shadow-none text-slate-100 outline-none placeholder:text-slate-500 border-none!"
            />
          </div>
        </div>
        <nav
          aria-label="Navigation du back-office"
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin [scrollbar-color:#334155_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700"
        >
          {sections.map((section) => (
            <div key={section.titre} className="mt-4 first:mt-2">
              <p className="px-3 pb-1.5 text-[13px] text-slate-400">{section.titre}</p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const actif = estActif(item, pathname);
                  const ouvert = ouverts.includes(item.to);
                  return (
                    <div key={item.to}>
                      <div
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
                          actif
                            ? "bg-brand-orange text-white"
                            : "text-slate-300 hover:bg-slate-800/60",
                        )}
                      >
                        <Link
                          to={item.to}
                          onClick={fermerSiMobile}
                          className="flex min-w-0 flex-1 items-center gap-2.5 outline-none"
                        >
                          <item.icon
                            className={cn(
                              "size-4 shrink-0 group-hover:scale-110",
                              actif && "scale-110",
                            )}
                            aria-hidden
                          />
                          <span className="truncate text-[13.5px] font-semibold">
                            {item.label}
                          </span>
                        </Link>
                        {item.children && (
                          <button
                            type="button"
                            onClick={() => basculer(item.to)}
                            aria-expanded={ouvert}
                            aria-label={`Afficher ${item.label}`}
                            className="text-slate-400 transition-colors hover:text-slate-100"
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform duration-200",
                                ouvert && "rotate-180",
                                actif && "text-white",
                              )}
                              aria-hidden
                            />
                          </button>
                        )}
                      </div>
                      {item.children && ouvert && (
                        <div className="mb-1 ml-6 mt-0.5 flex flex-col gap-0.75 border-l border-outline-variant/20 pl-3">
                          {item.children.map((enfant) => {
                            const actifEnfant =
                              pathname === item.to && onglet === enfant.onglet;
                            return (
                              <Link
                                key={enfant.onglet}
                                to={`${item.to}?onglet=${enfant.onglet}`}
                                onClick={fermerSiMobile}
                                className={cn(
                                  "truncate rounded-md px-2 py-1.5 text-[12.5px] transition-colors",
                                  actifEnfant
                                    ? "bg-brand-orange/20 text-white"
                                    : "text-slate-300 hover:bg-slate-800/60",
                                )}
                              >
                                {enfant.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bouton « déplier » — portal direct dans <body> : aucun ancêtre ne peut
          le masquer (stacking context du header, overflow, transform…).
          Mobile : sous le header sticky (h-14). Desktop : contre le rail. */}
      {replie &&
        createPortal(
          <button
            type="button"
            onClick={() => setReplie(false)}
            aria-label="Déplier le panneau"
            aria-expanded="false"
            className={cn(
              "animate-in fade-in zoom-in-95 fixed left-4 z-999 grid place-items-center rounded-lg border border-outline-variant/30 bg-brand-navy text-white shadow-hover transition-colors hover:text-slate-300 duration-200 md:left-16 md:top-16.5",
              isMobile ? "bottom-20 size-10" : "top-20 size-8",
            )}
          >
            <ChevronRight className={isMobile ? "size-8.5" : "size-4"} aria-hidden />
          </button>,
          document.body,
        )}
    </aside>
  );
};

export default AdminSidebar;