/**
 * Garde de câblage (lecture source) — **refonte produit de la télémétrie God** (D-2bis).
 *
 * Régression d'origine : `OverviewTabs` recevait `stats`/`chart` **sans jamais les rendre**
 * (chantier D-2). Ici on verrouille la même classe de bug sur la refonte produit :
 * ① les cartes « console » ne peuvent pas revenir (pages vues, DAU/WAU, événements totaux) ;
 * ② chaque panneau produit est **rendu** par l'onglet qui le porte ;
 * ③ chaque champ d'une ligne d'adoption est **affiché** (une donnée reçue et jamais montrée
 *    est un mensonge silencieux) ;
 * ④ les libellés de modules viennent de `src/lib/module-catalog.ts` (source unique).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const DASHBOARD = "src/app/god/components/telemetry-dashboard.tsx";
const OVERVIEW = "src/components/telemetry/telemetry-product-overview.tsx";
const ADOPTION = "src/components/telemetry/telemetry-adoption-panel.tsx";
const RETENTION = "src/components/telemetry/telemetry-retention-panel.tsx";
const PUBLIC_PANEL = "src/components/telemetry/telemetry-public-panel.tsx";
const PUBLIC_BEACON = "src/components/telemetry/public-view-beacon.tsx";
const PUBLIC_ACTION = "src/server/actions/telemetry-public-actions.ts";
const LAYOUT = "src/app/layout.tsx";
const SAMPLE = "src/components/telemetry/telemetry-sample-note.tsx";
const PAGE = "src/app/god/page.tsx";
const CATALOG = "src/lib/module-catalog.ts";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const dashboard = codeOnly(readFileSync(DASHBOARD, "utf8"));
const overview = codeOnly(readFileSync(OVERVIEW, "utf8"));
const adoption = codeOnly(readFileSync(ADOPTION, "utf8"));
const retention = codeOnly(readFileSync(RETENTION, "utf8"));
const publicPanel = codeOnly(readFileSync(PUBLIC_PANEL, "utf8"));
const publicBeacon = codeOnly(readFileSync(PUBLIC_BEACON, "utf8"));
const publicAction = codeOnly(readFileSync(PUBLIC_ACTION, "utf8"));
const layout = codeOnly(readFileSync(LAYOUT, "utf8"));
const sample = codeOnly(readFileSync(SAMPLE, "utf8"));
const page = codeOnly(readFileSync(PAGE, "utf8"));
const catalog = codeOnly(readFileSync(CATALOG, "utf8"));

describe("télémétrie God — les cartes « console » ne reviennent pas", () => {
    it("n'affiche plus les compteurs de navigation en tête d'écran", () => {
        for (const legacy of ["Pages Vues (24h)", "Interactions (24h)", "DAU / WAU", "Événements totaux", "Consommation Modules"]) {
            expect(dashboard, `la carte « ${legacy} » est revenue dans l'écran God`).not.toContain(legacy);
        }
    });

    it("rend les panneaux produit, avec les mesures chargées par la page", () => {
        expect(dashboard).toContain("<TelemetryProductOverview product={initialProduct} />");
        expect(dashboard).toContain("<TelemetryAdoptionPanel product={initialProduct} />");
        expect(dashboard).toContain("initialProduct");
        expect(page, "`god/page.tsx` ne charge plus les mesures produit").toContain("getProductStats()");
        expect(page, "`god/page.tsx` ne passe plus les mesures produit à l'écran").toContain(
            "initialProduct={product}"
        );
    });

    it("porte les onglets produit dans la barre d'onglets", () => {
        expect(dashboard).toContain('id: "adoption"');
        expect(dashboard).toContain('id: "retention"');
        expect(dashboard).not.toContain('id: "modules"');
    });

    it("a retiré les trois onglets « console » et leur moteur de rendu", () => {
        for (const gone of ['id: "analytics"', 'id: "guilds"', 'id: "users"']) {
            expect(dashboard, `l'onglet ${gone} est revenu`).not.toContain(gone);
        }
        // La heatmap de clics et son graphe horaire tiraient `recharts` : plus aucun import.
        expect(dashboard).not.toContain("recharts");
        // Les classements nominatifs par membre (artefact d'échantillon) sont partis aussi.
        for (const gone of ["stats.topUsers", "stats.usersLastSeen", "stats.guildHealthList", "stats.heatmapData"]) {
            expect(dashboard, `${gone} est encore rendu`).not.toContain(gone);
        }
        expect(dashboard).toContain("<TelemetryRetentionPanel product={initialProduct} />");
    });
});

describe("panneau d'adoption — chaque mesure reçue est affichée", () => {
    it("affiche les quatre nombres d'une ligne de module", () => {
        expect(adoption).toMatch(/module\.enabledGuilds/);
        expect(adoption).toMatch(/module\.usedGuilds/);
        expect(adoption).toMatch(/module\.idleGuilds/);
        expect(adoption).toMatch(/module\.adoptionRate/);
    });

    it("affiche à part les modules sans mesure d'usage", () => {
        expect(adoption).toMatch(/adoption\.unmeasured/);
        expect(adoption).toContain("Modules sans mesure d&apos;usage");
    });

    it("nomme les modules par le catalogue, jamais par une liste locale", () => {
        expect(catalog).toContain("export function moduleLabel(");
        expect(adoption).toContain('from "@/lib/module-catalog"');
        expect(overview).toContain('from "@/lib/module-catalog"');
        for (const file of [adoption, overview]) {
            expect(file, "un libellé de module a été recopié dans un composant").not.toMatch(
                /MODULE_LABELS|MODULE_GROUPS\s*\.\s*flatMap/
            );
        }
    });

    it("n'annonce pas « inutilisé » un module non mesuré", () => {
        expect(adoption).toContain("inutilisés serait une affirmation");
    });
});

describe("bandeau d'échantillon — un seul composant pour tout le module", () => {
    it("est partagé, jamais recopié", () => {
        expect(sample).toContain("export function TelemetrySampleNote(");
        expect(overview).toContain("<TelemetrySampleNote");
        expect(adoption).toContain("<TelemetrySampleNote");
        // Le bandeau ne doit exister qu'une fois : une copie locale réintroduirait le bug muet.
        const localCopies = [overview, adoption].filter((file) => /function SampleStrip\(/.test(file));
        expect(localCopies).toEqual([]);
    });

    it("dit si le classement nominatif est publiable et si la lecture a été plafonnée", () => {
        expect(sample).toMatch(/sample\.reliable/);
        expect(sample).toMatch(/truncated/);
        expect(sample).toMatch(/seuil 15/);
    });
});

describe("site public — la partie externe reste anonyme", () => {
    it("porte l'onglet et la donnée chargée par la page", () => {
        expect(dashboard).toContain('id: "public"');
        expect(dashboard).toContain("<TelemetryPublicPanel stats={initialPublic} />");
        expect(dashboard).toContain("initialPublic");
        expect(page).toContain("getPublicStats()");
        expect(page).toContain("initialPublic={publicStats}");
    });

    it("monte la balise dans le layout racine, gardée par l'allowlist", () => {
        expect(layout).toContain("<PublicViewBeacon />");
        expect(publicBeacon).toContain("publicScreenKey(pathname)");
    });

    it("n'envoie aucune identité depuis le navigateur", () => {
        for (const forbidden of ["localStorage", "sessionStorage", "document.cookie", "userAgent", "navigator."]) {
            expect(publicBeacon, `la balise utilise ${forbidden}`).not.toContain(forbidden);
        }
    });

    it("compte un agrégat par jour, jamais une ligne par visite", () => {
        expect(publicAction).toContain("publicScreenKey");
        expect(publicAction).toContain("isLikelyBot");
        expect(publicAction).toContain("publicCounterKey");
        expect(publicAction).toMatch(/redis\.incr\(/);
        expect(publicAction).toMatch(/redis\.mget\(/);
        // Ni `KEYS` (interdit en production), ni une clé par visite.
        expect(publicAction).not.toMatch(/redis\.keys\(/);
    });

    it("ne joint JAMAIS les compteurs publics au monde identifié", () => {
        for (const forbidden of ["telemetryEvent", "TelemetryEvent", "logTelemetryEvent"]) {
            expect(publicAction, `jointure interdite : ${forbidden}`).not.toContain(forbidden);
        }
        expect(publicPanel).toContain("deux mondes séparés");
    });

    it("annonce ce qu'il ne peut pas mesurer au lieu de le sous-entendre", () => {
        for (const honest of ["visiteurs uniques", "sessions", "provenance", "requêtes"]) {
            expect(publicPanel, `l'écran ne dit pas « ${honest} »`).toContain(honest);
        }
    });

    it("affiche la rétention des cohortes et les relances dans son onglet", () => {
        expect(dashboard).toContain("<TelemetryRetentionPanel product={initialProduct} />");
        expect(retention).toMatch(/minCohortSize/);
        expect(retention).toMatch(/point\.rate === null/);
        expect(retention).toMatch(/guild\.status !== "ACTIVE"/);
    });
});
