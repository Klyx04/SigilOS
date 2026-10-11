/**
 * Garde — fiche des **monstres normaux** : la fiche publique `/bestiaire/<slug>` et l'onglet
 * « Monstres » du module Succès doivent lire la MÊME source locale et rendre le MÊME
 * composant.
 *
 * 🎯 Demande user (11/10/2026) : « pas de fiche monstres normaux ni interne/ni publique …
 * c du au fait que tous les monstres normaux sont pas siphonné dofusdb/dofensive ? ».
 * Mesure : `/bestiaire/piou-rouge` → **404** (racine → 200) et `MonsterStat` = **283 lignes**,
 * **0** « Piou » : la page ne résolvait que dans la table du siphon (boss / titans / gardiens
 * d'anomalie / avis). Le bestiaire COMPLET (5 129 monstres) est déjà versionné
 * (`public/game-data/unity-bestiary.json`) : aucune passe de siphon n'était nécessaire.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { findUnityMonsterBySlug, listUnityMonsters } from "@/lib/unity-bestiary";
import { getLocalMonsterFiche } from "@/lib/monster-stats-core";
import {
    groupMonsterFamilies,
    normalizeMonsterQuery,
    searchNormalMonsters,
} from "@/lib/monster-fiche";
import { buildBossFicheTabs } from "@/lib/boss-fiche-tabs";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("recherche de monstres normaux — règle pure", () => {
    const rows = [
        { name: "Bouftou", raceName: "Bouftous" },
        { name: "Piou Rouge", raceName: "Pious" },
        { name: "Piou Vert", raceName: "Pious" },
        { name: "Tournesol Affamé", isBoss: true },
        { name: "bouftou", raceName: "Bouftous" },
    ];

    it("ignore accents, casse, espaces et ponctuation", () => {
        expect(normalizeMonsterQuery("Pïou  ROUGE")).toBe("piourouge");
        expect(searchNormalMonsters(rows, "piou rouge", 10).map((m) => m.name)).toEqual(["Piou Rouge"]);
        expect(searchNormalMonsters(rows, "BOUFTOU", 10).map((m) => m.name)).toEqual(["Bouftou"]);
    });

    it("cherche aussi sur le libellé de famille", () => {
        expect(searchNormalMonsters(rows, "pious", 10).map((m) => m.name)).toEqual(["Piou Rouge", "Piou Vert"]);
    });

    it("écarte les créatures qui ont déjà leur fiche et dédoublonne les homonymes", () => {
        expect(searchNormalMonsters(rows, "", 10).map((m) => m.name)).toEqual(["Bouftou", "Piou Rouge", "Piou Vert"]);
    });

    it("est bornée par `limit` (0 = aucun résultat)", () => {
        expect(searchNormalMonsters(rows, "", 1).length).toBe(1);
        expect(searchNormalMonsters(rows, "", 0)).toEqual([]);
    });
});

describe("2ᵉ niveau de filtre — familles réelles (quête, alignement, métier)", () => {
    const rows = [
        { name: "Piou Rouge", raceId: 33, raceName: "Pious", monsterId: 489 },
        { name: "Piou Vert", raceId: 33, raceName: "Pious", monsterId: 490 },
        { name: "Bouftou", raceId: 12, raceName: "Bouftous", monsterId: 1 },
        { name: "Monstre orphelin", raceId: 0, raceName: null, monsterId: 2 },
    ];

    it("groupe par famille, poids décroissant, sprite représentatif", () => {
        const facets = groupMonsterFamilies(rows);
        expect(facets.map((f) => [f.name, f.count])).toEqual([["Pious", 2], ["Bouftous", 1]]);
        expect(facets[0].sampleMonsterId).toBe(489);
        // Une famille sans libellé connu n'est JAMAIS proposée (pas de pastille « Monstre » ×N).
        expect(groupMonsterFamilies([{ name: "X", raceId: 78, raceName: null }])).toEqual([]);
        expect(groupMonsterFamilies([{ name: "Y", raceId: 12, raceName: "   " }])).toEqual([]);
    });

    it("filtre la liste par famille, sans jamais croiser les familles", () => {
        expect(searchNormalMonsters(rows, "", 10, 33).map((m) => m.name)).toEqual(["Piou Rouge", "Piou Vert"]);
        expect(searchNormalMonsters(rows, "", 10, 12).map((m) => m.name)).toEqual(["Bouftou"]);
        expect(searchNormalMonsters(rows, "", 10, 999)).toEqual([]);
    });

    it("les familles réellement nommées du bestiaire local existent (quête d'abord), sans réseau", () => {
        // Même référentiel de libellés que le serveur (`dungeon-monsters.json`, 132 races).
        const local = JSON.parse(readSource("public/game-data/dungeon-monsters.json"));
        const labels = new Map<number, string>();
        for (const m of local?.monsters ?? []) {
            const id = Math.floor(Number(m?.raceId) || 0);
            if (id > 0 && m?.raceName && !labels.has(id)) labels.set(id, m.raceName);
        }
        const facets = groupMonsterFamilies(
            listUnityMonsters().map((m) => ({
                name: m.name,
                raceId: m.raceId,
                raceName: labels.get(m.raceId) ?? null,
                monsterId: m.id,
            }))
        );
        expect(facets.length).toBeGreaterThan(100);
        expect(facets[0].name).toBe("Monstres de quête");
        expect(facets[0].count).toBeGreaterThan(1000);
        expect(facets[0].sampleMonsterId).toBeGreaterThan(0);
        // Aucune facette sans libellé réel : la liste reste utilisable telle quelle.
        expect(facets.every((f) => f.name.trim() !== "" && f.name !== "Monstre")).toBe(true);
    });
});

describe("bestiaire local — résolution par slug d'URL", () => {
    it("résout un monstre par le slug des fiches (même algorithme)", () => {
        const piou = findUnityMonsterBySlug("piou-rouge");
        expect(piou?.name).toBe("Piou Rouge");
        expect(piou?.id).toBeGreaterThan(0);
        expect(findUnityMonsterBySlug("monstre-inexistant-xyz")).toBeNull();
    });

    it("expose le bestiaire complet, trié par nom", () => {
        const list = listUnityMonsters();
        expect(list.length).toBeGreaterThan(5000);
        const head = list.slice(0, 20).map((m) => m.name);
        expect([...head].sort((a, b) => a.localeCompare(b, "fr"))).toEqual(head);
    });
});

describe("getLocalMonsterFiche — 100 % local, zéro réseau", () => {
    it("sert la fiche d'un monstre normal absent du siphon (Piou Rouge)", async () => {
        const fiche = await getLocalMonsterFiche("piou-rouge");
        expect(fiche?.name).toBe("Piou Rouge");
        expect(fiche?.source).toBe("unity");
        expect(fiche?.data?.grades?.length).toBe(5);
        expect(fiche?.data?.spells?.length).toBe(2);
    });

    it("accepte aussi l'identifiant Ankama", async () => {
        const fiche = await getLocalMonsterFiche(489);
        expect(fiche?.monsterId).toBe(489);
        expect(fiche?.name).toBe("Piou Rouge");
    });

    it("rend `null` pour un inconnu (jamais de fiche inventée)", async () => {
        expect(await getLocalMonsterFiche("monstre-inexistant-xyz")).toBeNull();
        expect(await getLocalMonsterFiche("")).toBeNull();
    });
});

describe("fiche publique et onglet interne — même source, même rendu", () => {
    it("la page `/bestiaire/<slug>` résout en local et rend le composant partagé", () => {
        const page = readSource("src/app/bestiaire/[slug]/page.tsx");
        expect(page).toContain("getMonsterFicheBySegment");
        expect(page).toContain("MonsterFicheView");
        // Plus de résolution fondée sur la seule table du siphon : c'était la cause du 404.
        expect(page).not.toContain("db.monsterStat");
        expect(page).not.toContain("getMonsterStats");
    });

    it("l'action résout localement et conserve la garde anti-doublon (boss / avis / titan)", () => {
        const actions = readSource("src/server/actions/game-data-actions.ts");
        expect(actions).toContain("getLocalMonsterFiche");
        expect(actions).toContain("officialFicheSegmentForName");
        // La destination d'un monstre normal reste la source unique des URLs de fiche.
        expect(readSource("src/lib/monster-fiche.ts")).toContain("`/bestiaire/${slug}`");
    });

    it("le module Succès expose l'onglet « Monstres » (interne)", () => {
        const client = readSource("src/components/succes/SuccesClient.tsx");
        expect(client).toContain('id: "monstres"');
        expect(client).toContain("SuccesMonstresTab");
        const tab = readSource("src/components/succes/SuccesMonstresTab.tsx");
        expect(tab).toContain("searchNormalMonsters");
        expect(tab).toContain("MonsterFicheView");
    });

    it("l'overlay Bestiaire cherche dans le bestiaire complet, côté serveur", () => {
        const overlay = readSource("src/components/boss-overlay/BossOverlayClient.tsx");
        expect(overlay).toContain("searchNormalMonsters(search, 40)");
        expect(overlay).toContain("pool = monsterResults");
    });

    it("le catalogue public `/boss` expose le filtre « Monstres » (externe)", () => {
        // 🎯 Retour user (11/10/2026) : « ya pas de filtre par monstre normal sur l'externe » —
        // le catalogue public rejetait explicitement `type === "monstre"` et n'avait pas l'option.
        const catalog = readSource("src/app/boss/_components/PublicBossCatalogClient.tsx");
        expect(catalog).toContain('"monstre",');
        expect(catalog).toMatch(/value: "monstre", label: t\.bossPage\.monsterType/);
        expect(catalog).toContain("searchNormalMonsters(search, MONSTER_LIST_LIMIT, monsterFamilyId)");
        // Les cartes d'un monstre mènent à SA fiche, jamais à `/boss/<slug>`.
        expect(catalog).toContain("monsterFicheHref(boss.bossName || boss.name)");
        // Le libellé du filtre existe dans les deux langues (jamais une clé manquante).
        expect(readSource("src/lib/i18n/locales/fr.ts")).toContain('monsterType: "Monstres"');
        expect(readSource("src/lib/i18n/locales/en.ts")).toContain('monsterType: "Monsters"');
    });

    it("le 2ᵉ niveau (familles) est branché sur l'externe ET en interne", () => {
        // 🎯 Retour user (11/10/2026) : « un vrai 2ᵉ niveau de filtre intelligemment pour les
        // monstres normaux : quête, alignement, etc. tout ce qui est dispo, avec de vrais assets ».
        for (const path of [
            "src/app/boss/_components/PublicBossCatalogClient.tsx",
            "src/components/succes/SuccesMonstresTab.tsx",
        ]) {
            const source = readSource(path);
            expect(source, path).toContain("<MonsterFamilyFilter");
            expect(source, path).toContain("searchNormalMonsters(search, ");
            expect(source, path).toMatch(/searchNormalMonsters\(search, [^)]*[Ff]amily/);
        }
        const filter = readSource("src/components/succes/MonsterFamilyFilter.tsx");
        expect(filter).toContain("getNormalMonsterFamilies");
        // UN SEUL menu déroulant (« supprime les 1ᵉʳ filtres à l'intérieur, garde le dropdown »)
        // et les sprites officiels DANS les entrées (« affiche des assets dans le dropdown »).
        expect(filter).toContain("<FilterDropdown");
        expect(filter).not.toContain("FamilyChip");
        // L'URL du sprite vient de la **source unique** `monsterSpriteUrl` (jamais recopiée).
        expect(filter).toContain("monsterSpriteUrl(family.sampleMonsterId)");
        expect(filter).toContain("group: family.superRaceName");

        // Le composant partagé affiche le picto dans le déclencheur ET dans chaque entrée.
        const dropdown = readSource("src/components/ui/filter-dropdown.tsx");
        expect(dropdown).toContain("icon?: string | null");
        expect(dropdown).toMatch(/optionIcon\(/);
        // Aucun `<select>` natif dans le CODE (les commentaires citent celui qu'on remplace).
        const codeOnly = (src: string) =>
            src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        expect(codeOnly(dropdown)).not.toMatch(/<select[\s>]/);
        expect(codeOnly(filter)).not.toMatch(/<select[\s>]/);

        // Le filtre « type » du catalogue public porte les pictos officiels du jeu.
        const catalog = readSource("src/app/boss/_components/PublicBossCatalogClient.tsx");
        for (const icon of [
            "/assets/dofus/icons/boss.png",
            "/assets/missions/ano1.png",
            "/assets/dofus/icons/titan.png",
            "/assets/avis/avitons.png",
            "/assets/dofus/icons/crown.png",
            "/assets/dofus/icons/archimonster.png",
        ]) {
            expect(catalog, icon).toContain(`icon: "${icon}"`);
        }
    });

    it("le référentiel des familles couvre TOUTES les races du bestiaire (plus de « Monstre » ×N)", () => {
        // Mesure du 11/10/2026 : le libellé des familles n'était déduit que des donjons
        // (`dungeon-monsters.json`, 132 races) alors que le bestiaire en utilise 263 —
        // 124 sans nom (1 349 monstres) ⇒ pastilles « Monstre » indistinguables.
        const ref = JSON.parse(readSource("public/game-data/monster-races.json"));
        expect(ref.races.length).toBeGreaterThan(250);
        expect(ref.superRaces.length).toBeGreaterThan(30);
        const byId = new Map<number, { name: string }>(ref.races.map((r: any) => [r.id, r]));
        expect(byId.get(78)?.name).toBe("Archimonstres");
        expect(byId.get(196)?.name).toBe("Monstres de quête de Pwâk");
        // Aucune race utilisée par le bestiaire local ne reste sans libellé officiel.
        const missing = new Set<number>();
        for (const monster of listUnityMonsters()) {
            const raceId = Math.floor(Number(monster.raceId) || 0);
            if (raceId > 0 && !byId.has(raceId)) missing.add(raceId);
        }
        expect([...missing]).toEqual([]);
    });

    it("la fiche d'un monstre a ses onglets Butin et Simulation (parité des fiches)", () => {
        // 🎯 Retour user (11/10/2026) : « il manque aussi aux monstres normaux leur onglet
        // butins et l'onglet de simulation interne/public ».
        const tabs = buildBossFicheTabs({
            entity: "monster",
            counts: { grades: 5, roomMonsters: 0, monsters: 0, quests: 0, achievements: 0 },
            hasMechanics: true,
        });
        expect(tabs.map((t) => t.id)).toEqual(["sorts", "sim", "strategy", "grades", "loot"]);
        expect(tabs.find((t) => t.id === "sorts")?.label).toBe("Sorts du monstre");
        expect(buildBossFicheTabs({
            entity: "monster",
            counts: { grades: 1, roomMonsters: 0, monsters: 0, quests: 0, achievements: 0 },
            hasMechanics: false,
            locale: "en",
        }).find((t) => t.id === "sorts")?.label).toBe("Monster Spells");

        const view = readSource("src/components/succes/MonsterFicheView.tsx");
        expect(view).toContain("buildBossFicheTabs({");
        expect(view).toMatch(/entity: "monster"/);
        expect(view).toMatch(/detailTab === "loot"/);
        expect(view).toMatch(/detailTab === "sim"/);
        // La simulation est le MÊME composant que les fiches boss / avis.
        expect(view).toContain("<SpellRangeGrid");
    });

    it("n'injecte pas des milliers de pages dans l'index (noindex sauf fiche siphonnée)", () => {
        // 🎯 Question user (11/10/2026) : « pour le sitemap ça veut dire qu'on va indexer des
        // milliers de pages de monstres sur internet ? » ⇒ non : seules les fiches dont le
        // contenu est réellement siphonné (butin, encyclopédie) sont indexables et au sitemap.
        const page = readSource("src/app/bestiaire/[slug]/page.tsx");
        expect(page).toContain('robots: fiche.source === "siphon" ? undefined : { index: false, follow: true }');
        const sitemap = readSource("src/app/sitemap.ts");
        expect(sitemap).toContain("listSiphonedNormalMonsterSlugs()");
        // La règle d'exclusion vit dans UN module serveur, partagé avec la liste et le sitemap.
        const scope = readSource("src/server/game/normal-monster-scope.ts");
        expect(scope).toContain("export async function excludedNormalMonsterKeys");
        expect(scope).toContain("export async function listSiphonedNormalMonsterSlugs");
        expect(readSource("src/server/actions/game-data-actions.ts")).toContain("excludedNormalMonsterKeys");
        // Une seule URL canonique par créature + redirection vers la fiche officielle si elle existe
        // (boss / avis / titan) : jamais deux pages pour la même bête (anti-duplicate).
        expect(page).toContain("alternates: { canonical:");
        expect(page).toContain("redirect(`/boss/${encodeURIComponent(fiche.officialSegment)}`)");
        // `/bestiaire` doit rester **crawlable** (robots.ts) : un `Disallow` empêcherait Google de
        // *lire* le `noindex` par page et figerait les ~5 000 URL dans l'index.
        const robots = readSource("src/app/robots.ts");
        expect(robots).toContain("'/bestiaire'");
        expect(robots).not.toMatch(/disallow:[\s\S]*?'\/bestiaire/);
    });

    it("le sommaire `/bestiaire` porte les liens des fiches (maillage interne), une seule fois", () => {
        // 🎯 Mesure user (11/10/2026) : « un hub `/bestiaire` (serveur) : familles + fiches
        // siphonnées listées en HTML → 1 page qui pousse 59 fiches ». Sans lui : 0 lien
        // `/bestiaire/` dans le HTML de `/boss` (liste chargée côté client) et `/bestiaire` → 404.
        const hub = readSource("src/app/bestiaire/page.tsx");
        expect(hub).toContain("getBestiaryHub");
        // Indexable (≠ les ~5 000 fiches auto-générées en noindex) + canonical unique.
        expect(hub).toContain("robots: hasContent ? { index: true, follow: true }");
        expect(hub).toContain("alternates: { canonical: `${getAppBaseUrl()}/bestiaire` }");
        // Un lien RÉEL par fiche, rendu côté serveur, plus le balisage `CollectionPage`/`ItemList`.
        expect(hub).toContain("href={`/bestiaire/${monster.slug}`}");
        expect(hub).toContain('"@type": "CollectionPage"');
        expect(hub).toContain('"@type": "ItemList"');
        expect(hub).not.toMatch(/^"use client"/m);

        // La source du périmètre est CELLE DU SITEMAP : on ne lie aucune page `noindex`.
        const action = readSource("src/server/actions/game-data-actions.ts");
        expect(action).toContain("export async function getBestiaryHub");
        expect(action).toMatch(/getBestiaryHub[\s\S]{0,900}?listSiphonedNormalMonsterSlugs\(\)/);

        // Entrées du sommaire : `/boss` (déjà indexée) et chaque fiche (breadcrumb + bouton).
        expect(readSource("src/app/boss/page.tsx")).toContain('href="/bestiaire"');
        const fiche = readSource("src/app/bestiaire/[slug]/page.tsx");
        expect(fiche).toContain('href="/bestiaire"');
        expect(fiche).toContain("name: t.bossPage.bestiaryHub.eyebrow, item: `${getAppBaseUrl()}/bestiaire`");

        // Le sommaire lui-même entre au sitemap (1 URL) — seulement quand il a du contenu.
        const sitemap = readSource("src/app/sitemap.ts");
        expect(sitemap).toMatch(/if \(monsters\.length > 0\)[\s\S]{0,300}?url: `\$\{baseUrl\}\/bestiaire`/);
    });

    it("aucune URL du sitemap ne répond 404 (nom parasite de siphon écarté)", () => {
        // 🔴 Bug mesuré le 11/10/2026 : `MonsterStat.monsterName = "[object Object]"` (écriture
        // parasite du siphon) produisait `/bestiaire/object-object` **au sitemap**, qui répondait
        // 404. Une URL du sitemap doit répondre 200 : la source du périmètre valide donc le slug
        // contre le bestiaire local (l'index qui sert réellement la fiche publique).
        expect(findUnityMonsterBySlug("object-object")).toBeNull();
        expect(findUnityMonsterBySlug("piou-rouge")).not.toBeNull();
        const scope = readSource("src/server/game/normal-monster-scope.ts");
        expect(scope).toContain("findUnityMonsterBySlug");
        expect(scope).toMatch(/if \(!findUnityMonsterBySlug\(slug\)\) continue;/);
    });
});
