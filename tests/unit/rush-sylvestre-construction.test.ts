/**
 * Gardes — **les deux « En construction » du guide Rush Sylvestre** (membres ⇄ page publique).
 *
 * 🎯 Demande user (29/10/2026, verbatim) : « je veux ca » — *construction en interne, guide visible
 * en public*. Le 22/09/2026, le même drapeau `OptimizedGuide.isUnderConstruction` pilotait la vue
 * MEMBRES et la page PUBLIQUE : impossible d'ouvrir le guide au public en laissant l'espace membres
 * en chantier. Décision produit : **deux drapeaux**, une surface chacun.
 *
 * 🛡️ Ce que ce test verrouille : ① `isUnderConstruction` (membres) et `isPublicUnderConstruction`
 * (page publique + sitemap) sont **indépendants**, et aucune surface ne lit celui de l'autre ;
 * ② la page publique naît « en construction » (`@default(true)`) : aucun déploiement ne l'ouvre par
 * surprise ; ③ la page publique sert l'avis **au lieu** du guide quand son drapeau est actif, et le
 * toggle God invalide la route (ISR 1 h) ; ④ pas de `HowTo` ni de promesse de contenu sur une page
 * de chantier ; ⑤ libellés FR **et** EN ; ⑥ la fondation du bloc B (slug figé + publication
 * opt-in) est en base et la migration est additive.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Retire les commentaires : on verrouille le code, pas la prose. */
const codeOf = (p: string) =>
    readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const PAGE = codeOf("src/app/guides/rush-sylvestre/page.tsx");
const GOD_PAGE = codeOf("src/app/god/rush-sylvestre/page.tsx");
const GOD_CLIENT = codeOf("src/app/god/rush-sylvestre/RushSylvestreAdminClient.tsx");
const ACTIONS = codeOf("src/server/actions/optimized-guide-actions.ts");
/** Surfaces MEMBRES : elles lisent le drapeau interne, jamais celui de la page publique. */
const RUSH_TIMELINE = codeOf("src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx");
const QUEST_HUB = codeOf("src/components/dofus-quests/DofusQuestHub.tsx");
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

