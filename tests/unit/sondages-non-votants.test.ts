import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeNonVoters, pollMemberName, type PollMemberRef } from "@/lib/polls/participation";

/**
 * Sondages — onglet **« N'ont pas voté »** (demande user du 13/10/2026 : « ajoute un détail juste
 * côté dashboard dans le vote, un onglet pour avoir la liste de tous ceux qui n'ont pas voté »)
 * **+ déslop de la fiche** (« deslop » sur la capture de la modale des votants : compteur en
 * pastille `9`, cadre `rounded-2xl`, ombres, `font-black`).
 *
 * 🔍 Mesure avant reprise : la fiche n'exposait que les **votants** (par choix), donc impossible de
 * relancer les absents ; et la modale « Votants pour … » portait un compteur en pastille ronde, un
 * `rounded-2xl` et des ombres — les mêmes marqueurs de slop que le module Songes.
 *
 * 🛡️ Ce que ce test verrouille : ① la règle pure (complément votants/non-votants, tri, cascade
 * d'identité) ; ② le **cloisonnement** (membres ACTIFS de LA guilde, votants `distinct`) et le
 * **refus du sondage anonyme** (la liste révélerait les votants par complément) ; ③ l'onglet câblé
 * sur cette source unique ; ④ l'absence de slop sur la fiche. Lecture seule, aucune base.
 */

const ACTIONS = "src/server/actions/poll-actions.ts";
const DETAIL = "src/components/sondages/poll-detail.tsx";
const CONTRACT = "src/lib/polls/ui.ts";

/** Retire les commentaires : les motifs de slop ne doivent pas se cacher dans la prose. */
const codeOnly = (path: string) =>
    readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const member = (
    id: string,
    pseudoDofus: string | null,
    discordNickname: string | null,
    userName: string | null,
    image: string | null = null
): PollMemberRef => ({ id, pseudoDofus, discordNickname, userName, image });

describe("sondages — règle pure de participation", () => {
    const alice = member("p-alice", "Alice", null, "alice#1", "https://cdn/alice.png");
    const bob = member("p-bob", null, "Bob", "bob#2");
    const zoe = member("p-zoe", null, null, "Zoe");
    const anonymous = member("p-anon", null, null, null);

    it("rend le COMPLÉMENT des votants, jamais un votant", () => {
        expect(computeNonVoters([alice, bob, zoe], [bob.id]).map((m) => m.name)).toEqual(["Alice", "Zoe"]);
    });

    it("absorbe les doublons de votants (choix multiple = plusieurs lignes par votant)", () => {
        expect(computeNonVoters([alice, bob, zoe], [bob.id, bob.id, bob.id]).map((m) => m.id))
            .toEqual([alice.id, zoe.id]);
    });

    it("trie par nom affiché, insensible à la casse (fr)", () => {
        expect(computeNonVoters([zoe, alice, bob], []).map((m) => m.name)).toEqual(["Alice", "Bob", "Zoe"]);
    });

    it("cascade d'identité : pseudo Dofus → pseudo Discord → nom de compte → « Membre »", () => {
        expect(pollMemberName(alice)).toBe("Alice");
        expect(pollMemberName(bob)).toBe("Bob");
        expect(pollMemberName(zoe)).toBe("Zoe");
        expect(pollMemberName(anonymous)).toBe("Membre");
    });

    it("un nom fait d'espaces compte comme absent (jamais un nom vide à l'écran)", () => {
        expect(pollMemberName(member("x", "   ", "Bob", "bob#2"))).toBe("Bob");
        expect(pollMemberName(member("y", null, "  ", "  "))).toBe("Membre");
    });

    it("transporte l'avatar (absent = null) et ignore un votant qui n'est plus membre", () => {
        const nonVoters = computeNonVoters([alice, bob], ["p-parti"]);
        expect(nonVoters).toHaveLength(2);
        expect(nonVoters.find((m) => m.id === alice.id)?.image).toBe("https://cdn/alice.png");
        expect(nonVoters.find((m) => m.id === bob.id)?.image).toBeNull();
    });

    it("ne fabrique rien sans membres", () => {
        expect(computeNonVoters([], ["p-alice"])).toEqual([]);
    });
});


describe("sondages — le serveur publie la liste, jamais sur un anonyme", () => {
    const actions = readFileSync(ACTIONS, "utf8");

    it("consomme la règle pure (une seule cascade, un seul tri)", () => {
        expect(actions).toContain('from "@/lib/polls/participation"');
        expect(actions).toContain("computeNonVoters(");
    });

    it("garde la liste derrière le refus de l'anonymat", () => {
        const guard = actions.indexOf("if (!poll.isAnonymous)");
        const compute = actions.indexOf("computeNonVoters(");
        expect(guard, "garde d'anonymat absente").toBeGreaterThan(-1);
        expect(compute, "calcul des non-votants absent").toBeGreaterThan(guard);
        // Défaut vide : un sondage anonyme ne peut pas publier la liste par accident.
        expect(actions).toContain("let nonVoters: PollMember[] = [];");
    });

    it("cloisonne : membres ACTIFS de LA guilde du sondage, votants distincts", () => {
        expect(actions).toContain('where: { guildId: poll.guildId, status: "ACTIVE" }');
        expect(actions).toContain('distinct: ["voterId"]');
    });

    it("publie la liste et la participation (votants / membres)", () => {
        expect(actions).toMatch(/^\s*nonVoters,$/m);
        expect(actions).toMatch(/^\s*voterCount,$/m);
        expect(actions).toMatch(/^\s*memberCount,$/m);
    });
});

