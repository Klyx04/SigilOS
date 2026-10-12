/**
 * Gardes — **« Mode Construction » du guide Rush Sylvestre** (toggle God → page PUBLIQUE).
 *
 * 🎯 Demande user (22/09/2026, verbatim) : « je veux maintenant un toggle côté rush sylvestre god
 * pour mettre "en construction arrivée du guide dans les jours qui suivent !" pour le guide
 * sylvestre public ».
 *
 * 🔍 Ce qui existait déjà (aucun doublon créé) : le toggle « Mode Construction » de
 * `/god/rush-sylvestre` écrivait bien `OptimizedGuide.isUnderConstruction`, mais **seule la vue
 * MEMBRES** le lisait (`RushTimelineClient`, `DofusQuestHub`) ⇒ la page **publique**
 * `/guides/rush-sylvestre` servait le guide interactif complet quelle que soit la valeur, et l'avis
 * d'arrivée était impossible à poser.
 *
 * 🛡️ Ce que ce test verrouille : ① une seule source de vérité (le champ existant, aucun second
 * drapeau) ; ② la page publique lit l'état et sert l'avis **au lieu** du guide interactif ; ③ le
 * toggle God invalide la route publique (ISR 1 h ⇒ sinon jusqu'à une heure de retard) ; ④ pas de
 * `HowTo` schema.org ni de promesse de contenu sur une page de chantier ; ⑤ libellés FR **et** EN.
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
const FR = codeOf("src/lib/i18n/locales/fr.ts");
const EN = codeOf("src/lib/i18n/locales/en.ts");

describe("toggle God « Mode Construction » → page publique Sylvestre", () => {
    it("une seule source de vérité : le champ qui existait déjà (aucun second drapeau)", () => {
        // Le toggle God écrit `isUnderConstruction` (champ unique du guide)…
        expect(GOD_CLIENT).toMatch(/handleToggle\("isUnderConstruction"\)/);
        expect(ACTIONS).toMatch(/export async function updateRushSylvestreSettings\(data: \{/);
        expect(ACTIONS).toMatch(/isUnderConstruction\?: boolean;/);
        // …et la page publique lit CE champ, jamais un drapeau parallèle.
        expect(PAGE).toMatch(/const isUnderConstruction = !!guide\.isUnderConstruction;/);
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
        expect(GOD_CLIENT).toMatch(/page publique \/guides\/rush-sylvestre/);
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
