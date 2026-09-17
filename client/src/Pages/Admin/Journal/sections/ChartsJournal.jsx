import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis,
} from "recharts"
import { Activity, UserCheck } from "lucide-react"
import { useJournalStatsQuery } from "@/features/admin-journal.tools"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart from "@/components/admin/CadreChart"
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import { formatNombre } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────
   Charts du Journal d'activité (cycle 16, sélection validée : H-I).
   H — Activité par jour (30 j) : barres du volume d'actions/jour.
   I — Top auteurs (30 j) : barres horizontales, admin le plus actif
        en tête. Les lignes orphelines (admin supprimé) sortent comme
        « Admin supprimé » (stats serveur).
   Données : GET /audit/stats?days=30 (même appel que les compteurs →
   zéro requête supplémentaire). Recharts confiné au chunk lazy de la
   page.
   Refonte :
   • Couleurs liées aux JETONS du thème — var(--chart-*) définis dans
     index.css (--chart-2 = navy #0f2d4d, --chart-3 = vert #2ecc71) —
     au lieu de hex en dur : transition prête pour un futur mode
     sombre, cohérence avec ChartCroisement.
   • Animations conditionnées par useReducedMotion (préférence OS) au
     lieu d'une désactivation globale qui pénalisait tout le monde.
   • Tooltip personnalisé stylé shadcn (popover, bordure, ombre).
   ───────────────────────────────────────────────────────────────────── */

/* Tooltip personnalisé — fond popover + bordure + ombre, façon
   ChartCroisement (le formatter natif était trop basique). */
const TooltipJournal = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête : Date ou type de journal */}
      <div className="font-semibold text-foreground border-b border-border/40 pb-2">
        {label}
      </div>

      {/* Liste des entrées du journal */}
      <div className="flex flex-col gap-2.5">
        {payload.map((p) => (
          <div
            key={p.dataKey || p.name}
            className="flex items-center justify-between gap-6"
          >
            {/* Gauche : Carré de couleur + Nom de l'événement */}
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

            {/* Droite : Valeur formatée et alignée */}
            <span className="font-medium text-foreground tabular-nums">
              {formatNombre(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Hauteurs fictives (%) qui imitent le profil réel du BarChart. */
const HAUTEURS_BARRES = [46, 72, 38, 84, 56, 30, 64];

/**
 * État de chargement du BarChart « Actions par jour ».
 * Reprend la géométrie du chart réel :
 *  - barres uniques par jour, alignées en bas ;
 *  - hauts arrondis (radius [4, 4, 0, 0]) ;
 *  - axe Y à gauche, libellés X en dessous.
 * `height` doit correspondre à la hauteur du CadreChart / ResponsiveContainer
 * réel pour éviter tout layout shift.
 */
const ChartActionsSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique des actions par jour"
    className="flex w-full gap-2 p-3"
    style={{ height }}
  >
    {/* Axe Y : 3 graduations fictives */}
    <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-2 w-full rounded-sm" />
      ))}
    </div>

    {/* Zone du graphique */}
    <div className="flex flex-1 flex-col">
      {/* Barres, alignées en bas comme le BarChart */}
      <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
        {HAUTEURS_BARRES.map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>

      {/* Libellés de l'axe X (jours) */}
      <div className="mt-2 flex gap-3" aria-hidden="true">
        {HAUTEURS_BARRES.map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
        ))}
      </div>
    </div>
  </div>
);


/** Largeurs fictives (%) qui imitent un classement décroissant. */
const LARGEURS_BARRES = [88, 64, 72, 46, 34, 58];

/**
 * État de chargement du BarChart horizontal « Top auteurs ».
 * Reprend la géométrie du chart réel (layout="vertical") :
 *  - axe des catégories à gauche, largeur 110px (width={110}) ;
 *  - barres horizontales alignées à gauche, bouts droits arrondis
 *    (radius [0, 4, 4, 0]) ;
 *  - axe numérique en dessous.
 * `height` doit correspondre à la hauteur du ResponsiveContainer réel.
 */