describe("sondages — la fiche porte l'onglet", () => {
    const detail = codeOnly(DETAIL);

    it("n'ouvre l'onglet que sur une liste publiée (jamais sur un anonyme)", () => {
        expect(detail).toContain("const hasParticipationTab = !poll.isAnonymous && Array.isArray(poll.nonVoters);");
        expect(detail).toContain('role="group"');
        expect(detail).toContain("aria-pressed={activeTab ===");
    });

    it("nomme l'onglet et le construit sur le contrat de bascule", () => {
        expect(detail).toContain(`{"N'ont pas voté"}`);
        expect(detail).toContain("POLL_SEGMENT_GROUP");
        expect(detail).toContain("POLL_SEGMENT_ITEM_ACTIVE");
    });

    it("rend les deux listes avec la MÊME ligne de membre", () => {
        // 1× dans la modale « Votants », 1× dans l'onglet des absents.
        expect((detail.match(/<PollMemberRow/g) ?? []).length).toBe(2);
    });

    it("retire mon propre vote du compteur dès que j'ai voté (sans attendre le serveur)", () => {
        expect(detail).toContain("member.id === currentProfileId");
    });

    it("dit la participation réelle (votants distincts / membres) quand elle est connue", () => {
        expect(detail).toContain("${poll.voterCount ?? 0} / ${poll.memberCount ?? 0} membres");
    });
});

describe("déslop des surfaces Sondages — le slop ne revient pas", () => {
    /** Marqueurs mesurés sur la fiche avant reprise (modale des votants comprise). */
    const FORBIDDEN = [
        "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-[",
        "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "drop-shadow",
        "backdrop-blur", "blur-[", "bg-gradient", "from-white",
        "animate-in", "fade-in", "slide-in-from", "zoom-in", "animate-pulse",
        "active:scale", "hover:scale", "scale-110",
        "font-black", "tracking-widest", "text-white", "bg-black",
        "getAvatarColor", "cat.emoji",
    ];

    const PALETTE =
        /(?<![\w-])(?:text|bg|border|divide|ring|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g;

    it("plus une seule classe de slop", () => {
        const code = codeOnly(DETAIL);
        for (const pattern of FORBIDDEN) {
            expect(code, `${DETAIL} contient « ${pattern} »`).not.toContain(pattern);
        }
    });

    it("plus une seule couleur de palette en dur (tout passe par les jetons)", () => {
        const hits = codeOnly(DETAIL).match(PALETTE) ?? [];
        expect(hits, hits.join(", ")).toEqual([]);
    });

    it("les rayons restent courts (≤ 8 px, hors pastille)", () => {
        const radii = new Set(
            Array.from(codeOnly(DETAIL).matchAll(/rounded-([a-z0-9[\]/.-]+)/g)).map((m) => m[1])
        );
        expect([...radii].sort()).toEqual(["full", "lg", "md"]);
    });

    it("le compteur en pastille de la modale est remplacé par un simple libellé", () => {
        const detail = codeOnly(DETAIL);
        expect(detail).not.toContain("Votants pour");
        expect(detail).toContain("Votants — {option.label}");
    });

    it("la fiche ne porte plus la coquille d'infobulle vide (les tooltips sont partis)", () => {
        expect(codeOnly(DETAIL)).not.toContain("TooltipProvider");
    });

    it("le contrat de bascule reste sobre : un seul accent, rayons courts", () => {
        // Commentaires retirés : la prose du contrat cite justement le slop qu'elle remplace.
        const contract = codeOnly(CONTRACT);
        expect(contract).toContain("POLL_SEGMENT_GROUP");
        expect(contract).toContain("POLL_SEGMENT_ITEM_IDLE");
        expect(contract).toContain("POLL_MEMBER_ROW");
        expect(contract).not.toMatch(/rounded-(xl|2xl|3xl)/);
        expect(contract).not.toContain("font-black");
        expect(contract).not.toContain("shadow-");
    });

    it("la liste et les archives suivent le MÊME contrat (liste + /sondages/archives)", () => {
        const LIST = "src/components/sondages/poll-list.tsx";
        const list = codeOnly(LIST);
        for (const pattern of FORBIDDEN) {
            expect(list, `${LIST} contient « ${pattern} »`).not.toContain(pattern);
        }
        const hits = list.match(PALETTE) ?? [];
        expect(hits, hits.join(", ")).toEqual([]);

        // Rayons ≤ 8 px (les pastilles restent rondes).
        const radii = new Set(Array.from(list.matchAll(/rounded-([a-z0-9[\]/.-]+)/g)).map((m) => m[1]));
        expect([...radii].sort()).toEqual(["full", "lg"]);

        // Plus un seul compteur maison pour la fin d'un vote : la règle unique
        // (`formatPollEnd`) vit dans la carte **et** la fiche — la liste n'en a pas de copie.
        expect(list).not.toContain("RemainingTime");
        expect(list).not.toContain("formatDistanceToNow");
        expect(list).not.toContain("framer-motion");

        // Les catégories du filtre viennent de la source PARTAGÉE des tuiles, et
        // aucun libellé structurant ne porte d'emoji.
        expect(list).toContain("POLL_CATEGORY_OPTIONS");
        expect(list).not.toContain("emoji");
    });
});
