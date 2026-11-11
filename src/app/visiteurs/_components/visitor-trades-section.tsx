import type { DirectoryViewer } from "@/server/public-directory";
import { getVisitorTrades } from "@/server/public-trades";
import type { Translations } from "@/lib/i18n/locales/fr";
import type { VisitorsHubSearch } from "@/lib/visitors-hub";
import { VisitorTradesView } from "./visitor-trades-view";

/**
 * Section serveur de la vue « Échanges » : une seule lecture (Metamob + profils du
 * serveur), streamée par le `<Suspense>` de la page. Un échec de la base remonte à
 * l'`error.tsx` du segment — jamais une liste vide trompeuse.
 */
export async function VisitorTradesSection({
    viewer,
    hub,
    labels,
}: {
    viewer: DirectoryViewer;
    hub: VisitorsHubSearch;
    labels: Translations["visitorsPage"];
}) {
    const state = await getVisitorTrades(viewer);
    return <VisitorTradesView state={state} labels={labels} type={hub.type} />;
}
