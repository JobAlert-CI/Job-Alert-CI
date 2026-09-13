import { useMemo } from "react"
import { FileEdit, History, Settings2, UserCog, Users } from "lucide-react"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { useParametresQuery } from "@/features/admin-parametres.tools"

/* ─────────────────────────────────────────────────────────────────────
   Compteurs de la page Paramètres (cycle 18, doc v3 §18).
   Refonte :
   • La borne « 30 derniers jours » est recalculée DANS le useMemo, à
     chaque dérivation : un onglet laissé ouvert plusieurs jours ne
     travaille plus avec une fenêtre obsolète (l'ancienne constante
     module IL_Y_A_30J était figée au chargement du bundle).
   • État de chargement propagé aux cartes (skeleton fidèle).
   ───────────────────────────────────────────────────────────────────── */
const CompteursParametres = () => {
  const { data: parametres, isLoading } = useParametresQuery()

  const valeurs = useMemo(() => {
    const liste = parametres ?? []
    /* Fenêtre glissante recalculée à chaque dérivation — jamais figée. */
    // eslint-disable-next-line react-hooks/purity
    const ilYA30j = Date.now() - 30 * 24 * 60 * 60 * 1000
    const modifiesParAdmin = liste.filter((p) => p.updated_by_admin_id).length
    const fenetre30j = liste.filter(
      (p) => p.updated_at && new Date(p.updated_at).getTime() >= ilYA30j
    ).length
    // P4 : plus récente modification (date DESC), auteur inclus.
    const derniere = liste
      .filter((p) => p.updated_at)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
    return { total: liste.length, modifiesParAdmin, fenetre30j, derniere }
  }, [parametres])

  const dateDerniere = useMemo(() => {
    if (!valeurs.derniere) return "—"
    const d = new Date(valeurs.derniere.updated_at)
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
      " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  }, [valeurs.derniere])

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <CarteCompteur label="Total paramètres" valeur={valeurs.total} icone={Settings2} chargement={isLoading} />
      <CarteCompteur label="Modifiés par un admin" valeur={valeurs.modifiesParAdmin} icone={UserCog} chargement={isLoading} />
      <CarteCompteur label="Modifiés (30 j)" valeur={valeurs.fenetre30j} icone={FileEdit} chargement={isLoading} />
      <CarteCompteur
        label="Dernière modification"
        texte={dateDerniere}
        icone={History}
        chargement={isLoading}
        description={
          valeurs.derniere && (
            <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              {valeurs.derniere.updated_by_admin_id ? (
                <><UserCog className="size-3 shrink-0" aria-hidden /> par un administrateur</>
              ) : (
                <><Users className="size-3 shrink-0" aria-hidden /> par le seed (aucun admin)</>
              )}
              <span className="truncate font-mono">· {valeurs.derniere.key}</span>
            </span>
          )
        }
      />
    </div>
  )
}

export default CompteursParametres