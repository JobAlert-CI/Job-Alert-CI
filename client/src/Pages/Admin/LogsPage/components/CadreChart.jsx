import { ResponsiveContainer } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* ─────────────────────────────────────────────────────────────────────
   CadreChart — cadre commun de TOUS les graphiques de la page Logs
   & emails (mutualisé entre les 3 onglets, auparavant dupliqué dans
   OngletEvents et OngletEmailsTx) : skeleton, état vide et conteneur
   ResponsiveContainer strictement identiques partout.
   TooltipChart — tooltip personnalisé shadcn (fond popover, bordure,
   ombre, chiffres tabulaires), partagé entre tous les charts.
   ───────────────────────────────────────────────────────────────────── */
const CadreChart = ({ chargement, vide, videMessage, children, minHeight = 220 }) => (
  <>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" />
          <EmptyTitle>Pas encore de données</EmptyTitle>
          <EmptyDescription>{videMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    )}
  </>
)

export default CadreChart

export const TooltipChart = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label != null && label !== "" && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={`${p.dataKey ?? p.name}-${i}`} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: p.fill ?? p.color }}
            aria-hidden="true"
          />
          {p.name} : <span className="font-medium tabular-nums">{(p.value ?? 0).toLocaleString("fr-FR")}</span>
        </p>
      ))}
    </div>
  )
}