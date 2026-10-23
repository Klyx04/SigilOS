/**
 * Dungeon Finder — normalisation multi-donjons (#26).
 *
 * Régression verrouillée : `dungeonsJson` n'est PAS toujours un tableau.
 * Les sauvegardes/rappels Discord l'écrivent sous forme d'enveloppe
 * (`{ _items: [...], _autoReminderCount: n }`) ou de chaîne JSON.
 * L'ancien code lisait `(post.dungeonsJson as any[]).length` → `undefined`,
 * d'où les titres « Multi-donjons — undefined » et les images manquantes.
 */

import { describe, it, expect } from "vitest";

import {
    getDjCreatorClass,
    withDjCreatorClass,
    isDjDungeonClosed,
    openDjDungeonIndexes,
    areAllDjDungeonsClosed,
    withDjDungeonsClosed,
    withDjDungeonReminder,
    getMultiDungeons,
    getDjPostTitle,
    getDjPostSubtitle,
    getDjDateParts,
    hasExplicitTime,
    formatDjDateLabel,
    formatDiscordDateStamp,
    mergeMultiDungeonTargetDates,
    mergeMultiDungeonRequiredClasses,
    achievementLines,
    embedCoverUrl,
    getDjDungeonStats,
    summarizeDjDungeons,
    getMultiMessageIds,
    withMultiMessageIds,
    QUEST_ICON_FALLBACK,
    questStartMapId,
    questMapImageUrl,
    questThumbnail,
} from "@/lib/dungeon-finder-utils";
import { toLocalDateTimeInput } from "@/lib/date-utils";

const dj = (name: string, level: number) => ({
    dungeonId: `id-${name}`,
    name,
    bossName: `Boss ${name}`,
    level,
    imageUrl: `/img/${name}.png`,
});

describe("getMultiDungeons", () => {
    it("valeurs vides → tableau vide", () => {
        expect(getMultiDungeons(null)).toEqual([]);
        expect(getMultiDungeons(undefined)).toEqual([]);
        expect(getMultiDungeons([])).toEqual([]);
        expect(getMultiDungeons("")).toEqual([]);
        expect(getMultiDungeons(42)).toEqual([]);
    });

    it("tableau direct (cas normal du client)", () => {
        const list = [dj("Kraken", 100), dj("Minotoror", 120)];
        expect(getMultiDungeons(list)).toHaveLength(2);
        expect(getMultiDungeons(list)[0].name).toBe("Kraken");
    });

    it("enveloppe de sauvegarde { _items: [...] } (cause du bug)", () => {
        const envelope = { _items: [dj("Kraken", 100), dj("Minotoror", 120)], _autoReminderCount: 2 };
        const out = getMultiDungeons(envelope);
        expect(out).toHaveLength(2);
        expect(out.map((d) => d.name)).toEqual(["Kraken", "Minotoror"]);
    });

    it("accepte aussi { items } et { posts }", () => {
        expect(getMultiDungeons({ items: [dj("A", 1)] })).toHaveLength(1);
        expect(getMultiDungeons({ posts: [dj("A", 1), dj("B", 2)] })).toHaveLength(2);
    });

    it("chaîne JSON : tableau ou enveloppe", () => {
        expect(getMultiDungeons(JSON.stringify([dj("A", 1)]))).toHaveLength(1);
        expect(getMultiDungeons(JSON.stringify({ _items: [dj("A", 1)] }))).toHaveLength(1);
    });

    it("chaîne invalide ou objet sans liste → tableau vide (jamais de throw)", () => {
        expect(getMultiDungeons("{oops")).toEqual([]);
        expect(getMultiDungeons({ foo: "bar" })).toEqual([]);
    });
});

