/**
 * Tabs (S6) — barre d'onglets accessible, pilotée par le parent.
 * @param {Array<{key: string, label: string, icon?: import("lucide-react").LucideIcon}>} tabs
 */
export const Tabs = ({ tabs, activeKey, onChange }) => (
  <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
    {tabs.map((tab) => {
      const Icon = tab.icon
      const isActive = tab.key === activeKey
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          data-active={isActive}
          className="adm-tab whitespace-nowrap"
          onClick={() => onChange?.(tab.key)}
        >
          {Icon && <Icon className="size-4" />}
          {tab.label}
        </button>
      )
    })}
  </div>
)
