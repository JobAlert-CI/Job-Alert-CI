import { useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {motion} from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts"
import { Compass, KeyRound, MailCheck, MapPin, PieChartIcon, Receipt, TrendingUp, UserPlus } from "lucide-react"
import {
  useStatsAbonnesOverview, useStatsInscriptionsParJour, useStatsTopFilieres,
  useStatsCroissance, useStatsParVille, useStatsTopContrats, useStatsEnvoisParJour,
} from "@/features/admin-abonnes.tools"
import ChartAbonnes from "../components/ChartAbonnes"
import { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import { SkeletonBarres, SkeletonCourbe, SkeletonDonut } from "../components/SkeletonCharts"
import TooltipChart from "../components/TooltipChart"

/* ─────────────────────────────────────────────────────────────────────
   Charts de la page Abonnés (cycle 7) — toutes les données viennent
   du router /subscribers/stats (vérifié live), recharts confiné au
   chunk lazy de la page.
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

const jourCourt = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}


const OngletStats = () => {
  const mouvementReduit = useReducedMotion()

  const { data: stats, isLoading: statsChargement, isError: statsErreur, refetch: refetchStats } = useStatsAbonnesOverview()
  const { data: inscriptions, isLoading: inscriptionsChargement, isError: inscriptionsErreur, refetch: refetchInscriptions } = useStatsInscriptionsParJour({ days: 30 })
  const { data: croissance, isLoading: croissanceChargement, isError: croissanceErreur, refetch: refetchCroissance } = useStatsCroissance({ days: 90 })
  const { data: topFilieres, isLoading: filieresChargement, isError: filieresErreur, refetch: refetchTopFilieres } = useStatsTopFilieres({ limit: 8 })
  const { data: parVille, isLoading: villesChargement, isError: villesErreur, refetch: refetchParVille } = useStatsParVille({ limit: 8 })
  const { data: topContrats, isLoading: contratsChargement, isError: contratsErreur, refetch: refetchTopContrats } = useStatsTopContrats({ limit: 8 })
  const { data: envois, isLoading: envoisChargement, isError: envoisErreur, refetch: refetchEnvois } = useStatsEnvoisParJour({ days: 30 })

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
    <motion.div
      variants={VARIANTS_CONTENEUR}
      initial="cache"
      animate="visible"
      className="flex flex-col gap-4"
    >
      <ChartAbonnes
        title="Inscriptions par jour (30 j)"
        icon={UserPlus}
        etat={inscriptionsErreur ? "erreur" : inscriptionsChargement ? "chargement" : !inscriptions?.length ? "vide" : "donnees"}
        isError={inscriptionsErreur}
        isLoading={inscriptionsChargement}
        donnees={inscriptions}
        refetch={refetchInscriptions}
        messageError="Impossible de charger l'état des inscriptions."
        messageVide="Aucune inscription sur la période."
        skeletonChart={<SkeletonBarres />}
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
      </ChartAbonnes>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 2. Croissance cumulée (courbe) */}
        <ChartAbonnes
          title="Croissance de la base (90 j)"
          icon={TrendingUp}
          etat={croissanceErreur ? "erreur" : croissanceChargement ? "chargement" : !croissance?.length ? "vide" : "donnees"}
          isError={croissanceErreur}
          isLoading={croissanceChargement}
          donnees={croissance}
          refetch={refetchCroissance}
          messageError="Impossible de charger l'état du croisement."
          messageVide="La courbe apparaîtra dads la première inscription."
          skeletonChart={<SkeletonCourbe />}
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
        </ChartAbonnes>

        {/* 3. Répartition par statut (donut SÉMANTIQUE) */}
        <ChartAbonnes
          title="Répartition par statut"
          icon={PieChartIcon}
          etat={statsErreur ? "erreur" : statsChargement ? "chargement" : !donneesStatuts.length ? "vide" : "donnees"}
          isError={statsErreur}
          isLoading={statsChargement}
          donnees={donneesStatuts}
          refetch={refetchStats}
          messageError="Impossible de charger les statuts d'abonné."
          messageVide="Aucun abonné en base."
          skeletonChart={<SkeletonDonut />}
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
        </ChartAbonnes>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 4. Digests par jour (barres empilées, couleurs déjà sémantiques) */}
        <ChartAbonnes
          title="Digests par jour (30 j)"
          icon={MailCheck}
          etat={envoisErreur ? "erreur" : envoisChargement ? "chargement" : !envois?.length ? "vide" : "donnees"}
          isError={envoisErreur}
          isLoading={envoisChargement}
          donnees={envois}
          refetch={refetchEnvois}
          messageError="Impossible de charger l'historique des digest."
          messageVide="Aucun digest programmé sur la période."
          skeletonChart={<SkeletonBarres />}
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
        </ChartAbonnes>

        {/* 5. Sources d'inscription (donut) */}
        <ChartAbonnes
          title="Sources d'inscription"
          icon={Compass}
          etat={statsErreur ? "erreur" : statsChargement ? "chargement" : !donneesSources.length ? "vide" : "donnees"}
          isError={statsErreur}
          isLoading={statsChargement}
          donnees={donneesSources}
          refetch={refetchStats}
          messageError="Impossible de charger l'historique des sources d'inscription."
          messageVide="Aucune source enregistrée."
          skeletonChart={<SkeletonDonut />}
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
        </ChartAbonnes>
      </div>

      {/* 6. Filières les plus choisies */}
      <ChartAbonnes
        title="Filières les plus choisies"
        icon={KeyRound}
        etat={filieresErreur ? "erreur" : filieresChargement ? "chargement" : !topFilieres?.length ? "vide" : "donnees"}
        isError={filieresErreur}
        isLoading={filieresChargement}
        donnees={topFilieres}
        refetch={refetchTopFilieres}
        messageError="Impossible de charger l'historique des filieres."
        messageVide="Aucune filière choisie par les abonnés."
        skeletonChart={<SkeletonBarres horizontal nbBarres={3} />}
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
      </ChartAbonnes>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 7. Top villes */}
        <ChartAbonnes
          title="Répartition par ville"
          icon={MapPin}
          etat={villesErreur ? "erreur" : villesChargement ? "chargement" : !parVille?.length ? "vide" : "donnees"}
          isError={villesErreur}
          isLoading={villesChargement}
          donnees={parVille}
          refetch={refetchParVille}
          messageError="Impossible de charger l'historique des villes."
          messageVide="Aucune ville renseignée."
          skeletonChart={<SkeletonBarres horizontal nbBarres={3} />}
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
        </ChartAbonnes>

        {/* 8. Contrats préférés */}
        <ChartAbonnes
          title="Types de contrat préférés"
          icon={Receipt}
          etat={contratsErreur ? "erreur" : contratsChargement ? "chargement" : !topContrats?.length ? "vide" : "donnees"}
          isError={contratsErreur}
          isLoading={contratsChargement}
          donnees={topContrats}
          refetch={refetchTopContrats}
          messageError="Impossible de charger l'historique des contrats."
          messageVide="Aucun contrat choisie par les abonnés."
          skeletonChart={<SkeletonBarres horizontal nbBarres={3} />}
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
        </ChartAbonnes>
      </div>
    </motion.div>
  )
}

export default OngletStats