describe("getDjPostTitle", () => {
    it("1 ou 2 donjons → noms joints, jamais 'undefined'", () => {
        expect(getDjPostTitle({ dungeonsJson: [dj("Kraken", 100)] })).toBe("Kraken");
        expect(getDjPostTitle({ dungeonsJson: [dj("Kraken", 100), dj("Minotoror", 120)] })).toBe("Kraken + Minotoror");
    });

    it("3 donjons et plus → compteur (pas de titre illisible)", () => {
        const three = [dj("A", 1), dj("B", 2), dj("C", 3)];
        expect(getDjPostTitle({ dungeonsJson: three })).toBe("Multi-donjons (3)");
    });

    it("régression : enveloppe { _items } → titre lisible, pas 'Multi-donjons — undefined'", () => {
        const envelope = { _items: [dj("Kraken", 100), dj("Minotoror", 120)] };
        const title = getDjPostTitle({ dungeonsJson: envelope });
        expect(title).toBe("Kraken + Minotoror");
        expect(title).not.toContain("undefined");
    });

    it("le multi-donjons prime sur le mode", () => {
        expect(getDjPostTitle({ mode: "DONJON", dungeon: { name: "Oubli" }, dungeonsJson: [dj("Kraken", 100)] })).toBe("Kraken");
    });

    it("mode simple : donjon / défi / titan / quête", () => {
        expect(getDjPostTitle({ mode: "DONJON", dungeon: { name: "Oubli" } })).toBe("Oubli");
        expect(getDjPostTitle({ mode: "DONJON" })).toBe("Donjon");
        expect(getDjPostTitle({ mode: "DEFI", defiName: "Guerre" })).toBe("Guerre");
        expect(getDjPostTitle({ mode: "DEFI" })).toBe("Défi");
        expect(getDjPostTitle({ mode: "TITAN", titanName: "Grozilla" })).toBe("Grozilla");
        expect(getDjPostTitle({ mode: "TITAN" })).toBe("Titan");
        expect(getDjPostTitle({ questName: "Pourpre" })).toBe("Pourpre");
        expect(getDjPostTitle({})).toBe("Quête");
    });
});

describe("getDjPostSubtitle", () => {
    it("multi-donjons : fourchette de niveaux + compteur", () => {
        expect(getDjPostSubtitle({ dungeonsJson: [dj("A", 100), dj("B", 120)] })).toBe("Niv. 100 à 120 · 2 donjons");
        expect(getDjPostSubtitle({ dungeonsJson: [dj("A", 100), dj("B", 100)] })).toBe("Niv. 100 · 2 donjons");
    });

    it("multi-donjons sans niveau → libellé de secours", () => {
        const noLevel = [
            { dungeonId: "1", name: "A", bossName: "B", level: undefined as unknown as number, imageUrl: null },
            { dungeonId: "2", name: "C", bossName: "D", level: undefined as unknown as number, imageUrl: null },
        ];
        expect(getDjPostSubtitle({ dungeonsJson: noLevel })).toBe("Session de 2 donjons");
    });

    it("mode donjon : boss + niveau, puis replis progressifs", () => {
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: { bossName: "Dragon", level: 200 } })).toBe("Niv. 200 — Dragon");
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: { level: 200 } })).toBe("Niv. 200");
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: { bossName: "Dragon" } })).toBe("Dragon");
        expect(getDjPostSubtitle({ mode: "DONJON", dungeon: {} })).toBe("Donjon");
    });

    it("modes défi / titan / quête", () => {
        expect(getDjPostSubtitle({ mode: "DEFI", defiName: "Guerre" })).toBe("Guerre");
        expect(getDjPostSubtitle({ mode: "DEFI" })).toBe("Événement Défi");
        expect(getDjPostSubtitle({ mode: "TITAN", titanName: "Grozilla" })).toBe("Grozilla");
        expect(getDjPostSubtitle({ mode: "TITAN" })).toBe("Mode Titan");
        expect(getDjPostSubtitle({})).toBe("Mode Quête");
    });
});

/**
 * Date & heure optionnelles — la date est posée à minuit quand le membre choisit
 * « Sans heure » : on lit alors une DATE SEULE, jamais « 00:00 ».
 * Le calcul doit être identique côté serveur (embed) et côté navigateur (carte) :
 * il est donc fait en heure civile Europe/Paris, quel que soit le fuseau du
 * runtime. C'était la cause du « jour et heure figés à minuit ».
 */
