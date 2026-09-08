import { useMemo } from "react"
import { History, UserCog, Users } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { useParametresQuery } from "@/features/admin-parametres.tools"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs de la page Paramètres (cycle 18, sélection validée P1-P4).

   P1 — Total paramètres       : settings.length
   P2 — Modifiés par un admin  : updated_by_admin_id ≠ null (vrai
                                 signal « touché via l'admin » : le
                                 seed n'en pose pas)
   P3 — Modifiés sur 30 j      : updated_at dans la fenêtre
   P4 — Dernière modification  : KPI TEXTE dérivé (date + auteur)

   Tous dérivés de la liste unique GET /settings — zéro endpoint
   supplémentaire. P2/P3 sont des signes d'activité réelle sur la
   config, P4 l'audit rapide « qui a touché la config en dernier ».
   ───────────────────────────────────────────────────────────────────── */

/** Borne temporelle 30 j au niveau MODULE (react-hooks/purity interdit
 *  Date.now() PENDANT le render). */
const IL_Y_A_30J = Date.now() - 30 * 24 * 60 * 60 * 1000

const CompteursParametres = () => {
  const { data: parametres, isLoading } = useParametresQuery()

  const valeurs = useMemo(() => {
    const liste = parametres ?? []
    const modifiesParAdmin = liste.filter((p) => p.updated_by_admin_id).length
    const fenetre30j = liste.filter(
      (p) => new Date(p.updated_at).getTime() >= IL_Y_A_30J
    ).length
    // P4 : plus récente modification (date DESC), auteur inclus.
    const derniere = liste
      .filter((p) => p.updated_at)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
    return {
      total: liste.length,
      modifiesParAdmin,
      fenetre30j,
      derniere,
    }
  }, [parametres])

  const dateDerniere = useMemo(() => {
    if (!valeurs.derniere) return "—"
    const d = new Date(valeurs.derniere.updated_at)
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
      " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }, [valeurs.derniere])

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className="flex items-center gap-3 rounded-xl">
        <CarteCompteur label="Total paramètres" valeur={valeurs.total} chargement={isLoading} />
      </div>
      <div className="flex items-center gap-3 rounded-xl">
        <CarteCompteur label="Modifiés par un admin" valeur={valeurs.modifiesParAdmin} chargement={isLoading} />
      </div>
      <div className="flex items-center gap-3 rounded-xl">
        <CarteCompteur label="Modifiés (30 j)" valeur={valeurs.fenetre30j} chargement={isLoading} />
      </div>
      {/* P4 : KPI texte — pas un compteur, un panneau court */}
      <div
        className="flex flex-col justify-center gap-1 rounded-xl border border-border bg-card p-4"
        aria-label="Dernière modification"
      >
        <span className="flex items-center gap-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          <History className="size-3.5" aria-hidden /> Dernière modification
        </span>
        {isLoading ? (
          <span className="text-sm text-muted-foreground">Chargement…</span>
        ) : valeurs.derniere ? (
          <>
            <span className="text-sm font-semibold tabular-nums">{dateDerniere}</span>
            <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              {valeurs.derniere.updated_by_admin_id ? (
                <><UserCog className="size-3 shrink-0" aria-hidden /> par un administrateur</>
              ) : (
                <><Users className="size-3 shrink-0" aria-hidden /> par le seed (aucun admin)</>
              )}
              <span className="truncate font-mono">· {valeurs.derniere.key}</span>
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Aucune modification.</span>
        )}
      </div>
    </div>
  )
}

export default CompteursParametres
