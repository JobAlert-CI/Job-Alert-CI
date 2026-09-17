import { motion, AnimatePresence } from "framer-motion"
import { FileText, FolderTree, Globe, Layers, Lightbulb, Newspaper } from "lucide-react"
import { cn } from "cn"
import { useFiltresContenuAdmin, FiltresContenuAdminProvider } from "@/contexts/FiltresContenuAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletArticles from "./onglets/OngletArticles"
import OngletCategories from "./onglets/OngletCategories"
import OngletSeries from "./onglets/OngletSeries"
import OngletConseils from "./onglets/OngletConseils"
import OngletPages from "./onglets/OngletPages"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"
import HeroAdmin from "@/components/admin/HeroAdmin"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du contenu — /admin/contenu (super_admin + moderateur,
   doc v3 §14).
   Refonte complète — même gestion d'onglets que la page IA :
   • Onglet actif synchronisé en URL via FiltresContenuAdminProvider
     (deep-link / rechargement conservé).
   • Barre d'onglets horizontale défilante (scrollbar masquée),
     onglet actif sur fond orange + texte navy (contraste AA).
   • Fondu enchaîné entre onglets (AnimatePresence mode="wait") +
     cascade des sections internes (VARIANTS_PANNEAU).
   • Un icône distinct par onglet (avant : 5 fois Newspaper).
   5 onglets (chacun porte son ErrorBoundary — un onglet qui plante
   n'emporte pas la page) :
   1. Articles     — liste filtrable + TRI + éditeur complet ;
   2. Catégories   — CRUD + tri ;
   3. Séries       — CRUD + composition + tri ;
   4. Conseils     — CRUD + créneau de rotation + tri ;
   5. Pages        — CRUD + tri.
   L'onglet FAQ n'existe pas (aucune route admin — doc v3 §14.5).
   ───────────────────────────────────────────────────────────────────── */
const ONGLETS = [
  { valeur: "articles", libelle: "Articles", Icone: FileText },
  { valeur: "categories", libelle: "Catégories", Icone: FolderTree },
  { valeur: "series", libelle: "Séries", Icone: Layers },
  { valeur: "conseils", libelle: "Conseils du jour", Icone: Lightbulb },
  { valeur: "pages", libelle: "Pages statiques", Icone: Globe },
]

const VARIANTS_PANNEAU = {
  cache: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const ContenuAdmin = () => {
  const { onglet, setOnglet } = useFiltresContenuAdmin()

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── En-tête ─── */}
      <HeroAdmin
        title="Gestion du contenu"
        titleBdge="Contenu & sécurité"
        icon={Newspaper}
        description="Articles, catégories, séries, conseils du jour et pages statiques du site public."
      />

      {/* ─── Onglets (synchronisés URL, pattern page IA) ─── */}
      <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
        <TabsList
          className={cn(
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-muted/20 p-1",
            "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {ONGLETS.map(({ valeur, libelle, Icone }) => (
            <TabsTrigger
              key={valeur}
              value={valeur}
              className={cn(
                "gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                onglet === valeur
                  ? "bg-brand-orange text-brand-navy shadow-soft" /* navy sur orange : 6.3:1 AA */
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <Icone className="size-3.5" aria-hidden="true" />
              {libelle}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── Fondu enchaîné entre onglets + cascade des sections ─── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={onglet}
            role="tabpanel"
            aria-label={ONGLETS.find((o) => o.valeur === onglet)?.libelle}
            variants={VARIANTS_PANNEAU}
            initial="cache"
            animate="visible"
            exit="cache"
            className="mt-4"
          >
            {onglet === "articles" ? (
              <Bloc>
                <OngletArticles />
              </Bloc>
            ) : onglet === "categories" ? (
              <Bloc>
                <OngletCategories />
              </Bloc>
            ) : onglet === "series" ? (
              <Bloc>
                <OngletSeries />
              </Bloc>
            ) : onglet === "conseils" ? (
              <Bloc>
                <OngletConseils />
              </Bloc>
            ) : onglet === "pages" ? (
              <Bloc>
                <OngletPages />
              </Bloc>
            ) : (
              <Bloc>
                <OngletArticles />
              </Bloc>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  )
}

const PageContenu = () => (
  <FiltresContenuAdminProvider>
    <ContenuAdmin />
  </FiltresContenuAdminProvider>
)

export default PageContenu