describe("date prévue (optionnelle)", () => {
    // 20/09/2026 16:00 UTC = 18:00 à Paris (CEST).
    const withTime = new Date("2026-09-20T16:00:00.000Z");
    // 19/09/2026 22:00 UTC = 20/09/2026 00:00 à Paris → « Sans heure ».
    const dateOnly = new Date("2026-09-19T22:00:00.000Z");

    it("getDjDateParts lit l'heure civile Paris (pas le fuseau du runtime)", () => {
        const parts = getDjDateParts(withTime);
        expect(parts).not.toBeNull();
        expect([parts!.year, parts!.month, parts!.day]).toEqual([2026, 9, 20]);
        expect([parts!.hours, parts!.minutes]).toEqual([18, 0]);
        expect(parts!.explicitTime).toBe(true);
    });

    it("minuit Paris = « date seule » (le runtime UTC ne doit pas dire 22:00)", () => {
        const parts = getDjDateParts(dateOnly);
        expect([parts!.year, parts!.month, parts!.day]).toEqual([2026, 9, 20]);
        expect([parts!.hours, parts!.minutes]).toEqual([0, 0]);
        expect(parts!.explicitTime).toBe(false);
        expect(hasExplicitTime(dateOnly)).toBe(false);
    });

    it("absente / invalide → null et jamais d'exception", () => {
        expect(getDjDateParts(null)).toBeNull();
        expect(getDjDateParts(undefined)).toBeNull();
        expect(getDjDateParts("")).toBeNull();
        expect(getDjDateParts("pas-une-date")).toBeNull();
        expect(hasExplicitTime(null)).toBe(false);
        expect(formatDjDateLabel(null)).toBeNull();
        expect(formatDiscordDateStamp(undefined)).toBeNull();
    });

    it("formatDjDateLabel : date + heure, ou date seule si « Sans heure »", () => {
        expect(formatDjDateLabel(withTime)).toBe("dimanche 20 septembre 2026 à 18:00");
        const only = formatDjDateLabel(dateOnly);
        expect(only).toBe("dimanche 20 septembre 2026");
        expect(only).not.toContain("00:00");
        expect(formatDjDateLabel(withTime, { shortWeekday: true, shortMonth: true })).toContain("à 18:00");
    });

    it("formatDiscordDateStamp : <t:F> avec heure, <t:D> sans heure", () => {
        expect(formatDiscordDateStamp(withTime)).toMatch(/^<t:\d+:F>$/);
        expect(formatDiscordDateStamp(dateOnly)).toMatch(/^<t:\d+:D>$/);
        // Même instant → même timestamp, seule l'annotation d'affichage change.
        const tsOf = (s: string) => s.match(/^<t:(\d+):/)?.[1];
        expect(tsOf(formatDiscordDateStamp(dateOnly)!)).toBe(tsOf(formatDiscordDateStamp(new Date(dateOnly))!));
    });

    it("toLocalDateTimeInput : heure LOCALE, jamais l'heure UTC de toISOString", () => {
        // ⚠️ Ce test ne doit dépendre d'AUCUN fuseau : verrouiller « 18:00 » pour un instant
        // UTC passait sur un poste parisien mais cassait sur le runner GitHub (UTC).
        // Le champ alimenté est un `datetime-local` : par définition **local**. On construit
        // donc la date en composantes locales → identité dans n'importe quel fuseau.
        const local = new Date(2026, 8, 20, 18, 0, 0);
        expect(toLocalDateTimeInput(local)).toBe("2026-09-20T18:00");
        // Chaîne sans fuseau → interprétée comme locale → identité également.
        expect(toLocalDateTimeInput("2026-09-20T18:00")).toBe("2026-09-20T18:00");
        // Bug d'origine verrouillé : `toISOString().slice(0, 16)` rendait l'heure **UTC**
        // (heure qui reculait, et date qui changeait de jour près de minuit) — sur un poste
        // non-UTC, la comparaison locale ci-dessus le révèle immédiatement.
        expect(toLocalDateTimeInput(null)).toBe("");
        expect(toLocalDateTimeInput("pas-une-date")).toBe("");
    });

    it("mergeMultiDungeonTargetDates : ne touche que targetDate et garde l'enveloppe", () => {
        type Enveloppe = { _items: { name?: string; targetDate?: Date | null }[]; _autoReminderCount?: number };
        const items = [dj("Kraken", 100), dj("Minotoror", 120)];
        const envelope = { _items: items, _autoReminderCount: 3 };
        const merged = mergeMultiDungeonTargetDates(envelope, [{ targetDate: new Date("2026-09-20T18:00:00.000Z") }]) as Enveloppe;
        expect(merged._autoReminderCount).toBe(3); // compteur de rappels préservé
        expect(merged._items[0].targetDate).toBeInstanceOf(Date);
        expect(merged._items[0].name).toBe("Kraken"); // données intactes
        expect(merged._items[1].targetDate).toBeUndefined(); // donjon non touché
    });

    it("mergeMultiDungeonTargetDates : tableau direct, et date retirée (null)", () => {
        const items = [{ ...dj("A", 1), targetDate: new Date("2026-09-20T18:00:00.000Z") }];
        const merged = mergeMultiDungeonTargetDates(items, [{ targetDate: null }]) as { targetDate: Date | null }[];
        expect(Array.isArray(merged)).toBe(true);
        expect(merged[0].targetDate).toBeNull();
        // Aucun donjon multi → on rend l'entrée telle quelle (pas de destruction).
        expect(mergeMultiDungeonTargetDates(null, [{ targetDate: null }])).toBeNull();
    });

/**
 * Lignes « Succès visés » des embeds : picto du succès (même asset que la modale du
 * site) quand l'application Discord le porte, puce historique `•` sinon.
 * Une seule règle pour le post simple ET le post multi-donjons.
 */
describe("achievementLines", () => {
    const picto = (name: string) => `<:${name}:1234567890>`;

    it("préfixe chaque succès de son picto (clé = nom de fichier de l'asset)", () => {
        const lines = achievementLines(
            [
                { name: "Nomade", iconUrl: "/game-data/achievements/nomade.png" },
                { name: "Spécial", iconUrl: "/game-data/achievements/spécial.png" },
            ],
            picto
        );
        expect(lines).toBe(
            "<:dofus_success_nomade:1234567890> Nomade\n<:dofus_success_special:1234567890> Spécial"
        );
    });

    it("sans synchro (repli du catalogue) → puce historique, zéro régression", () => {
        const lines = achievementLines([{ name: "Duo", iconUrl: "/game-data/achievements/duo.png" }], () => "•");
        expect(lines).toBe("• Duo");
    });

    it("succès sans asset connu → puce historique, jamais un picto vide", () => {
        const lines = achievementLines(
            [
                { name: "Succès d'API", iconUrl: "https://api.dofusdb.fr/img/challenges/42.png" },
                { name: "Sans icône" },
            ],
            picto
        );
        expect(lines).toBe("• Succès d'API\n• Sans icône");
    });

    it("liste vide → chaîne vide (le champ n'est alors pas ajouté à l'embed)", () => {
        expect(achievementLines([], picto)).toBe("");
    });
});

/**
 * Illustration des embeds Discord (« picto du boss » : donjon, défi, titan).
 * Discord n'affiche une image que depuis une URL **https absolue** : un chemin
 * relatif ou du http localhost est ignoré sans erreur → l'embed perd son illustration.
 */
describe("embedCoverUrl", () => {
    it("résout un chemin relatif contre l'origine publique du site", () => {
        expect(embedCoverUrl("/game-data/dungeons/donjon-des-squelettes.webp", "https://sigilos.fr")).toBe(
            "https://sigilos.fr/game-data/dungeons/donjon-des-squelettes.webp"
        );
        // Sans « / » initial et avec un « / » final sur l'origine : jamais de « // ».
        expect(embedCoverUrl("game-data/dungeons/x.webp", "https://beta.sigilos.fr/")).toBe(
            "https://beta.sigilos.fr/game-data/dungeons/x.webp"
        );
    });

    it("garde une URL https absolue telle quelle (assets d'API)", () => {
        expect(embedCoverUrl("https://api.dofusdb.fr/img/titans/x.png", "https://sigilos.fr")).toBe(
            "https://api.dofusdb.fr/img/titans/x.png"
        );
    });

    it("rend null quand Discord ne pourrait pas charger l'image", () => {
        // En dev, NEXT_PUBLIC_APP_URL = http://localhost:3000 : Discord ne peut pas
        // joindre cette origine → l'embed reste sans illustration (comportement historique).
        expect(embedCoverUrl("/game-data/dungeons/x.webp", "http://localhost:3000")).toBeNull();
        expect(embedCoverUrl("http://sigilos.fr/x.png", "https://sigilos.fr")).toBeNull();
        expect(embedCoverUrl(null, "https://sigilos.fr")).toBeNull();
        expect(embedCoverUrl(undefined, "https://sigilos.fr")).toBeNull();
        expect(embedCoverUrl("", "https://sigilos.fr")).toBeNull();
    });
});


describe("dungeon-finder — visuel d'une quête (liste de recherche)", () => {
    it("préfère le visuel explicite quand la base en porte un", () => {
        expect(questThumbnail({ imageUrl: "/game-data/quests/glourmandise.webp" })).toBe(
            "/game-data/quests/glourmandise.webp"
        );
    });

    it("refuse toute valeur brute (garde de forme : seule une URL interne part dans le `<img>`)", () => {
        expect(questThumbnail({ imageUrl: "https://exemple.fr/x.png" })).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail({ imageUrl: "//exemple.fr/x.png" })).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail({ imageUrl: "javascript:alert(1)" })).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail({ imageUrl: "   " })).toBe(QUEST_ICON_FALLBACK);
    });

    it("retombe sur la carte de départ de la quête (asset du jeu, carte réelle)", () => {
        expect(questThumbnail({ startPosition: [{ mapId: 160695296 }] })).toBe(
            "/game-data/hd_maps/160695296.webp"
        );
        expect(questStartMapId([{ mapId: 160695296 }, { mapId: 1 }])).toBe(160695296);
    });

    it("sans visuel ni carte : icône de quête Dofus (jamais d'image inventée)", () => {
        expect(questThumbnail(null)).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail(undefined)).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail({})).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail({ startPosition: [] })).toBe(QUEST_ICON_FALLBACK);
        expect(questThumbnail({ startPosition: [{ mapId: 0 }] })).toBe(QUEST_ICON_FALLBACK);
        expect(questStartMapId(null)).toBeNull();
        expect(questStartMapId("pas une position")).toBeNull();
        expect(questStartMapId([{ mapId: -3 }])).toBeNull();
    });

    // 🖼️ Source **unique** du chemin de la carte : c'est ce que les siphons écrivent en base
    // (`quest-siphon` + import God) et ce que `questThumbnail` affiche. Même règle, deux usages.
    it("construit le chemin interne de la carte du jeu, et rien d'autre", () => {
        expect(questMapImageUrl(160695296)).toBe("/game-data/hd_maps/160695296.webp");
        // Un id numérique sous forme de chaîne (réponse JSON) passe ; un id non exploitable ne
        // produit JAMAIS de chemin (0, négatif, texte, non-fini) — l'appelant écrit alors `null`.
        expect(questMapImageUrl("101450251")).toBe("/game-data/hd_maps/101450251.webp");
        expect(questMapImageUrl(0)).toBeNull();
        expect(questMapImageUrl(-2)).toBeNull();
        expect(questMapImageUrl("abc")).toBeNull();
        expect(questMapImageUrl(null)).toBeNull();
        expect(questMapImageUrl(NaN)).toBeNull();
        expect(questMapImageUrl(Infinity)).toBeNull();
        // Cohérence des deux usages : l'affichage rend exactement ce que le siphon écrit.
        expect(questThumbnail({ startPosition: [{ mapId: 101450251 }] })).toBe(
            questMapImageUrl(101450251)
        );
    });
});

});

