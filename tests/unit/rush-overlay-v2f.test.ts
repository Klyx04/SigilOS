/**
 * Overlay — finitions **V2f** (F8 → F11), brief du 08/11/2026.
 *
 * Quatre demandes du mainteneur, et pour chacune ce que la mesure avait établi :
 *
 *  • **F8** — « Rush Sylvestre » et « Graine » sont redondants. Mesuré : « Graine »
 *    n'était pas un libellé écrit dans le bandeau, c'était le **palier 0** de
 *    `rush-dofus-stage` affiché par la frise ; le titre venait de `guideName`.
 *    Les deux partent, le `h1` reste masqué (un en-tête sans titre n'en est plus un).
 *  • **F9** — le « rappel » sous Toutes / En cours / Faites / Verrouillées est
 *    `.da-banner` : il redisait le titre du chapitre (dock) et son avancement
 *    (dock + jauge). La description du bloc, elle, reste — c'est la seule à dire
 *    ce que le chapitre regroupe.
 *  • **F10** — le thème vivait dans `localStorage`, lu dans un `useEffect` : un
 *    premier cadre sombre était peint avant la bascule. Un *layout effect* corrige ça.
 *  • **F11** — le panneau était monté **dans** `<header class="da-hero">`
 *    (`position: relative; overflow: hidden`) : il passait sous le contenu quel que
 *    soit son `z-index`. Il est monté par l'hôte, en fin de racine, et porte le lien
 *    du Discord support.
 *
 * Lecture seule : aucun rendu navigateur, aucune base.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const HEADER = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayHeader.tsx";
const SHELL = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const PANEL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayFeedbackPanel.tsx";
const PUBLIC_GUIDE = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const STAGE_MODULE = "src/lib/rush-dofus-stage.ts";
const STAGE_TEST = "tests/unit/rush-dofus-stage.test.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("F8 — le bandeau ne répète plus ni le nom du guide ni « Graine »", () => {
    it("le titre visible et la frise de stades ont quitté l'en-tête", () => {
        const header = read(HEADER);
        expect(header).not.toMatch(/className="da-logo"/);
        expect(header).not.toMatch(/da-stage|da-pips/);
        // ... mais l'en-tête garde un titre pour les lecteurs d'écran.
        expect(header).toMatch(/<h1 className="sr-only">\{guideName\}<\/h1>/);
    });

    it("la règle de stade n'est pas laissée en code mort", () => {
        // Décision produit : la frise disparaît. Le module n'avait plus aucun
        // consommateur — le garder avec son test aurait été du code mort verdi.
        expect(existsSync(STAGE_MODULE)).toBe(false);
        expect(existsSync(STAGE_TEST)).toBe(false);
    });
});

describe("F9 — le rappel sous les filtres est retiré, la description reste", () => {
    it("le shell ne monte plus de bandeau de bloc", () => {
        const shell = read(SHELL);
        expect(shell).not.toMatch(/da-banner/);
        expect(shell).not.toMatch(/currentMsDoneCount/);
        expect(shell).not.toMatch(/bannerArt/);
    });

    it("la description du bloc, elle, est conservée", () => {
        expect(read(SHELL)).toMatch(/className="da-blockdesc"/);
    });
});

describe("F4 — la rangée de filtres est centrée et aérée", () => {
    it("quatre onglets au centre, avec de l'air autour", () => {
        // Retour user (08/11/2026) : « aère le bloc de 4 onglets, centre et aère par
        // rapport au reste ». La rangée était collée au dock, alignée à gauche, en
        // bande scrollable (`overflow-x: auto`) que la PiP coupait.
        const css = read("src/app/da-wakfu.css");
        const filters = css.match(/\.da-filters\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(filters, "règle `.da-filters` absente").not.toBe("");
        expect(filters).toMatch(/justify-content:\s*center/);
        expect(filters).toMatch(/margin:/);
        expect(filters).toMatch(/gap:/);
        // Plus de bande scrollable : quatre libellés courts passent à la ligne.
        expect(filters).toMatch(/flex-wrap:\s*wrap/);
        expect(filters).not.toMatch(/overflow-x:\s*auto/);
    });
});

describe("F10 — le thème clair est posé avant la peinture", () => {
    it("la lecture de `localStorage` passe par un layout effect", () => {
        const shell = read(SHELL);
        expect(shell).toMatch(/const useIsomorphicLayoutEffect\s*=/);
        expect(shell).toMatch(/useIsomorphicLayoutEffect\(\(\) => \{[\s\S]{0,200}sigil_overlay_theme/);
    });
});

describe("F11 — la fenêtre de retour passe devant et mène au support", () => {
    it("le panneau est monté par l'hôte, plus dans l'en-tête", () => {
        expect(read(HEADER)).not.toMatch(/RushOverlayFeedbackPanel/);
        expect(read(SHELL)).toMatch(/<RushOverlayFeedbackPanel/);
    });

    it("l'en-tête ouvre le panneau par un callback, sans état local", () => {
        const header = read(HEADER);
        expect(header).toMatch(/onOpenFeedback\?: \(\) => void/);
        expect(header).not.toMatch(/feedbackOpen/);
    });

    it("la fenêtre de retour s'ouvre pour TOUT LE MONDE, invité compris", () => {
        // Retour user (08/11/2026) : en invité, le bouton affichait un toast avec l'URL
        // brute du Discord et plus aucune option. La modale est la seule porte : elle
        // porte les catégories (membre) et le lien + la consigne captures (invité).
        const shell = read(SHELL);
        expect(shell).toMatch(/\{feedbackOpen && \(/);
        expect(shell).not.toMatch(/feedbackOpen && !isGuest/);
        expect(shell).toMatch(/<RushOverlayFeedbackPanel/);
        expect(shell).toMatch(/isGuest=\{isGuest\}/);
        // L'en-tête n'affiche plus l'URL en clair dans un toast.
        expect(read(HEADER)).not.toMatch(/DISCORD_INVITE_URL|NEXT_PUBLIC_DISCORD_INVITE_URL/);
    });

    it("le menu « ⋯ » passe devant le dock (contextes d'empilement)", () => {
        // Retour user (08/11/2026) : le menu s'ouvrait DERRIÈRE le contenu. Deux causes
        // mesurées, deux corrections distinctes :
        //  ① `.da-hero { overflow: hidden }` rognait son panneau `absolute top-full` ;
        //  ② `.da-hero > *:not(.da-hero-img)` plafonne ses enfants à `z-index: 2`,
        //     alors que `.da-dock` est `sticky` à `z-index: 30` ⇒ le menu, enfermé
        //     dans le contexte du header, passait SOUS le dock.
        const css = read("src/app/da-wakfu.css");
        const hero = css.match(/\.da-hero\s*\{([^}]*)\}/)?.[1] ?? "";
        const dock = css.match(/\.da-dock\s*\{([^}]*)\}/)?.[1] ?? "";
        expect(hero, "règle `.da-hero` absente").not.toBe("");
        expect(dock, "règle `.da-dock` absente").not.toBe("");
        expect(hero).not.toMatch(/overflow:\s*hidden/);
        // La vraie déclaration est la DERNIÈRE du bloc : un commentaire peut citer
        // un z-index sans que ce soit une règle.
        const zOf = (block: string) =>
            Number([...block.matchAll(/z-index:\s*(\d+)/g)].at(-1)?.[1] ?? "0");
        expect(zOf(hero), "le header doit dépasser le dock").toBeGreaterThan(zOf(dock));
        // Le menu est bien un panneau déclenché par le bouton « ⋯ ».
        expect(read(HEADER)).toMatch(/top-full right-0 mt-1 z-50/);
    });

    it("en visiteur non connecté, la modale ne porte QUE le Discord", () => {
        const panel = read(PANEL);
        expect(panel).toMatch(/Rejoindre le Discord Sigilos/);
        // Une capture ne passe pas par le formulaire : elle demande un post.
        expect(panel).toMatch(/ouvre un post dans le canal associé/);
        // Décision du 08/11/2026 : le visiteur non connecté ne voit que la modale
        // qui mène au Discord. Le formulaire est derrière `!onlyDiscord`
        // (`submitQuestFeedbackAction` exige une session), et le pied n'a qu'un bouton.
        expect(panel).toMatch(/onlyDiscord\?: boolean/);
        expect(panel).toMatch(/\{onlyDiscord \? null : \(/);
        expect(panel).toMatch(/Pour signaler un bug, ouvre un post dans le canal associé/);
        expect(panel).toMatch(/Fermer/);
    });

    it("un membre connecté garde le formulaire, même sur l'overlay du guide public", () => {
        // `isGuest` est codé en dur à `true` par le guide public : il ne dit rien de la
        // session. Le panneau reçoit donc `onlyDiscord = isGuest && !feedbackSignedIn`,
        // et le guide public transmet `!!visitor`.
        expect(read(SHELL)).toMatch(/onlyDiscord=\{isGuest && !feedbackSignedIn\}/);
        expect(read(SHELL)).toMatch(/feedbackSignedIn\?: boolean/);
        expect(read(PUBLIC_GUIDE)).toMatch(/feedbackSignedIn=\{!!visitor\}/);
    });
});

/**
 * Demande du 08/11/2026 — « ajouter en public connecté dans l'overlay le bouton Metamob et sa
 * gestion, iso interne ».
 *
 * L'overlay avait déjà une entrée Ocre/Metamob, mais `ocreEnabled` la coupe dès qu'on est sur la
 * surface publique (`isGuest`, ou `guildId === "public"`) : un membre connecté n'avait donc aucun
 * accès Metamob dans l'overlay. L'entrée ajoutée est **distincte** de l'Ocre — elle ne prétend
 * pas montrer une progression Ocre qui n'existe pas sans guilde.
 */
