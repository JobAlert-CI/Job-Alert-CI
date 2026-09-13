import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronDown, ChevronRight, LogOut, Search, SearchX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { ROLE_LABELS } from "@/features/admin-auth.tools"
import { useAdminGlobalSearchQuery } from "@/features/admin-search.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"

/* ─────────────────────────────────────────────────────────────────────
Header du back-office : verre dépoli, bordure/ombre dynamiques au scroll,
recherche globale (⌘K / Ctrl+K, navigation flèches, surlignage des termes)
et menu compte avec skeleton de chargement.
Design refondu — la logique de recherche est inchangée.
───────────────────────────────────────────────────────────────────── */

const EASE_OUT = [0.22, 1, 0.36, 1]

/* ─── Utilitaires ──────────────────────────────────────────────────── */
const Kbd = ({ children, className }) => (
  <kbd
    className={cn(
      "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/70 bg-background/80 px-1 text-[10px] font-semibold text-muted-foreground shadow-[0_1px_0_0_hsl(var(--border))]",
      className
    )}
  >
    {children}
  </kbd>
)

/** Met en évidence la partie du texte qui correspond au terme cherché. */
const surligner = (texte, terme) => {
  const chaine = String(texte ?? "")
  if (!terme || !chaine) return chaine
  const bas = chaine.toLowerCase()
  const termeBas = terme.toLowerCase()
  const morceaux = []
  let index = 0
  while (index < chaine.length) {
    const pos = bas.indexOf(termeBas, index)
    if (pos === -1) {
      morceaux.push(chaine.slice(index))
      break
    }
    if (pos > index) morceaux.push(chaine.slice(index, pos))
    morceaux.push(
      <mark
        key={pos}
        className="rounded-sm bg-brand-orange/25 px-0.5 font-semibold text-inherit"
      >
        {chaine.slice(pos, pos + terme.length)}
      </mark>
    )
    index = pos + terme.length
  }
  return morceaux
}