/**
 * Places par groupe — chantier #26/#203.
 *
 * Régression verrouillée : la carte et la modale affichaient un ratio **global**
 * (`1/4 — 3 dispos`) sur un post de 5 donjons, alors que Discord compte **par
 * donjon** et que la capacité serveur (`acceptDjParticipant`) fait de même.
 * Une seule règle pour le post simple ET le multi : `getDjDungeonStats`.
 */
describe("getDjDungeonStats / summarizeDjDungeons", () => {
    const multi = [dj("Imagiro", 200), dj("Bastion", 190), dj("Trône", 200)];

    const participant = (status: string, dungeonIndex?: number | null, id = Math.random().toString(36)) => ({
        id,
        status,
        dungeonIndex,
        classe: "Iop",
    });

    it("post simple : un seul groupe, créateur compté (wording inchangé)", () => {
        const post = { dungeonsJson: null, maxMembers: 4, participants: [participant("ACCEPTED")] };
        const stats = getDjDungeonStats(post);
        expect(stats).toHaveLength(1);
        expect(stats[0].index).toBe(-1);
        expect(stats[0].dungeon).toBeNull();
        expect(stats[0].acceptedCount).toBe(2); // 1 inscrit + créateur
        expect(stats[0].spotsLeft).toBe(2);
        expect(stats[0].isFull).toBe(false);
        expect(summarizeDjDungeons(stats).label).toBe("2/4");
    });

    it("multi : capacité ET inscrits par donjon (#203)", () => {
        const post = {
            dungeonsJson: multi.map((d) => ({ ...d, maxMembers: 2 })),
            maxMembers: 8,
            participants: [participant("ACCEPTED", 0), participant("ACCEPTED", 2)],
        };
        const stats = getDjDungeonStats(post);
        expect(stats).toHaveLength(3);
        // Donjon 1 : créateur + 1 inscrit sur une capacité de 2 → complet.
        expect(stats[0].acceptedCount).toBe(2);
        expect(stats[0].spotsLeft).toBe(0);
        expect(stats[0].isFull).toBe(true);
        // Donjon 2 : créateur seul.
        expect(stats[1].acceptedCount).toBe(1);
        expect(stats[1].spotsLeft).toBe(1);
        // Donjon 3 : créateur + 1 inscrit.
        expect(stats[2].acceptedCount).toBe(2);
        expect(stats[2].isFull).toBe(true);
        const summary = summarizeDjDungeons(stats);
        expect(summary.total).toBe(3);
        expect(summary.full).toBe(2);
        expect(summary.openSpots).toBe(1);
        expect(summary.allFull).toBe(false);
    });

    it("inscrit « sans donjon » (dungeonIndex null) : compté dans CHAQUE donjon (tolérance #203)", () => {
        const post = {
            dungeonsJson: multi.map((d) => ({ ...d, maxMembers: 4 })),
            maxMembers: 4,
            participants: [participant("ACCEPTED", null)],
        };
        const stats = getDjDungeonStats(post);
        expect(stats.map((s) => s.acceptedCount)).toEqual([2, 2, 2]);
        // Post simple : le même inscrit compte une fois (un seul groupe).
        expect(getDjDungeonStats({ dungeonsJson: null, maxMembers: 4, participants: [participant("ACCEPTED", null)] })[0].acceptedCount).toBe(2);
    });

    it("capacité du donjon absente → repli sur `post.maxMembers` (jamais 0 place)", () => {
        const post = { dungeonsJson: multi, maxMembers: 6, participants: [] };
        const stats = getDjDungeonStats(post);
        expect(stats.map((s) => s.maxMembers)).toEqual([6, 6, 6]);
        expect(stats.map((s) => s.spotsLeft)).toEqual([5, 5, 5]);
    });

    it("file d'attente filtrée par donjon, et places jamais négatives", () => {
        const post = {
            dungeonsJson: multi.map((d) => ({ ...d, maxMembers: 1 })),
            maxMembers: 1,
            participants: [participant("PENDING", 1), participant("PENDING", 1), participant("PENDING", null)],
        };
        const stats = getDjDungeonStats(post);
        expect(stats[0].pending).toHaveLength(1); // créateur seul → déjà complet
        expect(stats[0].isFull).toBe(true);
        expect(stats[1].pending).toHaveLength(3);
        expect(stats.every((s) => s.spotsLeft === 0)).toBe(true);
    });

    it("libellés : identiques partout, hétérogènes, ou complet partout", () => {
        const even = getDjDungeonStats({
            dungeonsJson: multi.map((d) => ({ ...d, maxMembers: 4 })),
            maxMembers: 4,
            participants: [],
        });
        expect(summarizeDjDungeons(even).label).toBe("3 places sur 3 donjons");

        const uneven = getDjDungeonStats({
            dungeonsJson: multi.map((d) => ({ ...d, maxMembers: 4 })),
            maxMembers: 4,
            participants: [participant("ACCEPTED", 0), participant("ACCEPTED", 0), participant("ACCEPTED", 0)],
        });
        expect(summarizeDjDungeons(uneven).label).toBe("0 à 3 places selon le donjon");

        const full = getDjDungeonStats({
            dungeonsJson: multi.map((d) => ({ ...d, maxMembers: 1 })),
            maxMembers: 1,
            participants: [],
        });
        const fullSummary = summarizeDjDungeons(full);
        expect(fullSummary.allFull).toBe(true);
        expect(fullSummary.label).toBe("Complet partout");
        expect(fullSummary.perDungeon.map((d) => d.name)).toEqual(["Imagiro", "Bastion", "Trône"]);
    });

    it("aucun groupe (statistiques vides) → libellé vide, pas de NaN", () => {
        expect(summarizeDjDungeons([])).toEqual({
            total: 0,
            full: 0,
            openSpots: 0,
            minSpots: 0,
            maxSpots: 0,
            allFull: false,
            label: "",
            perDungeon: [],
        });
    });
});


