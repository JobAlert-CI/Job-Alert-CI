import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis,
} from "recharts"
import { libelleMotif, useEmailsTxStatsQuery } from "@/features/admin-logs.tools"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionErreur, TransitionEtat } from "@/components/admin/EtatsSection"
import { ListOrdered } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import TooltipChart from "../components/TooltipChart"
import CadreChart from "@/components/admin/CadreChart"

const COULEUR_MOTIF = "#0F2D4D"

/* Barres horizontales du chart « Envois par motif » (layout="vertical") :
   largeurs relatives triées par ordre décroissant — le chart réel trie
   parMotif par total décroissant. 6 barres = les 6 valeurs de l'enum des
   motifs d'email transactionnel. `libelle` = largeur du libellé de
   catégorie dans la colonne de gauche. */
const BARRES_MOTIF = [
  { barre: 88, libelle: 64 },
  { barre: 64, libelle: 48 },
  { barre: 47, libelle: 56 },
]

/**
 * État de chargement du BarChart horizontal « Envois par motif ».
 * Reprend la géométrie du chart réel (layout="vertical") :
 *  - axe des catégories (motifs) à GAUCHE, colonne de largeur fixe
 *    (YAxis width={120}, rognée par margin left:-50), libellés alignés
 *    à droite comme le textAnchor="end" par défaut de Recharts ;
 *  - barres horizontales alignées à gauche, arrondi [0, 4, 4, 0]
 *    appliqué à l'extrémité DROITE comme sur le <Bar radius> réel ;
 *  - axe numérique en bas (XAxis type="number") ;
 *  - PAS de légende sur ce chart (contrairement au chart empilé).
 * `height` doit correspondre à la hauteur du CadreChart réel
 * (minHeight={240} ici) pour éviter tout layout shift.
 */
const ChartMotifSkeleton = ({ height = 240 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des envois par motif"
    className="flex w-full flex-col gap-3 p-2"
    style={{ height }}
  >
    {/* Zone du graphique : barres horizontales alignées à gauche */}
    <div className="flex flex-1 flex-col justify-around gap-2">
      {BARRES_MOTIF.map(({ barre, libelle }, i) => (
        <div key={i} className="flex items-center gap-2">
          {/* Axe Y : colonne de largeur FIXE (toutes les barres démarrent
              au même x, comme le YAxis width={120} réel). Libellé aligné
              à droite dans cette colonne. */}
          <div className="flex w-18 shrink-0 justify-end">
            <Skeleton
              className="h-2.5 rounded-sm"
              style={{ width: libelle, animationDelay: `${i * 70}ms` }}
            />
          </div>
          {/* Barre horizontale : arrondi à droite comme radius=[0,4,4,0] */}
          <div className="flex-1">
            <Skeleton
              className="h-16 rounded-r-sm"
              style={{ width: `${barre}%`, animationDelay: `${i * 70 + 30}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
    {/* Axe X : graduations numériques, alignées sur le départ des barres */}
    <div className="flex justify-between pl-20" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-2 w-6 rounded-sm" />
      ))}
    </div>
  </div>
)

const ChartEnvoisMotif = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useEmailsTxStatsQuery(30)

  const parMotif = useMemo(
    () =>
      Object.entries(stats?.par_motif ?? {})
        .map(([valeur, total]) => ({ motif: libelleMotif(valeur), total }))
        .sort((a, b) => b.total - a.total),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !stats?.jobs_par_jour?.length ? "vide" : "donnees"

  return (
    <SectionCardAdmin
      title="Envois par motif (historique)"
      icon={ListOrdered}
    >
      <TransitionEtat etat={etat}>
        {isError ? (
          <SectionErreur onRetry={refetch} message="Impossible de charger l'état du croisement." />
        ) : isLoading ? (
          <ChartMotifSkeleton />
        ) : (
          <CadreChart vide={!parMotif.length} videMessage="Aucun email transactionnel envoyé." minHeight={240}>
            <BarChart data={parMotif} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: -50 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} />
              <YAxis type="category" dataKey="motif" width={120} fontSize={10} tickLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar dataKey="total" name="Envois" fill={COULEUR_MOTIF} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[0, 4, 4, 0]} />
            </BarChart>
          </CadreChart>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default ChartEnvoisMotif