describe("toggle God « Mode Construction » → page publique Sylvestre", () => {
    it("deux surfaces, deux drapeaux : l'espace membres et la page publique sont indépendants", () => {
        // Le studio écrit les DEUX champs (un toggle chacun)…
        expect(GOD_CLIENT).toMatch(/handleToggle\("isUnderConstruction"\)/);
        expect(GOD_CLIENT).toMatch(/handleToggle\("isPublicUnderConstruction"\)/);
        expect(ACTIONS).toMatch(/export async function updateRushSylvestreSettings\(data: \{/);
        expect(ACTIONS).toMatch(/isUnderConstruction\?: boolean;/);
        expect(ACTIONS).toMatch(/isPublicUnderConstruction\?: boolean;/);
        // …la page PUBLIQUE lit le drapeau public, jamais l'avis des membres…
        expect(PAGE).toMatch(/const isUnderConstruction = !!guide\.isPublicUnderConstruction;/);
        expect(PAGE).not.toMatch(/guide\.isUnderConstruction;/);
        // …et les surfaces MEMBRES gardent le leur, sans jamais lire le drapeau public.
        expect(RUSH_TIMELINE).toMatch(/guide\.isUnderConstruction/);
        expect(RUSH_TIMELINE).not.toMatch(/isPublicUnderConstruction/);
        expect(QUEST_HUB).toMatch(/rushSylvestreGuide\?\.isUnderConstruction/);
        expect(QUEST_HUB).not.toMatch(/isPublicUnderConstruction/);
    });

    it("la page publique sert l'avis d'arrivée au lieu du guide interactif", () => {
        expect(PAGE).toMatch(/\{isUnderConstruction \? \(/);
        expect(PAGE).toMatch(/<PublicRushGuideClient guide=\{guide\} milestones=\{milestones\} \/>/);
        expect(PAGE).toMatch(/t\.rushGuide\.underConstructionTitle/);
        expect(PAGE).toMatch(/t\.rushGuide\.underConstructionHint/);
        // Promesses de contenu (chips « ~370 étapes ») et FAQ masquées : on n'annonce que le dispo.
        expect(PAGE).toMatch(/\{!isUnderConstruction && \(/);
        // Lecture unique du guide par requête (métadonnées + page).
        expect(PAGE).toMatch(/const getRushGuide = cache\(\(\) => getPublicGuideDetail\("rush-sylvestre"\)\);/);
    });

    it("pas de `HowTo` schema.org ni d'indexation incohérente sur une page de chantier", () => {
        expect(PAGE).toMatch(
            /robots: underConstruction \? \{ index: false, follow: true \} : \{ index: true, follow: true \},/
        );
        expect(PAGE).toMatch(/\.\.\.\(isUnderConstruction\s*\?\s*\[\]\s*:\s*\[/);
        expect(PAGE).toMatch(/"@type": "HowTo"/);
        // Le BreadcrumbList reste (maillage interne) : il est HORS du bloc conditionnel.
        expect(PAGE).toMatch(/"@type": "BreadcrumbList"/);
    });

    it("le toggle God invalide la route publique, sans attendre l'ISR d'une heure", () => {
        const fn = ACTIONS.slice(
            ACTIONS.indexOf("export async function updateRushSylvestreSettings("),
            ACTIONS.indexOf("export async function updateRushUIConfig(")
        );
        expect(fn.length).toBeGreaterThan(0);
        expect(fn).toMatch(/revalidatePath\("\/guides\/rush-sylvestre"\);/);
        // Garde d'accès conservée (écriture God).
        expect(fn).toMatch(/requireRushAccess\(\)/);
    });

    it("le God sait où regarder : lien public, état courant, description du toggle", () => {
        expect(GOD_CLIENT).toMatch(/URL publique :/);
        expect(GOD_CLIENT).toMatch(/href="\/guides\/rush-sylvestre"/);
        expect(GOD_CLIENT).toMatch(/En construction — page publique/);
        // L'indicateur d'état lit le drapeau public (jamais celui de l'espace membres).
        expect(GOD_CLIENT).toMatch(/\{isPublicUnderConstruction \? " · en construction" : " · publiée"\}/);
        // Garde d'accès de la page God (super-admin OU brique game-data-rush).
        expect(GOD_PAGE).toMatch(/canAccessBrick\("game-data-rush"\)/);
        expect(GOD_PAGE).toMatch(/if \(!isGod\) redirect\("\/dashboard"\);/);
    });

    it("les libellés existent en FR ET en EN, avec le message demandé", () => {
        for (const locale of [FR, EN]) {
            expect(locale).toMatch(/underConstructionTitle: "/);
            expect(locale).toMatch(/underConstructionHint: "/);
        }
        // Message exact demandé (l'apostrophe est testée en `.` : droite ou typographique).
        expect(FR).toMatch(/underConstructionHint: "L.arrivée du guide est prévue dans les jours qui suivent !"/);
    });
});

describe("schéma — public fermé au déploiement, et fondation du bloc B", () => {
    const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
    const MIGRATION = readFileSync(
        "prisma/migrations/20270121000000_rush_construction_publique/migration.sql",
        "utf8"
    );

    it("la page publique naît « en construction » : aucun déploiement ne l'ouvre par surprise", () => {
        expect(SCHEMA).toMatch(/isPublicUnderConstruction Boolean\s+@default\(true\)/);
        expect(MIGRATION).toMatch(/"isPublicUnderConstruction" BOOLEAN NOT NULL DEFAULT true/);
    });

    it("le drapeau interne garde son défaut d'origine (aucune régression membres)", () => {
        expect(SCHEMA).toMatch(/isUnderConstruction Boolean\s+@default\(false\)/);
    });

    it("bloc B : slug FIGÉ par quête et publication opt-in", () => {
        // Le slug est stocké (jamais recalculé depuis le nom) ⇒ un renommage ne casse aucune URL.
        expect(SCHEMA).toMatch(/publicSlug\s+String\?\s+@unique/);
        // Une quête ajoutée dans le studio ne crée aucune page tant qu'elle n'est pas publiée.
        expect(SCHEMA).toMatch(/isPublished Boolean\s+@default\(false\)/);
        expect(MIGRATION).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "GuideSequence_publicSlug_key"/);
    });

    it("la migration est additive et rejouable (aucun DROP, aucune suppression de donnée)", () => {
        expect(MIGRATION).not.toMatch(/\bDROP\b/i);
        expect(MIGRATION).not.toMatch(/\bDELETE\b/i);
        expect((MIGRATION.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length).toBe(3);
    });
});

describe("largeur des blocs d'étapes = largeur du bloc chapitre", () => {
    /** Version BRUTE (commentaires conservés) : la mesure doit rester citée dans le code. */
    const GUIDE_RAW = readFileSync("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx", "utf8");
    const GUIDE = codeOf("src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx");

    it("le conteneur des étapes n'ajoute plus de retrait horizontal (`p-4 sm:p-6`)", () => {
        // 📐 Mesure navigateur (22/09/2026, 1440 px) : panneau chapitre `reg-panel-strong` =
        // **776 px** (left 160 → right 936) alors que les blocs d'étapes imbriqués, posés dans ce
        // conteneur `p-4 sm:p-6`, faisaient 24 px de moins de chaque côté (left 184 → right 912) —
        // c'est ce décalage que le user voyait (« la même largeur que les blocs eux-mêmes »).
        // Après correctif, mesuré à nouveau : chapitre 160→936 (776 px) **et** blocs d'étapes
        // 160→936 (776 px) ⇒ identiques.
        expect(GUIDE_RAW).toMatch(/retour user : « je veux la même largeur pour les quêtes déroulées/);
        expect(GUIDE).toMatch(/<div className="py-4 sm:py-5 space-y-5">/);
        expect(GUIDE).not.toMatch(/<div className="p-4 sm:p-6 space-y-5">/);
    });
});