describe("Metamob dans l'overlay public connecté", () => {
    it("le bouton n'est rendu que sur la surface publique CONNECTÉE", () => {
        const shell = read(SHELL);

        // La condition est celle de F11 : `isGuest` dit la surface, `feedbackSignedIn` la session.
        expect(shell).toMatch(/onOpenMetamob=\{\s*isGuest && feedbackSignedIn/);
        expect(shell).toMatch(/metamobPseudo\?: string \| null/);
    });

    it("la modale est montée dans la racine de l'overlay (donc en PiP aussi)", () => {
        const shell = read(SHELL);

        // Même emplacement que le panneau de retour : dernier enfant de la racine `data-theme`.
        expect(shell).toMatch(/<PublicMetamobModal[\s\S]{0,220}metamobPseudo=\{metamobPseudo \?\? null\}/);
        expect(shell.indexOf("<PublicMetamobModal")).toBeGreaterThan(shell.indexOf("{feedbackOpen && ("));
    });

    it("l'en-tête rend une entrée Metamob distincte de l'entrée Ocre", () => {
        const header = read(HEADER);

        expect(header).toMatch(/\{onOpenMetamob && \(/);
        expect(header).toMatch(/aria-label=\{metamobVerified \?/);
        // Les deux entrées coexistent : l'une n'est pas le renommage de l'autre.
        expect(header).toMatch(/\{onOpenOcre && \(/);
    });
});