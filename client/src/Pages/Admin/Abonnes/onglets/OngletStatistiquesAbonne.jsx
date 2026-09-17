import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { BarChartIcon, PieChartIcon } from "lucide-react"
import { useAdminSubscriberSendsQuery } from "@/features/admin-abonnes.tools"
import { SkeletonBarres, SkeletonDonut } from "../components/SkeletonCharts"
import ChartAbonnes from "../components/ChartAbonnes"

/* ─────────────────────────────────────────────────────────────────────
Onglet Statistiques abonné
Améliorations :
- plus de return anticipé : les états passent par ChartAbonnes
- loading/error/empty/success animés par ChartAbonnes
- responsive mobile
───────────────────────────────────────────────────────────────────── */

const KIND_MATCH = {
  primary: {
    libelle: "Filière principale",
    ton: "default",
    couleur: "#2563eb",
    repli: false,
  },
  secondary: {
    libelle: "Filière secondaire (T1)",
    ton: "secondary",
    couleur: "#10b981",
    repli: false,
  },
  fallback_contract: {
    libelle: "Même contrat (T2)",
    ton: "secondary",
    couleur: "#f59e0b",
    repli: true,
  },
  fallback_freshness: {
    libelle: "Offre récente (T3)",
    ton: "secondary",
    couleur: "#a855f7",
    repli: true,
  },
  fallback_experience: {
    libelle: "Profil proche (T4)",
    ton: "outline",
    couleur: "#ec4899",
    repli: true,
  },
  fallback_city: {
    libelle: "Même ville (T5)",
    ton: "outline",
    couleur: "#64748b",
    repli: true,
  },
}

const OngletStatistiquesAbonne = ({ id }) => {
  const {
    data: envois,
    isLoading,
    isError,
    refetch,
  } = useAdminSubscriberSendsQuery(id, { limit: 100 })

  const donneesPaliers = useMemo(() => {
    const compteurs = {}

    for (const envoi of envois ?? []) {
      for (const lien of envoi.offer_links ?? []) {
        const kind = lien.match_kind ?? "primary"
        compteurs[kind] = (compteurs[kind] ?? 0) + 1
      }
    }

    return Object.entries(compteurs).map(([kind, total]) => ({
      name: KIND_MATCH[kind]?.libelle ?? kind,
      value: total,
      couleur: KIND_MATCH[kind]?.couleur ?? "#94a3b8",
    }))
  }, [envois])

  const donneesTimeline = useMemo(
    () =>
      [...(envois ?? [])]
        .sort((a, b) =>
          String(a.digest_date).localeCompare(String(b.digest_date))
        )
        .map((envoi) => ({
          day: envoi.digest_date,
          offres: envoi.offer_count ?? 0,
          statut: envoi.status,
        })),
    [envois]
  )

  const etatDonut = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !donneesPaliers.length
        ? "vide"
        : "donnees"

  const etatBarres = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !donneesTimeline.length
        ? "vide"
        : "donnees"

  const jourCourt = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Donut paliers de matching */}
      <ChartAbonnes
        title="Paliers de matching reçus (tous digests)"
        icon={PieChartIcon}
        description="Pourcentage de digests par palier de matching."
        etat={etatDonut}
        isError={isError}
        isLoading={isLoading}
        donnees={donneesPaliers}
        refetch={refetch}
        messageVide="Aucune offre reçue — le donut apparaîtra dès qu'un digest contenant des offres sera envoyé."
        messageErreur="Impossible de charger le graphique."
        skeletonChart={<SkeletonDonut />}
      >
        <PieChart>
          <Pie
            data={donneesPaliers}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {donneesPaliers.map((entree, i) => (
              <Cell key={i} fill={entree.couleur} />
            ))}
          </Pie>

          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ChartAbonnes>

      {/* Timeline des envois */}
      <ChartAbonnes
        title="Offres reçues par digest"
        icon={BarChartIcon}
        description="Nombre d'offres reçues par digest."
        etat={etatBarres}
        isError={isError}
        isLoading={isLoading}
        donnees={donneesTimeline}
        refetch={refetch}
        messageVide="Aucun envoi — la timeline apparaîtra dès le premier digest."
        messageErreur="Impossible de charger le graphique."
        skeletonChart={<SkeletonBarres />}
      >
        <BarChart
          data={donneesTimeline}
          margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="day"
            tickFormatter={jourCourt}
            fontSize={10}
            tickLine={false}
          />
          <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
          <Bar
            dataKey="offres"
            name="Offres"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartAbonnes>
    </div>
  )
}

export default OngletStatistiquesAbonne