/**
 * Enveloppe `dungeonsJson` : identifiants des **messages Discord par donjon** (#26).
 *
 * Le format « un message par donjon » doit pouvoir être adopté **sans migration** : la clé
 * `_messageIds` vit à côté de `_items` (déjà écrite par les rappels d'inactivité), et rien
 * de ce qui existait ne doit être perdu à l'écriture.
 */
describe("getMultiMessageIds / withMultiMessageIds", () => {
    it("sans ids (tableau nu ou enveloppe) → aucun message : format historique", () => {
        expect(getMultiMessageIds(null)).toEqual([]);
        expect(getMultiMessageIds([dj("A", 1)])).toEqual([]);
        expect(getMultiMessageIds({ _items: [dj("A", 1)], _autoReminderCount: 2 })).toEqual([]);
        // Valeurs inexploitables ignorées (jamais un PATCH vide ni un `42` en custom_id).
        expect(getMultiMessageIds({ _items: [], _messageIds: ["1", "", null, 42, "2"] })).toEqual(["1", "2"]);
    });

    it("écrit les ids en préservant les items et les autres clés", () => {
        const out = withMultiMessageIds({ _items: [dj("A", 1), dj("B", 2)], _autoReminderCount: 3 }, ["m1", "m2"]);
        expect(out._messageIds).toEqual(["m1", "m2"]);
        expect(out._autoReminderCount).toBe(3); // jamais perdu
        expect(getMultiDungeons(out).map((d) => d.name)).toEqual(["A", "B"]);
        // Aller-retour : ce qu'on écrit est ce qu'on relit.
        expect(getMultiMessageIds(out)).toEqual(["m1", "m2"]);
    });

    it("depuis un tableau nu (post créé avant l'enveloppe) : normalisé sans perte", () => {
        const fromArray = withMultiMessageIds([dj("C", 3)], ["m3"]);
        expect(fromArray._items.map((d) => d.name)).toEqual(["C"]);
        expect(getMultiMessageIds(fromArray)).toEqual(["m3"]);
    });
});


