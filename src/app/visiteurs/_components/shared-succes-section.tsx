import type { DirectoryViewer } from "@/server/public-directory";
import {
    getSharedBountyBoard,
    getSharedSuccesDungeonBoard,
    listSharedSuccesBounties,
    listSharedSuccesDungeons,
} from "@/server/public-succes-communs";
import type { VisitorsHubSearch } from "@/lib/visitors-hub";
import type { Translations } from "@/lib/i18n/locales/fr";
import { SharedSuccesView } from "./shared-succes-view";

/**
 * Section serveur des succès en commun : les listes de donjons et d'avis partent ensemble
 * (la recherche `q` s'applique aux deux) ; seul le tableau de la liste **active** est chargé.
 * Un refus de la base remonte à l'`error.tsx` du segment — jamais une liste vide trompeuse.
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
    const liste = hub.liste ?? "donjons";
    const [dungeons, selected, bounties, selectedBounty] = await Promise.all([
        listSharedSuccesDungeons(hub.q),
        liste === "donjons" && hub.donjon
            ? getSharedSuccesDungeonBoard(viewer, hub.donjon)
            : Promise.resolve(null),
        listSharedSuccesBounties(hub.q),
        liste === "avis" && hub.bounty
            ? getSharedBountyBoard(viewer, hub.bounty)
            : Promise.resolve(null),
    ]);

    return (
        <SharedSuccesView
            dungeons={dungeons}
            selected={selected}
            bounties={bounties}
            selectedBounty={selectedBounty}
            liste={liste}
            search={hub.q}
            labels={labels}
        />
    );
}
