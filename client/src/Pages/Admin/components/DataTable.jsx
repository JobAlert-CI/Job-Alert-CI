import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, MoreVertical, RefreshCw } from "lucide-react"
import { EmptyState } from "./EmptyState"

/** Classe d'un élément d'action affiché dans le menu contextuel d'une ligne. */
const actionClasses = (action, danger = false) =>
  `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    danger
      ? "text-rose-700 hover:bg-rose-50 disabled:hover:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/40"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
  }`

/**
 * Menu contextuel de ligne (S6) — bouton « ⋯ » + popover d'actions.
 * Contrôlé par le parent (`open` / `onChange`) pour permettre à toute la ligne
 * d'ouvrir ce menu. Actions : { key, label, icon, to?, onClick?, danger?, disabled?, separator? }.
 *
 * Positionnement en `fixed` (calculé via getBoundingClientRect) : le menu
 * échappe au clipping des ancêtres `overflow-x-auto` / `overflow-hidden`
 * (dernières lignes du tableau visibles) et s'ouvre vers le haut s'il manque
 * de l'espace en bas de l'écran. Fermeture automatique au scroll/resize.
 */
export const RowActionsMenu = ({ open, onChange, actions = [], label = "Actions" }) => {
  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)

  /* Calcule la position fixed — useLayoutEffect → aucun flash à l'ouverture */
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const MENU_W = 184 // min-w-44 (11rem)
    const rows = actions.filter((a) => !a.separator).length
    const seps = actions.filter((a) => a.separator).length
    const menuH = rows * 36 + seps * 9 + 8
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuH + 16 && rect.top > menuH + 16
    setPos({
      left: Math.max(8, Math.min(rect.right - MENU_W, window.innerWidth - MENU_W - 8)),
      top: openUp ? Math.max(8, rect.top - menuH - 6) : rect.bottom + 6,
    })
  }, [open, actions])

  // Fermer avec la touche Échap
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onChange?.(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onChange])

  /* La position fixed ne suit pas le défilement → on referme proprement */
  useEffect(() => {
    if (!open) return
    const close = () => onChange?.(false)
    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [open, onChange])

  const toggle = (e) => {
    e.stopPropagation()
    onChange?.(!open)
  }

  return (
    <div ref={menuRef} className="inline-block text-left align-middle">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && pos && (
        <>
          {/* Backdrop : ferme le menu au clic extérieur */}
          <div
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden="true"
            onClick={() => onChange?.(false)}
          />
          <div
            role="menu"
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-popover p-1 text-popover-foreground shadow-lg dark:border-slate-800"
          >
            {actions.length === 0 && <p className="px-3 py-2 text-[11px] text-muted-foreground">Aucune action</p>}
            {actions.map((action, index) =>
              action.separator ? (
                <div key={`sep-${index}`} className="my-1 h-px bg-slate-200 dark:bg-slate-800" />
              ) : (
                <RowActionItem key={action.key} action={action} close={() => onChange?.(false)} />
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}

const RowActionItem = ({ action, close }) => {
  const className = actionClasses(action, action.danger)
  if (action.to) {
    return (
      <Link to={action.to} onClick={close} className={className} role="menuitem">
        {action.icon && <action.icon className="size-3.5 shrink-0 text-muted-foreground" />}
        {action.label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => {
        close()
        action.onClick?.()
      }}
      className={className}
      role="menuitem"
      title={action.title}
    >
      {action.icon && <action.icon className="size-3.5 shrink-0 text-muted-foreground" />}
      {action.label}
    </button>
  )
}

/** Cible interactive : ne déclenche pas le clic de ligne (menu contextuel). */
const isInteractiveTarget = (target) =>
  Boolean(target.closest?.("a, button, input, select, textarea, label, [role='menuitem']"))

/** Composant réutilisable : bouton « ⋯ » isolé (tables hors DataTable). */
export const RowActionsTrigger = ({ open, onChange, label = "Actions" }) => (
  <RowActionsMenu open={open} onChange={onChange} label={label} actions={[]} />
)

/**
 * DataTable haute fidélité (S6) — pagination offset/limit,
 * états de chargement animés, gestion d'erreurs élégante et survol fluide.
 */
export const DataTable = ({
  columns,
  rows = [],
  loading = false,
  error = null,
  onRetry,
  emptyLabel = "Aucun résultat",
  emptyHint,
  limit = 20,
  offset = 0,
  onOffsetChange,
  compact = false,
  toolbar = null,
  rowActions = null,
}) => {
  const colSpan = columns.length + 1

  /* Ligne cliquable → ouvre le menu contextuel (mobile & desktop) */
  const [menuFor, setMenuFor] = useState(null)
  const hasMenu = Boolean(rowActions)

  if (error && !rows.length) {
    return (
      <div className="adm-card border-rose-200 bg-rose-50/50 p-6 dark:border-rose-900/50 dark:bg-rose-950/20">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
            <AlertCircle className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-heading text-sm font-bold text-rose-900 dark:text-rose-200">
              Impossible de charger les données
            </h4>
            <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
              {error.message || "Une erreur de communication est survenue avec le serveur."}
            </p>
            {onRetry && (
              <div className="pt-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 shadow-2xs transition-colors hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200"
                  onClick={onRetry}
                >
                  <RefreshCw className="size-3.5" />
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="adm-card overflow-hidden shadow-xs">
      {toolbar && <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">{toolbar}</div>}
      <div className="overflow-x-auto">
        <table className={`adm-table ${compact ? "adm-table--compact" : ""}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>
                  {col.header}
                </th>
              ))}
              {hasMenu && <th className="w-10 text-right"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {loading &&
              (rows.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={colSpan} className="py-4">
                      <div className="adm-skeleton-line h-5 w-full rounded-md" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colSpan} className="py-4 text-center">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Loader2 className="size-4 animate-spin text-amber-500" />
                      Actualisation des données en cours…
                    </div>
                  </td>
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="py-12 text-center">
                  <EmptyState title={emptyLabel} description={emptyHint} />
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => {
                const rowId = row.id ?? row.key ?? `row-${offset + index}`
                return (
                  <tr
                    key={rowId}
                    onClick={
                      hasMenu
                        ? (e) => {
                            if (isInteractiveTarget(e.target)) return
                            setMenuFor(menuFor === rowId ? null : rowId)
                          }
                        : undefined
                    }
                    className={hasMenu ? "cursor-pointer" : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(row, offset + index) : row[col.key]}
                      </td>
                    ))}
                    {hasMenu && (
                      <td className="w-10 text-right">
                        <RowActionsMenu
                          open={menuFor === rowId}
                          onChange={(v) => setMenuFor(v ? rowId : null)}
                          actions={rowActions(row, offset + index)}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination offset/limit */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
          <span className="font-medium">
            Affichage de <strong className="text-slate-800 dark:text-slate-200">{offset + 1}</strong> à{" "}
            <strong className="text-slate-800 dark:text-slate-200">{offset + rows.length}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="adm-btn-ghost adm-btn-sm"
              disabled={offset === 0}
              onClick={() => onOffsetChange?.(Math.max(0, offset - limit))}
            >
              <ChevronLeft className="size-3.5" /> Précédent
            </button>
            <button
              type="button"
              className="adm-btn-outline adm-btn-sm"
              disabled={rows.length < limit}
              onClick={() => onOffsetChange?.(offset + limit)}
            >
              Suivant <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** État vide réutilisable hors table. */
export const TablePlaceholder = ({ label }) => (
  <div className="adm-card flex h-44 items-center justify-center gap-2 text-sm text-slate-500">
    <Inbox className="size-5 opacity-60" /> {label}
  </div>
)
