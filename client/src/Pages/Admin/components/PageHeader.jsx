import { ChevronRight, Home } from "lucide-react"
import { Link } from "react-router-dom"

/**
 * PageHeader moderne avec fil d'Ariane épuré, typographie percutante,
 * séparateur inférieur et espacement généreux.
 */
export const PageHeader = ({ title, description, crumbs = [], actions = null, children }) => (
  <header className="w-full border-b border-slate-200/80 pb-6 dark:border-slate-800">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        {/* Fil d'Ariane */}
        {crumbs.length > 0 && (
          <nav aria-label="Fil d'ariane" className="flex flex-wrap items-center gap-2 text-lg font-medium text-slate-500 dark:text-slate-400">
            <Link to="/admin" className="flex items-center gap-1 hover:text-amber-600 transition-colors">
              <Home className="size-4.5 opacity-70" />
              <span className="sr-only">Accueil</span>
            </Link>
            {crumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-2">
                <ChevronRight className="size-3.5 text-slate-300 dark:text-slate-600" />
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-amber-600 transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Titre et description */}
        <h1 className="font-heading text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
        {children}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  </header>
)