/**
 * Classes recherchées **par donjon** (#26) — même contrat que les dates : l'enveloppe
 * `{ _items, _autoReminderCount, _messageIds }` est préservée, un donjon non fourni n'est
 * jamais touché, et une liste **vide** est un choix explicite (« aucune classe demandée »).
 */
describe("mergeMultiDungeonRequiredClasses", () => {
    it("remplace les classes du donjon visé et laisse les autres intacts", () => {
        const items = [
            { ...dj("A", 1), requiredClasses: ["Iop"] },
            { ...dj("B", 2), requiredClasses: ["Cra"] },
            { ...dj("C", 3) },
        ];
        const merged = mergeMultiDungeonRequiredClasses(items, [["Zobal"], undefined, ["Eniripsa", "Pandawa"]]) as {
            requiredClasses?: string[];
        }[];
        expect(merged[0].requiredClasses).toEqual(["Zobal"]);
        expect(merged[1].requiredClasses).toEqual(["Cra"]); // non fourni → intact
        expect(merged[2].requiredClasses).toEqual(["Eniripsa", "Pandawa"]);
    });

    it("liste vide = choix explicite ; enveloppe `{ _items }` et compteurs préservés", () => {
        const envelope = {
            _items: [{ ...dj("A", 1), requiredClasses: ["Iop"] }],
            _autoReminderCount: 2,
            _messageIds: ["m1"],
        };
        const merged = mergeMultiDungeonRequiredClasses(envelope, [[]]) as Record<string, unknown> & {
            _items: { requiredClasses?: string[] }[];
        };
        expect(merged._items[0].requiredClasses).toEqual([]);
        expect(merged._autoReminderCount).toBe(2);
        expect(merged._messageIds).toEqual(["m1"]);
        // Aucun donjon multi → l'entrée est rendue telle quelle (jamais de destruction).
        expect(mergeMultiDungeonRequiredClasses(null, [["Iop"]])).toBeNull();
    });
});