const ChartTopAuteursSkeleton = ({ height = 220 }) => (
  <div
    role="status"
    aria-label="Chargement du classement des auteurs"
    className="flex w-full flex-col gap-2 p-3"
    style={{ height }}
  >
    {/* Zone du graphique : axe des noms + barres horizontales */}
    <div className="flex flex-1 gap-2">
      {/* Axe Y catégoriel : noms des admins (width={110}) */}
      <div className="flex w-27.5 shrink-0 flex-col justify-around py-1" aria-hidden="true">
        {LARGEURS_BARRES.map((_, i) => (
          <Skeleton
            key={i}
            className="h-2.5 w-full rounded-sm"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>

      {/* Barres, alignées à gauche comme le BarChart horizontal */}
      <div className="flex flex-1 flex-col justify-around border-b border-border pb-px">
        {LARGEURS_BARRES.map((l, i) => (
          <Skeleton
            key={i}
            className="h-4 rounded-r-sm"
            style={{ width: `${l}%`, animationDelay: `${i * 90 + 40}ms` }}
          />
        ))}
      </div>
    </div>

    {/* Axe X numérique : graduations sous la zone des barres,
        décalées de la largeur de l'axe catégoriel */}
    <div className="flex gap-2" aria-hidden="true">
      <div className="w-27.5 shrink-0" />
      <div className="flex flex-1 justify-between">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-2 w-6 rounded-sm" />
        ))}
      </div>
    </div>
  </div>
);

const ChartsJournal = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useJournalStatsQuery(30)

  // H : volume d'actions par jour (déjà chronologique côté serveur).
  const parJour = useMemo(
    () =>
      (stats?.par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        actions: j.total,
      })),
    [stats]
  )

  const topAuteurs = useMemo(
    () =>
      (stats?.top_auteurs ?? []).map((a) => ({
        nom: a.nom || "Admin supprimé",
        actions: a.total,
      })),
    [stats]
  )

  const etat = isError ? "erreur" : isLoading ? "chargement" : !parJour.length ? "vide" : "donnees"

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <SectionCardAdmin
          title="Actions par jour (30 derniers jours)"
          description="Volume d'actions journalisées par jour."
          icon={Activity}
          contentClassName="p-0 sm:p-0"
        >
          <TransitionEtat etat={etat} >
            {isError ? (
              <SectionErreur onRetry={refetch} message="Impossible de charger les données du journal." className="m-4" />
            ) : isLoading ? (
              <ChartActionsSkeleton />
            ) : !parJour.length ? (
              <SectionVide message="Aucune action enregistrée dans la fenêtre." />
            ) : (
              <CadreChart
                vide={!parJour.length}
                videMessage="Aucune action enregistrée dans la fenêtre."
              >
                <BarChart data={parJour} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="jour" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<TooltipJournal />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
                  <Bar
                    dataKey="actions"
                    name="Actions"
                    fill="var(--chart-2)"
                    isAnimationActive={!mouvementReduit}
                    animationDuration={500}
                    animationEasing="ease-out"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </CadreChart>
            )}
          </TransitionEtat>
        </SectionCardAdmin>
      </div>

      <SectionCardAdmin
        title="Top auteurs (30 j)"
        description="Auteurs les plus actifs en première place."
        icon={UserCheck}
        contentClassName="p-0 sm:p-0"
      >
        <TransitionEtat etat={etat} >
          {isError ? (
            <SectionErreur onRetry={refetch} message="Impossible de charger le top des auteurs du journal." className="m-4" />
          ) : isLoading ? (
            <ChartTopAuteursSkeleton height={220} />
          ) : !parJour.length ? (
            <SectionVide message="Aucune action enregistrée dans la fenêtre." />
          ) : (
            <CadreChart
              vide={!topAuteurs.length}
              videMessage="Aucun auteur actif dans la fenêtre."
            >
              <BarChart
                data={topAuteurs}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: -21 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nom" width={110} fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipJournal />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
                <Bar
                  dataKey="actions"
                  name="Actions"
                  fill="var(--chart-3)"
                  isAnimationActive={!mouvementReduit}
                  animationDuration={500}
                  animationEasing="ease-out"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </CadreChart>
          )}
        </TransitionEtat>
      </SectionCardAdmin>
    </div>
  )
}

export default ChartsJournal