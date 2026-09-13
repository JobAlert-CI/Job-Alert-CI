import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { BarChart3 } from "lucide-react"
import { cn } from "cn"
import {
  useStatsAbonnesOverview, useStatsInscriptionsParJour, useStatsTopFilieres,
  useStatsCroissance, useStatsParVille, useStatsTopContrats, useStatsEnvoisParJour,
} from "@/features/admin-abonnes.tools"
import { Skeleton } from "@/components/ui/skeleton"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Charts de la page Abonnés (cycle 7) — toutes les données viennent
   du router /subscribers/stats (vérifié live), recharts confiné au
   chunk lazy de la page.
   Refonte :
   • COULEURS SÉMANTIQUES par statut (vert actifs, rouge rebonds,
     gris anonymisés…) au lieu d'une palette positionnelle ;
   • animations Recharts réactivées, coupées si prefers-reduced-motion ;
   • skeletons FIDÈLES (anneau pour les donuts, barres pour les
     histogrammes) ;
   • tooltips stylés + milliers fr-FR.
───────────────────────────────────────────────────────────────────── */

const COULEURS = ["#0F2D4D", "#10b981", "#F5A623", "#ef4444", "#8b5cf6", "#64748b"]

/* Sémantique par statut : lecture immédiate du donut. */
const STATUTS_CHART = {
  active: { libelle: "Actifs", couleur: "#0F2D4D" },
  unsubscribed: { libelle: "Désinscrits", couleur: "#64748b" },
  bouncing: { libelle: "Rebonds", couleur: "#ef4444" },
  paused: { libelle: "En pause", couleur: "#F5A623" },
  pending: { libelle: "En attente", couleur: "#8b5cf6" },
  deleted: { libelle: "Anonymisés", couleur: "#94a3b8" },
}

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const jourCourt = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

/* Tooltip unique et stylé (pattern page IA). */
const TooltipChart = ({ active, payload, label, suffixe = "", formateurLabel }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label != null && label !== "" && (
        <p className="font-semibold">{formateurLabel ? formateurLabel(label) : label}</p>
      )}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="text-muted-foreground">
          {p.name} : {formatNombre(p.value)}{suffixe}
        </p>
      ))}
    </div>
  )
}

/* ─── Skeletons fidèles par type de chart ─── */
const SkeletonDonut = () => (
  <div className="flex items-center justify-center gap-6 py-4">
    <div className="relative size-36 shrink-0" aria-hidden="true">
      <Skeleton className="size-36 rounded-full" />
      <div className="absolute inset-7 rounded-full bg-card" />
    </div>
    <div className="hidden flex-col gap-2 sm:flex" aria-hidden="true">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-3 w-28" />)}
    </div>
  </div>
)

const SkeletonBarres = ({ horizontal = false }) => (
  <div
    className={cn(
      "flex gap-2 p-2",
      horizontal ? "h-44 flex-col justify-center" : "h-44 items-end"
    )}
    aria-hidden="true"
  >
    {[45, 70, 55, 90, 60, 75, 40, 65].map((h, i) =>
      horizontal ? (
        <Skeleton key={i} className="h-3 rounded" style={{ width: `${h}%` }} />
      ) : (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
      )
    )}
  </div>
)

const SkeletonCourbe = () => (
  <div className="flex h-44 flex-col justify-end gap-1 p-2" aria-hidden="true">
    <Skeleton className="h-24 w-full rounded-lg" />
    <Skeleton className="h-3 w-1/3" />
  </div>
)

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220, className = "", skeleton }) => (
  <div className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-soft", className)}>
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{titre}</h3>
    {chargement ? (
      skeleton ?? <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <div className="py-4">
        <SectionVide message={videMessage} />
      </div>
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    )}
  </div>
)

