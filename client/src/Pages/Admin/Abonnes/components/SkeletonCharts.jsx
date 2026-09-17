import { Skeleton } from "@/components/ui/skeleton";

/* ─────────────────────────────────────────────────────────────────────
   Skeletons de charts — géométrie fidèle aux composants Recharts réels.
   Conventions :
   • Tokens CSS du projet (var(--color-muted), --color-surface-container-high)
   • role="status" + aria-label sur le wrapper
   • Cascade d'animationDelay pour un pulse vivant
   • height paramétrable pour éviter tout layout shift
───────────────────────────────────────────────────────────────────── */

/**
 * Donut (PieChart) — anneau avec segments séparés par gaps de 2°,
 * trou central calibré sur innerRadius/outerRadius du chart réel.
 * Proportions réalistes : 4 segments décroissants.
 */
const SkeletonDonut = ({ height = 220, nbSegments = 4 }) => (
  <div
    role="status"
    aria-label="Chargement du graphique de répartition"
    className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-3"
    style={{ height }}
  >
    {/* Donut : segments neutres séparés par des gaps de 2° */}
    <div className="relative aspect-square w-full max-w-37.5">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(
            var(--color-muted) 0deg 138deg,
            transparent 138deg 140deg,
            var(--color-surface-container-high) 140deg 228deg,
            transparent 228deg 230deg,
            var(--color-muted) 230deg 288deg,
            transparent 288deg 290deg,
            var(--color-surface-container-high) 290deg 358deg,
            transparent 358deg 360deg
          )`,
        }}
      />
      {/* Trou central — ratio innerRadius/outerRadius = 55/80 ≈ 15,6% inset */}
      <div className="absolute rounded-full bg-card" style={{ inset: "15.6%" }} />
    </div>

    {/* Légende : visible sur tous les viewports (pas hidden sm:flex) */}
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1" aria-hidden="true">
      {Array.from({ length: nbSegments }, (_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Skeleton className="h-2.5 w-2.5 rounded-xs" />
          <Skeleton className="h-2 w-12 rounded-xs" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Barres (BarChart) — vertical ou horizontal.
 * • Vertical : barres alignées en bas, axe Y à gauche, libellés X dessous
 * • Horizontal : barres alignées à gauche, axe catégoriel à gauche (w-[120px])
 * Cascade d'animation pour un pulse de gauche à droite.
 */
const SkeletonBarres = ({ height = 220, horizontal = false, nbBarres = 7 }) => {
  const hauteurs = [46, 72, 38, 84, 56, 30, 64].slice(0, nbBarres);

  if (horizontal) {
    return (
      <div
        role="status"
        aria-label="Chargement du graphique à barres horizontales"
        className="flex w-full flex-col gap-2"
        style={{ height }}
      >
        <div className="flex flex-1 gap-2">
          {/* Axe catégoriel à gauche (width={120} des charts réels) */}
          <div className="flex w-30 shrink-0 flex-col justify-around py-1" aria-hidden="true">
            {hauteurs.map((_, i) => (
              <Skeleton
                key={i}
                className="h-2.5 w-full rounded-sm"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>

          {/* Barres horizontales, alignées à gauche */}
          <div className="flex flex-1 flex-col justify-around border-b border-border pb-px">
            {hauteurs.map((l, i) => (
              <Skeleton
                key={i}
                className="h-14 rounded-r-sm"
                style={{ width: `${l}%`, animationDelay: `${i * 90 + 40}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Axe numérique sous les barres */}
        <div className="flex gap-2" aria-hidden="true">
          <div className="w-30 shrink-0" />
          <div className="flex flex-1 justify-between">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-2 w-6 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Chargement du graphique à barres"
      className="flex w-full gap-2"
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
        {/* Barres alignées en bas, arrondies en haut (radius [4,4,0,0]) */}
        <div className="flex flex-1 items-end gap-3 border-b border-border pb-px">
          {hauteurs.map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>

        {/* Libellés de l'axe X */}
        <div className="mt-2 flex gap-3" aria-hidden="true">
          {hauteurs.map((_, i) => (
            <Skeleton key={i} className="h-2 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Courbe (LineChart) — polyligne SVG monotone avec points,
 * comme ChartDureeMoyenneSkeleton. vectorEffect conserve le
 * strokeWidth=2px à toutes les tailles de conteneur.
 */
const SkeletonCourbe = ({ height = 220, avecPoints = true }) => {
  /* Profil réaliste d'une durée moyenne fluctuante. */
  const POINTS = [
    [0, 150], [100, 110], [200, 130], [300, 70],
    [400, 90], [500, 50], [600, 80], [700, 40],
  ];

  return (
    <div
      role="status"
      aria-label="Chargement du graphique de tendance"
      className="flex w-full animate-pulse gap-2"
      style={{ height }}
    >
      {/* Axe Y : 3 graduations */}
      <div className="flex w-6 flex-col justify-between py-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-2 w-full rounded-sm" />
        ))}
      </div>

      {/* Zone du graphique */}
      <div className="flex flex-1 flex-col">
        <div className="relative flex-1 overflow-hidden border-b border-border">
          {/* Courbe monotone — vectorEffect garde 2px à toute taille */}
          <svg
            viewBox="0 0 700 200"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <polyline
              points={POINTS.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="var(--color-surface-container-high)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Points de la courbe (diameter 4px = r:2) */}
          {avecPoints &&
            POINTS.map(([x, y], i) => (
              <Skeleton
                key={x}
                className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-container-high"
                style={{
                  left: `${(x / 700) * 100}%`,
                  top: `${(y / 200) * 100}%`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            ))}
        </div>

        {/* Libellés de l'axe X */}
        <div className="mt-2 flex justify-between" aria-hidden="true">
          {POINTS.map((_, i) => (
            <Skeleton key={i} className="h-2 w-8 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
};

export { SkeletonDonut, SkeletonBarres, SkeletonCourbe };