describe("classe du créateur — enveloppe `dungeonsJson._creatorClass`", () => {
    it("lit la classe choisie, seule ou à côté des donjons multi", () => {
        expect(getDjCreatorClass({ _creatorClass: "Cra" })).toBe("Cra");
        expect(getDjCreatorClass({ _items: [{ dungeonId: "1" }], _creatorClass: "Eniripsa" })).toBe("Eniripsa");
    });

    it("n'invente rien quand la clé est absente, vide ou d'un autre type", () => {
        expect(getDjCreatorClass(null)).toBeNull();
        expect(getDjCreatorClass(undefined)).toBeNull();
        expect(getDjCreatorClass([{ dungeonId: "1" }])).toBeNull();
        expect(getDjCreatorClass({ _creatorClass: "   " })).toBeNull();
        expect(getDjCreatorClass({ _creatorClass: 42 })).toBeNull();
    });

    it("écrit la classe SANS perdre l'enveloppe (donjons, messages, rappels H-1)", () => {
        const before = {
            _items: [{ dungeonId: "1" }],
            _messageIds: ["m1"],
            _h1ReminderSentAt: "2026-10-01T10:00:00.000Z",
        };
        const after = withDjCreatorClass(before, "Iop");
        expect(after).toEqual({ ...before, _creatorClass: "Iop" });
        expect(getDjCreatorClass(after)).toBe("Iop");
    });

    it("retire la clé sur `null` et n'écrit jamais une enveloppe creuse", () => {
        expect(withDjCreatorClass({ _items: [{ dungeonId: "1" }], _creatorClass: "Cra" }, null))
            .toEqual({ _items: [{ dungeonId: "1" }] });
        expect(withDjCreatorClass({ _creatorClass: "Cra" }, null)).toBeNull();
        expect(withDjCreatorClass(null, "Cra")).toEqual({ _creatorClass: "Cra" });
        expect(withDjCreatorClass(null, null)).toBeNull();
    });

    it("convertit un tableau en enveloppe, toujours lisible par `getMultiDungeons`", () => {
        const after = withDjCreatorClass([{ dungeonId: "1" }], "Cra");
        expect(getMultiDungeons(after)).toEqual([{ dungeonId: "1" }]);
        expect(getDjCreatorClass(after)).toBe("Cra");
    });
});

