import { useState } from "react"
import { Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export const AdminTable = ({
  columns = [],
  data = [],
  loading = false,
  searchPlaceholder = "Rechercher...",
  searchValue,
  onSearchChange,
  filterComponent,
  actionButton,
  emptyTitle = "Aucune donnée trouvée",
  emptyDescription = "Aucun enregistrement ne correspond aux filtres appliqués.",
  pageSize = 10,
  keyExtractor = (item, idx) => item?.id || idx,
}) => {
  const [currentPage, setCurrentPage] = useState(1)

  const totalItems = data.length
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1))
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1))

  return (
    <div className="flex flex-col gap-3.5">
      {/* Header controls: search, filters, actions */}
      {(onSearchChange || filterComponent || actionButton) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {onSearchChange && (
              <div className="relative min-w-[240px] max-w-sm w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-on-surface-variant/60 pointer-events-none" />
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue || ""}
                  onChange={(e) => {
                    onSearchChange(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-8 h-8 text-xs bg-surface-container-lowest dark:bg-zinc-900 border-outline-variant/30"
                />
              </div>
            )}
            {filterComponent}
          </div>
          {actionButton && <div className="shrink-0">{actionButton}</div>}
        </div>
      )}

      {/* Table container */}
      <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/60 dark:bg-zinc-800/60 text-on-surface-variant dark:text-zinc-400 font-semibold">
                {columns.map((col, idx) => (
                  <th
                    key={col.key || idx}
                    className={`py-3 px-4 ${col.className || ""}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15 text-on-surface dark:text-zinc-200">
              {loading ? (
                // Skeletons
                Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className="py-3.5 px-4">
                        <div
                          className="h-3.5 rounded bg-on-surface-variant/10 dark:bg-zinc-700/40"
                          style={{ width: `${60 + ((rIdx + cIdx) % 4) * 10}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={columns.length} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="grid size-12 place-items-center rounded-2xl bg-surface-container dark:bg-zinc-800 text-on-surface-variant/70 mb-3">
                        <Inbox className="size-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-on-surface dark:text-zinc-200">
                        {emptyTitle}
                      </h4>
                      <p className="mt-1 text-xs text-on-surface-variant dark:text-zinc-400 max-w-sm">
                        {emptyDescription}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                // Rows
                paginatedData.map((item, rowIdx) => (
                  <tr
                    key={keyExtractor(item, rowIdx)}
                    className="hover:bg-surface-container-low/40 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {columns.map((col, colIdx) => (
                      <td key={col.key || colIdx} className={`py-3 px-4 align-middle ${col.className || ""}`}>
                        {col.render ? col.render(item, rowIdx) : item[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with pagination */}
        {!loading && totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-outline-variant/20 px-4 py-2.5 bg-surface-container-low/30 dark:bg-zinc-800/30 text-xs text-on-surface-variant dark:text-zinc-400">
            <div>
              Affichage de{" "}
              <span className="font-semibold text-on-surface dark:text-zinc-200">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              à{" "}
              <span className="font-semibold text-on-surface dark:text-zinc-200">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{" "}
              sur <span className="font-semibold text-on-surface dark:text-zinc-200">{totalItems}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={handlePrev}
                disabled={currentPage <= 1}
                className="size-7 p-0"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-[11px] font-medium px-2">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={handleNext}
                disabled={currentPage >= totalPages}
                className="size-7 p-0"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