const OngletStats = () => {
  const mouvementReduit = useReducedMotion()

  const { data: stats, isLoading: statsChargement } = useStatsAbonnesOverview()
  const { data: inscriptions, isLoading: inscriptionsChargement } = useStatsInscriptionsParJour({ days: 30 })
  const { data: croissance, isLoading: croissanceChargement } = useStatsCroissance({ days: 90 })
  const { data: topFilieres, isLoading: filieresChargement } = useStatsTopFilieres({ limit: 8 })
  const { data: parVille, isLoading: villesChargement } = useStatsParVille({ limit: 8 })
  const { data: topContrats, isLoading: contratsChargement } = useStatsTopContrats({ limit: 8 })
  const { data: envois, isLoading: envoisChargement } = useStatsEnvoisParJour({ days: 30 })

  // Donut statuts : couleurs SÉMANTIQUES depuis STATUTS_CHART.
  const donneesStatuts = useMemo(() => {
    const byStatus = stats?.by_status ?? {}
    return Object.entries(byStatus)
      .filter(([, v]) => v > 0)
      .map(([statut, valeur]) => ({
        name: STATUTS_CHART[statut]?.libelle ?? statut,
        value: valeur,
        couleur: STATUTS_CHART[statut]?.couleur ?? "#94a3b8",
      }))
  }, [stats])

  // Donut sources (palette générique : les sources ne sont pas connues d'avance).
  const donneesSources = useMemo(() => {
    const bySource = stats?.by_source ?? {}
    return Object.entries(bySource)
      .filter(([, v]) => v > 0)
      .map(([source, valeur]) => ({ name: source, value: valeur }))
  }, [stats])

  return (
    <SectionCardAdmin
      title="Analyse des abonnés"
      description="Inscriptions, croissance, statuts, digests et préférences — fenêtres 30 et 90 jours."
      icon={BarChart3}
      contentClassName="flex flex-col gap-6"
    >
      <CadreChart
        titre="Inscriptions par jour (30 j)"
        chargement={inscriptionsChargement}
        skeleton={<SkeletonBarres />}
        vide={!inscriptions?.length}
        videMessage="Aucune inscription sur la période."
      >
        <BarChart data={inscriptions ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipChart formateurLabel={jourCourt} />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
          <Bar
            dataKey="count"
            name="Inscriptions"
            fill={COULEURS[0]}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!mouvementReduit}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </BarChart>
      </CadreChart>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 2. Croissance cumulée (courbe) */}
        <CadreChart
          titre="Croissance de la base (90 j)"
          chargement={croissanceChargement}
          skeleton={<SkeletonCourbe />}
          vide={!croissance?.length}
          videMessage="La courbe apparaîtra dès la première inscription."
          className="xl:col-span-2"
        >
          <LineChart data={croissance ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipChart formateurLabel={jourCourt} />} />
            <Line
              type="monotone"
              dataKey="cumulative_count"
              name="Abonnés cumulés"
              stroke={COULEURS[2]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!mouvementReduit}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </LineChart>
        </CadreChart>

        {/* 3. Répartition par statut (donut SÉMANTIQUE) */}
        <CadreChart
          titre="Répartition par statut"
          chargement={statsChargement}
          skeleton={<SkeletonDonut />}
          vide={!donneesStatuts.length}
          videMessage="Aucun abonné en base."
        >
          <PieChart>
            <Pie
              data={donneesStatuts}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={!mouvementReduit}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {donneesStatuts.map((e) => <Cell key={e.name} fill={e.couleur} />)}
            </Pie>
            <Tooltip content={<TooltipChart suffixe=" abonné(s)" />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </CadreChart>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 4. Digests par jour (barres empilées, couleurs déjà sémantiques) */}
        <CadreChart
          titre="Digests par jour (30 j)"
          chargement={envoisChargement}
          skeleton={<SkeletonBarres />}
          vide={!envois?.length}
          videMessage="Aucun digest programmé sur la période."
        >
          <BarChart data={envois ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="day" tickFormatter={jourCourt} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipChart formateurLabel={jourCourt} />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {[
              { key: "sent", libelle: "Envoyés", couleur: "#0F2D4D" },
              { key: "skipped_empty", libelle: "Sans offre", couleur: "#F5A623" },
              { key: "failed", libelle: "Échoués", couleur: "#ef4444" },
              { key: "queued", libelle: "En file", couleur: "#6bfe9c" },
            ].map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.libelle}
                stackId="s"
                fill={s.couleur}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </CadreChart>

        {/* 5. Sources d'inscription (donut) */}
        <CadreChart
          titre="Sources d'inscription"
          chargement={statsChargement}
          skeleton={<SkeletonDonut />}
          vide={!donneesSources.length}
          videMessage="Aucune source enregistrée."
        >
          <PieChart>
            <Pie
              data={donneesSources}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={!mouvementReduit}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {donneesSources.map((_, i) => <Cell key={i} fill={COULEURS[(i + 2) % COULEURS.length]} />)}
            </Pie>
            <Tooltip content={<TooltipChart suffixe=" inscription(s)" />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </CadreChart>
      </div>

      {/* 6. Filières les plus choisies */}
      <CadreChart
        titre="Filières les plus choisies"
        chargement={filieresChargement}
        skeleton={<SkeletonBarres horizontal />}
        vide={!topFilieres?.length}
        videMessage="Aucune filière choisie par les abonnés."
        className="xl:col-span-2"
      >
        <BarChart data={topFilieres ?? []} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={110} fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipChart suffixe=" abonné(s)" />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
          <Bar
            dataKey="subscribers_count"
            name="Abonnés"
            fill={COULEURS[0]}
            radius={[0, 4, 4, 0]}
            isAnimationActive={!mouvementReduit}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </BarChart>
      </CadreChart>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 7. Top villes */}
        <CadreChart
          titre="Répartition par ville"
          chargement={villesChargement}
          skeleton={<SkeletonBarres horizontal />}
          vide={!parVille?.length}
          videMessage="Aucune ville renseignée."
        >
          <BarChart data={parVille ?? []} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="city" width={110} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipChart suffixe=" abonné(s)" />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
            <Bar
              dataKey="count"
              name="Abonnés"
              fill={COULEURS[5]}
              radius={[0, 4, 4, 0]}
              isAnimationActive={!mouvementReduit}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </CadreChart>

        {/* 8. Contrats préférés */}
        <CadreChart
          titre="Types de contrat préférés"
          chargement={contratsChargement}
          skeleton={<SkeletonBarres horizontal />}
          vide={!topContrats?.length}
          videMessage="Aucune préférence de contrat."
        >
          <BarChart data={topContrats ?? []} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={110} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipChart suffixe=" abonné(s)" />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
            <Bar
              dataKey="subscribers_count"
              name="Abonnés"
              fill={COULEURS[2]}
              radius={[0, 4, 4, 0]}
              isAnimationActive={!mouvementReduit}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </CadreChart>
      </div>
    </SectionCardAdmin>
  )
}

export default OngletStats