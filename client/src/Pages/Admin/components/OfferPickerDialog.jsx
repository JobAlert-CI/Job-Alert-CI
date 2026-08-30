import { useState } from "react"
import { CheckSquare, Loader2, Search, Square, X } from "lucide-react"
import { useOffers } from "@/tools/admin.tools"
import { GenericStatusBadge } from "./StatusBadge"
import { EmptyState } from "./EmptyState"

/**
 * OfferPickerDialog (S6) — sélecteur d'offres réutilisable
 * (envoi personnalisé, séries…). Filtre par défaut : visible_site=true, status=active.
 */
export const OfferPickerDialog = ({
  open,
  onClose,
  onSubmit,
  title = "Sélectionner des offres",
  confirmText = "Valider la sélection",
  loading = false,
}) => {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState([])
  const [pageOffset, setPageOffset] = useState(0)
  const LIMIT = 8

  const { data: offers = [], isLoading } = useOffers({
    q: search || undefined,
    visible_site: true,
    status: "active",
    limit: LIMIT,
    offset: pageOffset,
  })

  if (!open) return null

  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="adm-card flex max-h-[80vh] w-full max-w-2xl flex-col shadow-hover" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="font-heading text-sm font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="adm-btn-ghost adm-btn-sm">
            <X className="size-4" />
          </button>
        </header>

        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPageOffset(0)
              }}
              placeholder="Rechercher par titre…"
              className="adm-input pl-9"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedIds.length} offre(s) sélectionnée(s) — seules les offres actives et visibles sont listées.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Chargement des offres…
            </div>
          ) : offers.length === 0 ? (
            <EmptyState title="Aucune offre trouvée" description="Ajustez votre recherche." />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {offers.map((offer) => {
                const checked = selectedIds.includes(offer.id)
                return (
                  <li key={offer.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(offer.id)} />
                      {checked ? (
                        <CheckSquare className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{offer.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {offer.company?.name ?? "—"}
                          {offer.primary_filiere?.label ? ` · ${offer.primary_filiere.label}` : ""}
                        </span>
                      </span>
                      <GenericStatusBadge status={offer.status} labels={{ active: "Active" }} />
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              className="adm-btn-ghost adm-btn-sm"
              disabled={pageOffset === 0}
              onClick={() => setPageOffset((o) => Math.max(0, o - LIMIT))}
            >
              Précédent
            </button>
            <button
              type="button"
              className="adm-btn-outline adm-btn-sm"
              disabled={offers.length < LIMIT}
              onClick={() => setPageOffset((o) => o + LIMIT)}
            >
              Suivant
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="adm-btn-outline" onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              className="adm-btn-primary"
              disabled={selectedIds.length === 0 || loading}
              onClick={() => onSubmit(selectedIds)}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
