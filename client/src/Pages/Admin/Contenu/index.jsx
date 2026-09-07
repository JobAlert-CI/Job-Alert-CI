import { Newspaper } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import AdminSectionFallback from "@/components/admin/AdminSectionFallback"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import OngletArticles from "./OngletArticles"
import OngletCategories from "./OngletCategories"
import OngletSeries from "./OngletSeries"
import OngletConseils from "./OngletConseils"
import OngletPages from "./OngletPages"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du contenu — /admin/contenu (super_admin + moderateur,
   guard par route — doc v3 §14).

   5 onglets (chacun porte son ErrorBoundary — un onglet qui plante
   n'emporte pas la page) :
   1. Articles     — liste filtrable + éditeur complet (sections/blocs/
                     takeaways/key-figures, réordonnancement flèches) ;
   2. Catégories   — CRUD simple ;
   3. Séries       — CRUD + composition (remplacement total) ;
   4. Conseils     — CRUD + créneau de rotation 0-6 unique (409) ;
   5. Pages        — CRUD complet (routes créées cycle 14 côté serveur).

   L'onglet FAQ n'existe pas (aucune route admin — doc v3 §14.5).
   ───────────────────────────────────────────────────────────────────── */

const ContenuPage = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <section aria-label="En-tête contenu">
      <h1 className="flex items-center gap-2 font-heading text-lg font-bold">
        <Newspaper className="size-5 text-primary" aria-hidden />
        Contenu
      </h1>
      <p className="text-xs text-muted-foreground">
        Articles, catégories, séries, conseils du jour et pages statiques du site public.
      </p>
    </section>

    <Tabs defaultValue="articles">
      <TabsList className="flex-wrap">
        <TabsTrigger value="articles">Articles</TabsTrigger>
        <TabsTrigger value="categories">Catégories</TabsTrigger>
        <TabsTrigger value="series">Séries</TabsTrigger>
        <TabsTrigger value="conseils">Conseils du jour</TabsTrigger>
        <TabsTrigger value="pages">Pages statiques</TabsTrigger>
      </TabsList>

      <TabsContent value="articles" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletArticles />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="categories" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletCategories />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="series" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletSeries />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="conseils" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletConseils />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="pages" className="mt-4">
        <ErrorBoundary FallbackComponent={AdminSectionFallback}>
          <OngletPages />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  </div>
)

export default ContenuPage