describe("clôture unitaire d'un donjon (post multi)", () => {
    const envelope = {
        _items: [{ dungeonId: "d1" }, { dungeonId: "d2" }, { dungeonId: "d3" }],
        _messageIds: ["m1", "m2", "m3"],
        _creatorClass: "Cra",
    };

    it("marque UN donjon sans toucher les autres ni l'enveloppe", () => {
        const next = withDjDungeonsClosed(envelope, [1], "2026-10-23T12:00:00.000Z");
        const items = getMultiDungeons(next);
        expect(isDjDungeonClosed(items[1])).toBe(true);
        expect(isDjDungeonClosed(items[0])).toBe(false);
        expect(isDjDungeonClosed(items[2])).toBe(false);
        // Les autres clés de l'enveloppe survivent (messages Discord, classe du créateur).
        expect(next?._messageIds).toEqual(["m1", "m2", "m3"]);
        expect(next?._creatorClass).toBe("Cra");
        expect(openDjDungeonIndexes(next)).toEqual([0, 2]);
        expect(areAllDjDungeonsClosed(next)).toBe(false);
    });

    it("est idempotent : un donjon déjà clôturé garde sa première date", () => {
        const first = withDjDungeonsClosed(envelope, [0], "2026-10-23T12:00:00.000Z");
        const second = withDjDungeonsClosed(first, [0], "2026-10-24T09:00:00.000Z");
        expect(getMultiDungeons(second)[0].closedAt).toBe("2026-10-23T12:00:00.000Z");
    });

    it("ne considère le post terminé que si TOUS les donjons sont clôturés", () => {
        const partial = withDjDungeonsClosed(envelope, [0, 2]);
        expect(areAllDjDungeonsClosed(partial)).toBe(false);
        const total = withDjDungeonsClosed(envelope, [0, 1, 2]);
        expect(areAllDjDungeonsClosed(total)).toBe(true);
        expect(openDjDungeonIndexes(total)).toEqual([]);
    });

    it("ignore un index hors bornes et ne fabrique rien sur un post simple", () => {
        expect(withDjDungeonsClosed(envelope, [9])).toBeNull();
        expect(withDjDungeonsClosed(null, [0])).toBeNull();
        expect(withDjDungeonsClosed([], [0])).toBeNull();
        expect(areAllDjDungeonsClosed(null)).toBe(false);
        // Un post simple (aucun item) n'est jamais « entièrement clôturé » : c'est `status`.
        expect(areAllDjDungeonsClosed({ _creatorClass: "Cra" })).toBe(false);
    });

    it("pose le marqueur de rappel H-1 du bon donjon, et de lui seul", () => {
        const next = withDjDungeonReminder(
            envelope,
            2,
            "2026-10-23T19:00:00.000Z",
            "2026-10-23T20:00:00.000Z"
        );
        const items = getMultiDungeons(next);
        expect(items[2]._h1SentAt).toBe("2026-10-23T19:00:00.000Z");
        expect(items[2]._h1For).toBe("2026-10-23T20:00:00.000Z");
        expect(items[0]._h1SentAt).toBeUndefined();
        expect(withDjDungeonReminder(envelope, 9, "x", "y")).toBeNull();
    });
});


