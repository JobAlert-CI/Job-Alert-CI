import { Link } from "react-router-dom"
import { useState } from "react"
import { Eye, Star, TrendingUp } from "lucide-react"
import { useAdminTopViewedQuery } from "@/features/admin-dashboard.tools"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/* ─────────────────────────────────────────────────────────────────────
   Section 4 — Top 10 des offres les plus consultées.

   Audit 4, H.2 : le paramètre days est désormais EFFECTIF côté serveur
   (vues datées via last_seen_at, posé par le flush Redis des compteurs
   ≤ 1 min après la vue réelle). Sélecteur de fenêtre 7 / 30 jours —
   plus de faux « depuis toujours ».

   Shape réelle (vérifiée API + fixture) : { id, title, status,
   visible_site, view_count, save_count, published_at, company: {id,
   name, slug}, primary_filiere_id }.
   ───────────────────────────────────────────────────────────────────── */

const FENETRES = [
  { valeur: 7, libelle: "7 jours" },
  { valeur: 30, libelle: "30 jours" },
]

/** État local de la fenêtre (7 / 30 jours) — useState simple, pas de global. */
const useFenetreVues = () => {
  const [days, setDays] = useState(7)
  return [days, setDays]
}

const TopOffres = () => {
  const [days, setDays] = useFenetreVues()
  const { data, isLoading, isError, refetch } = useAdminTopViewedQuery({ limit: 10, days })

  return (
    <section aria-label="Offres les plus consultées">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" aria-hidden />
          Offres les plus consultées
        </h2>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList className="h-7">
            {FENETRES.map((f) => (
              <TabsTrigger key={f.valeur} value={String(f.valeur)} className="px-2.5 py-0 text-[11px]">
                {f.libelle}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger le top des offres." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <SectionVide message="Aucune offre consultée pour le moment." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-right">#</TableHead>
                <TableHead>Offre</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead className="text-right">Vues</TableHead>
                <TableHead className="text-right">Sauvegardes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((offre, i) => (
                <TableRow key={offre.id}>
                  <TableCell className="text-right font-semibold text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="max-w-64">
                    <Link
                      to={`/admin/offres/${offre.id}`}
                      className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                      title={offre.title}
                    >
                      {offre.title}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {offre.company?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3 text-muted-foreground" aria-hidden />
                      {offre.view_count ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 text-muted-foreground" aria-hidden />
                      {offre.save_count ?? 0}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

export default TopOffres