const initialesDepuisNom = (nom) =>
  (nom ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase() || "JA"

/* ─── Recherche globale ────────────────────────────────────────────── */
const GlobalSearch = ({ role }) => {
  const navigate = useNavigate()
  const [valeur, setValeur] = useState("")
  const [valeurCommittee, setValeurCommittee] = useState("")
  const [ouvert, setOuvert] = useState(false)
  const [indexActif, setIndexActif] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const estMac = useMemo(() => /mac/i.test(navigator.userAgent), [])
  const moderateur = role === "moderateur"

  // Debounce local : la saisie ne déclenche jamais d'appel immédiat.
  useEffect(() => {
    const timer = setTimeout(() => setValeurCommittee(valeur.trim()), 300)
    return () => clearTimeout(timer)
  }, [valeur])

  const { data, isFetching } = useAdminGlobalSearchQuery(valeurCommittee, {
    enabled: ouvert && !moderateur,
  })

  // Raccourci clavier ⌘K / Ctrl+K : focus instantané sur la recherche.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOuvert(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Fermeture au clic extérieur + Escape (même focus hors de l'input).
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

  // Liste plate (ordre d'affichage) pour la navigation clavier.
  const plats = useMemo(() => {
    if (!data) return []
    return [
      ...(data.offers ?? []).map((o) => ({
        id: o.id, groupe: "Offres", label: o.title, href: `/admin/offres/${o.id}`,
      })),
      ...(data.subscribers ?? []).map((s) => ({
        id: s.id, groupe: "Abonnés",
        label: s.full_name ? `${s.full_name} (${s.email})` : s.email,
        href: `/admin/utilisateurs/${s.id}`,
      })),
      ...(data.companies ?? []).map((c) => ({
        id: c.id, groupe: "Entreprises", label: c.name,
        href: `/admin/entreprises?focus=${c.id}`,
      })),
    ]
  }, [data])

  // Groupes visuels, avec index global conservé pour le listbox.
  const groupes = useMemo(() => {
    const parGroupe = []
    plats.forEach((item, index) => {
      const dernier = parGroupe[parGroupe.length - 1]
      if (dernier && dernier.titre === item.groupe) dernier.items.push({ ...item, index })
      else parGroupe.push({ titre: item.groupe, items: [{ ...item, index }] })
    })
    return parGroupe
  }, [plats])

  // Nouvelle recherche → présélection du premier résultat.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndexActif(plats.length ? 0 : -1)
  }, [plats])

  // Le résultat actif reste visible dans la liste défilante.
  useEffect(() => {
    if (indexActif < 0) return
    document
      .getElementById(`resultat-recherche-${indexActif}`)
      ?.scrollIntoView({ block: "nearest" })
  }, [indexActif])

  const goto = useCallback(
    (href) => {
      navigate(href)
      setOuvert(false)
      setValeur("")
      setValeurCommittee("")
      inputRef.current?.blur()
    },
    [navigate]
  )

  const onKeyDownInput = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOuvert(true)
      setIndexActif((i) => Math.min(i + 1, plats.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setIndexActif((i) => Math.max(i - 1, 0))
    } else if (e.key === "Home" && plats.length) {
      e.preventDefault()
      setIndexActif(0)
    } else if (e.key === "End" && plats.length) {
      e.preventDefault()
      setIndexActif(plats.length - 1)
    } else if (e.key === "Enter") {
      const cible = plats[indexActif]
      if (cible) goto(cible.href)
    } else if (e.key === "Escape") {
      setOuvert(false)
      inputRef.current?.blur()
    }
  }

  const aResultats = plats.length > 0
  const afficherPanneau = ouvert && !moderateur

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div
        className={cn(
          "group relative rounded-2xl p-px transition-all duration-300",
          afficherPanneau
            ? "bg-linear-to-r from-brand-orange/60 via-border to-brand-navy/40"
            : "bg-border/60 hover:bg-border"
        )}
      >
        <div className="relative flex items-center rounded-[15px] bg-background/70 backdrop-blur-sm">
          <Search
            className={cn(
              "pointer-events-none absolute left-3.5 size-4 transition-colors duration-200",
              afficherPanneau ? "text-foreground" : "text-muted-foreground"
            )}
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={afficherPanneau}
            aria-controls="recherche-resultats"
            aria-activedescendant={
              indexActif >= 0 ? `resultat-recherche-${indexActif}` : undefined
            }
            aria-label="Recherche globale (offres, abonnés, entreprises)"
            aria-keyshortcuts="Control+K Meta+K"
            autoComplete="off"
            value={valeur}
            onChange={(e) => {
              setValeur(e.target.value)
              setOuvert(true)
            }}
            onFocus={() => setOuvert(true)}
            onKeyDown={onKeyDownInput}
            disabled={moderateur}
            placeholder={
              moderateur
                ? "Recherche indisponible pour ce rôle"
                : "Rechercher une offre, un abonné, une entreprise…"
            }
            className="h-10 rounded-[15px] border-0 bg-transparent pl-10 pr-16 text-[13px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {isFetching && ouvert && valeurCommittee ? (
            <Spinner className="absolute right-3.5 size-4" />
          ) : (
            !valeur &&
            !moderateur && (
              <span className="pointer-events-none absolute right-3 hidden items-center gap-1 sm:flex">
                <Kbd>{estMac ? "⌘" : "Ctrl"}</Kbd>
                <Kbd>K</Kbd>
              </span>
            )
          )}
        </div>
      </div>

      {/* Panneau de résultats : apparition animée (fondu + zoom) */}
      <AnimatePresence>
        {afficherPanneau && (
          <motion.div
            id="recherche-resultats"
            role="listbox"
            aria-label="Résultats de recherche globale"
            aria-busy={isFetching}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="absolute left-0 right-0 top-full z-50 mt-2.5 origin-top overflow-hidden rounded-2xl border border-border/70 bg-popover/95 shadow-2xl backdrop-blur-xl"
          >
            <div
              className={cn(
                "flex max-h-96 flex-col gap-0.5 overflow-y-auto p-2 transition-opacity duration-150",
                isFetching && data && "opacity-60"
              )}
            >
              {!valeurCommittee ? (
                <p className="px-3 py-5 text-xs text-muted-foreground">
                  Saisissez au moins un caractère pour lancer la recherche.
                </p>
              ) : isFetching && !data ? (
                <p className="flex items-center gap-2 px-3 py-5 text-xs text-muted-foreground">
                  <Spinner className="size-3.5" /> Recherche en cours…
                </p>
              ) : !aResultats ? (
                <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-muted/70">
                    <SearchX className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Aucun résultat pour « {valeurCommittee} ».
                  </p>
                </div>
              ) : (
                groupes.map((groupe) => (
                  <div key={groupe.titre} className="flex flex-col gap-0.5">
                    <p className="px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 first:pt-1">
                      {groupe.titre}
                    </p>
                    {groupe.items.map((item) => (
                      <button
                        key={`${item.groupe}-${item.id}`}
                        id={`resultat-recherche-${item.index}`}
                        type="button"
                        role="option"
                        aria-selected={item.index === indexActif}
                        onMouseEnter={() => setIndexActif(item.index)}
                        // eslint-disable-next-line react-hooks/refs
                        onClick={() => goto(item.href)}
                        className={cn(
                          "group/item relative flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2.5 text-left text-xs outline-none transition-all duration-150",
                          item.index === indexActif
                            ? "bg-muted text-foreground"
                            : "text-foreground/75 hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-orange transition-opacity duration-150",
                            item.index === indexActif ? "opacity-100" : "opacity-0"
                          )}
                          aria-hidden
                        />
                        <span className="truncate pl-1.5">
                          {surligner(item.label, valeurCommittee)}
                        </span>
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 transition-all duration-150",
                            item.index === indexActif
                              ? "translate-x-0 text-foreground"
                              : "-translate-x-1 text-muted-foreground/50"
                          )}
                          aria-hidden
                        />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
            {aResultats && (
              <div className="flex items-center gap-4 border-t border-border/70 bg-muted/30 px-3.5 py-2 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> naviguer
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd> ouvrir
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>esc</Kbd> fermer
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Menu compte (skeleton tant que le profil n'est pas chargé) ──── */
const CompteMenu = ({ profile, onLogout }) => {
  const roleLabel = ROLE_LABELS[profile?.role] || profile?.role || "—"

  if (!profile) {
    return (
      <div className="flex items-center gap-2.5 px-1" aria-busy="true">
        <Skeleton className="size-8 rounded-full" />
        <div className="hidden flex-col gap-1.5 sm:flex">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-10 gap-2.5 rounded-full border border-border/60 bg-background/60 px-1.5 backdrop-blur-sm transition-colors hover:bg-muted/70 sm:pr-3"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-navy to-brand-navy/70 text-[10px] font-black text-white ring-2 ring-background">
              {initialesDepuisNom(profile.full_name)}
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="max-w-40 truncate text-[13px] font-semibold">
                {profile.full_name || "Compte"}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {roleLabel}
              </span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        side="bottom"
        className="min-w-64 rounded-2xl border-border/70 p-1.5 shadow-2xl"
      >
        {/* base-ui : label de groupe TOUJOURS dans <DropdownMenuGroup>. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="rounded-xl bg-muted/40 p-3">
            <span className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-navy to-brand-navy/70 text-[11px] font-black text-white">
                {initialesDepuisNom(profile.full_name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">
                  {profile.full_name || "Compte"}
                </span>
                <span className="block truncate text-[11px] font-normal text-muted-foreground">
                  {profile.email}
                </span>
              </span>
            </span>
            <Badge
              variant="secondary"
              className="mt-2.5 rounded-full text-[10px] font-semibold"
            >
              {roleLabel}
            </Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuItem
          variant="destructive"
          onClick={onLogout}
          className="cursor-pointer rounded-xl py-2 text-[13px] font-medium"
        >
          <LogOut className="size-3.5" aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Header ───────────────────────────────────────────────────────── */
const AdminHeader = ({ onLogout }) => {
  const { profile, role } = useAdminAuth()
  const [defile, setDefile] = useState(false)

  // Bordure + ombre invisibles en haut de page, révélées au scroll.
  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 6)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-16 items-center gap-3 px-3 backdrop-blur-xl transition-all duration-300 sm:px-5",
        defile
          ? "bg-background/75 shadow-[0_1px_0_0_hsl(var(--border)),0_8px_24px_-16px_rgba(0,0,0,0.35)]"
          : "bg-background/40"
      )}
    >
      {/* Filet dégradé en pied de header, révélé au scroll */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-brand-orange/40 to-transparent transition-opacity duration-300",
          defile ? "opacity-100" : "opacity-0"
        )}
      />
      <GlobalSearch role={role} />
      <div className="ml-auto flex items-center gap-2">
        <CompteMenu profile={profile} onLogout={onLogout} />
      </div>
    </header>
  )
}

export default AdminHeader
