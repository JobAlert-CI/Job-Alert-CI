import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from "recharts"
import { Scale } from "lucide-react"
import {
  useAdminFilieresQuery,
  useStatsOffresParFiliere,
  useStatsAbonnesParFiliere,
} from "@/features/admin-filieres.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import CadreChart from "@/components/admin/CadreChart"


/* Couleurs de marque : navy = offre, orange = demande (aplats OK). */
const COULEUR_OFFRE = "#0F2D4D"
const COULEUR_DEMANDE = "#F5A623"

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/* Tooltip stylé, cohérent avec les autres charts admin. */
const TooltipCroisement = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête avec trait de séparation */}
      <div className="font-semibold text-foreground border-b border-border/40 pb-2">
        {label}
      </div>

      {/* Liste des croisements */}
      <div className="flex flex-col gap-1">
        {payload.map((p) => (
          <div
            key={p.dataKey || p.name}
            className="flex items-center justify-between gap-6"
          >
            {/* Gauche : Carré de couleur + Nom de la métrique */}
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: p.fill || p.color || p.stroke || "currentColor" }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground truncate max-w-35" title={p.name}>
                {p.name}
              </span>
            </div>

            {/* Droite : Valeur poussée à l'extrémité */}
            <span className="font-medium text-foreground tabular-nums">
              {formatNombre(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


/**
 * Groupes de barres : [offres, abonnes] — hauteurs en %.
 * Profil réaliste : tantôt l'offre domine, tantôt la demande,
 * comme un vrai croisement filière × marché.
 */
const GROUPES_BARRES = [
  [72, 40],
  [52, 52],
  [48, 64],
  [60, 44],
  [60, 28],
  [64, 40],
  [34, 52],
  [80, 46],
  [48, 42],
  [42, 22],
  [42, 28],
  [38, 52],
];

/**
 * État de chargement du BarChart groupé offres/demande par filière.
 * Reprend les spécificités du chart réel :
 *  - 2 barres juxtaposées par filière (groupé, pas empilé), maxBarSize 28 ;
 *  - hauts de barres arrondis (radius [3,3,0,0]) ;
 *  - axe X incliné à -35° sur 70px de haut ;
 *  - légende 2 séries en bas (fontSize 11).
 * `height` doit correspondre à la hauteur du ResponsiveContainer réel.
 */
const ChartCroisementSkeleton = ({ height = 280 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique offres / demande par filière"
    className="flex w-full flex-col gap-3"
    style={{ height }}
  >
    <div className="flex flex-1 gap-2">
      {/* Axe Y : 3 graduations fictives */}
      <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-sm" />
        ))}
      </div>

      {/* Zone du graphique */}
      <div className="flex flex-1 flex-col">
        {/* Groupes de 2 barres juxtaposées, alignées en bas */}
        <div className="flex flex-1 items-end gap-4 border-b border-border pb-px">
          {GROUPES_BARRES.map(([offres, abonnes], i) => (
            <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
              <Skeleton
                className="w-full max-w-7 rounded-t-[3px]"
                style={{ height: `${offres}%`, animationDelay: `${i * 80}ms` }}
              />
              <Skeleton
                className="w-full max-w-7 rounded-t-[3px]"
                style={{ height: `${abonnes}%`, animationDelay: `${i * 80 + 30}ms` }}
              />
            </div>
          ))}
        </div>

        {/* Libellés de l'axe X : inclinés à -35° comme le XAxis réel
            (angle={-35}, textAnchor="end", height={70}) */}
        <div className="flex h-17.5 gap-4" aria-hidden="true">
          {GROUPES_BARRES.map((_, i) => (
            <div key={i} className="flex flex-1 justify-center pt-2">
              <Skeleton className="h-2 w-12 rotate-[-35deg] rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Légende : équivalent du <Legend wrapperStyle={{ fontSize: 11 }}> — 2 séries */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2.5 w-20 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

const ChartCroisement = () => {
  const mouvementReduit = useReducedMotion()
  const { data: filieres, isLoading: filieresChargement, isError: filieresErreur, refetch: refetchFilieres } = useAdminFilieresQuery()
  const { data: statsOffres, isLoading: offresChargement, isError: offresErreur, refetch: refetchOffres } = useStatsOffresParFiliere()
  const { data: statsAbonnes, isLoading: abonnesChargement, isError: abonnesErreur, refetch: refetchAbonnes } = useStatsAbonnesParFiliere()

  /* Croisement local + tri par volume total décroissant (plus parlant). */
  const donnees = useMemo(() => {
    const offresParCode = new Map((statsOffres ?? []).map((f) => [f.code, f.total_offers ?? 0]))
    const abonnesParCode = new Map((statsAbonnes ?? []).map((f) => [f.code, f.subscribers_count ?? 0]))
    return (filieres ?? [])
      .map((f) => ({
        nom: f.label,
        offres: offresParCode.get(f.code) ?? 0,
        abonnes: abonnesParCode.get(f.code) ?? 0,
      }))
      .sort((a, b) => (b.offres + b.abonnes) - (a.offres + a.abonnes))
  }, [filieres, statsOffres, statsAbonnes])

  const isError = filieresErreur || offresErreur || abonnesErreur

  const refetch = () => {
    refetchFilieres()
    refetchOffres()
    refetchAbonnes()
  }

  const isLoading = filieresChargement || offresChargement || abonnesChargement
  const aDesDonnees = donnees.some((d) => d.offres > 0 || d.abonnes > 0)

  const totalOffres = donnees.reduce((acc, d) => acc + d.offres, 0)
  const totalAbonnes = donnees.reduce((acc, d) => acc + d.abonnes, 0)

  const etat = isError ? "erreur" : isLoading ? "chargement" : !donnees.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Offre vs demande par filière"
      description="Offres actives rattachées face aux abonnés inscrits — un déséquilibre marque une attente insatisfaite ou un gisement d'offres non exploité."
      icon={Scale}
      badge={
        !isLoading &&
        aDesDonnees && (
          <Badge variant="secondary" className="tabular-nums">
            {formatNombre(totalOffres)} offres · {formatNombre(totalAbonnes)} abonnements
          </Badge>
        )
      }
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartCroisementSkeleton />
        ) : (
          <CadreChart vide={!aDesDonnees} videMessage="Aucune donnée pour le moment." minHeight={220}>
            <BarChart data={donnees} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="nom"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
              />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                content={<TooltipCroisement />}
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="offres"
                name="Offres actives"
                fill={COULEUR_OFFRE}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="abonnes"
                name="Abonnés inscrits"
                fill={COULEUR_DEMANDE}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartCroisement