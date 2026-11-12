import type { DirectoryViewer } from "@/server/public-directory";
import {
    getSharedSuccesDungeonBoard,
    listSharedSuccesDungeons,
} from "@/server/public-succes-communs";
import type { VisitorsHubSearch } from "@/lib/visitors-hub";
import type { Translations } from "@/lib/i18n/locales/fr";
import { SharedSuccesView } from "./shared-succes-view";

/**
 * Section serveur des succès en commun : deux lectures **indépendantes** partent ensemble
 * (la liste des donjons et, si un donjon est sélectionné, son tableau). Un refus de la
 * base remonte à l'`error.tsx` du segment — jamais une liste vide trompeuse.
 */
export async function SharedSuccesSection({
    viewer,
    hub,
    labels,
}: {
    viewer: DirectoryViewer;
    hub: VisitorsHubSearch;
    labels: Translations["visitorsPage"];
}) {
    const [dungeons, selected] = await Promise.all([
        listSharedSuccesDungeons(hub.q),
        hub.donjon
            ? getSharedSuccesDungeonBoard(viewer, hub.donjon)
            : Promise.resolve(null),
    ]);

    return (
        <SharedSuccesView
            dungeons={dungeons}
            selected={selected}
            search={hub.q}
            labels={labels}
        />
    );
}
