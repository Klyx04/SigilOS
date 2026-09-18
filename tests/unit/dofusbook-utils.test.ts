import { describe, it, expect } from "vitest";
import { canonicalClassId, dofusbookCharacteristicRows, DOFUSBOOK_CHARACTERISTIC_CODES, dofusbookItemIconId, dofusbookItemIconUrl, DOFUSBOOK_ITEM_ICON_URL_VERSION, DOFUSBOOK_STAT_LABELS, extractDofusbookBuildId, getClassName, isDofusbookBlockResponse, isDofusbookBuildUrl, isDofusRoomBuildUrl, isUsableDofusbookRawPayload, processDofusbookRawData } from "@/lib/dofusbook-utils";

// Matériau minimal d'un build Dofusbook (suffisant pour `processDofusbookRawData`).
function buildRaw(overrides: Record<string, unknown> = {}) {
    return {
        stuff: { name: "Build test", character_level: 200, stuffItem: {}, ...(overrides.stuff as object || {}) },
        items: [],
        cloths: [],
        ...overrides,
    };
}

describe("processDofusbookRawData — résolution de classe (#galerie Inconnu)", () => {
    it("résout la classe quand Dofusbook renvoie un character_class valide (1-19)", () => {
        const res = processDofusbookRawData("123", buildRaw({ stuff: { name: "Forge Rush", character_class: 19 } }));
        expect(res.classId).toBe(19);
        expect(res.className).toBe("Forgelance");
    });

    it("NE produit PAS un faux « Inconnu » quand character_class est absent → classId 0 / className vide", () => {
        const res = processDofusbookRawData("123", buildRaw({ stuff: { name: "Forge Rush" } }));
        expect(res.classId).toBe(0);
        expect(res.className).toBe("");
    });

    it("NE retombe pas sur la classe par défaut (id 1) quand character_class est hors bornes", () => {
        const res = processDofusbookRawData("123", buildRaw({ stuff: { name: "X", character_class: 99 } }));
        expect(res.classId).toBe(0);
        expect(res.className).toBe("");
    });

    it("tamponne la version de forme v:2 (détection des caches sans effets d'items)", () => {
        expect(processDofusbookRawData("123", buildRaw()).v).toBe(2);
    });

    it("conserve les effets/niveau/type des items pour la modale interne", () => {
        const item = {
            id: 1621, // id interne Dofusbook
            name: "Anneau Poli",
            picture: 9143, // iconId DofusDB
            official: 8879, // id Ankama / DofusDB
            level: 109,
            type: "Anneau",
            effects: [
                { name: "ch", min: 20, max: 30 },
                { name: "pa", min: 1, max: 1 },
            ],
        };
        const res = processDofusbookRawData("123", buildRaw({
            stuff: { stuffItem: { a1: 1621 } },
            items: [item],
        }));
        const kept = res.items?.["a1"];
        expect(kept?.name).toBe("Anneau Poli");
        expect(kept?.level).toBe(109);
        expect(kept?.typeName).toBe("Anneau");
        expect(kept?.effects).toEqual([
            { code: "ch", min: 20, max: 30, value: 30 },
            { code: "pa", min: 1, max: 1, value: 1 },
        ]);
    });

    it("détecte les stats secondaires (retrait PA/PM, tacle, fuite) issues des effets d'items", () => {
        const item = {
            id: 1459, // id interne Dofusbook
            name: "Protège-Tibias Ancestraux",
            picture: 11096,
            official: 8467,
            effects: [
                { name: "rpa", min: 2, max: 2 },
                { name: "rpm", min: 1, max: 1 },
                { name: "ta", min: 40, max: 40 },
                { name: "fu", min: 30, max: 30 },
            ],
        };
        const res = processDofusbookRawData("123", buildRaw({
            stuff: { stuffItem: { bo: 1459 } },
            items: [item],
        }));
        expect(res.stats?.retpa).toBe(2);
        expect(res.stats?.retpm).toBe(1);
        expect(res.stats?.tacle).toBe(40);
        expect(res.stats?.fuite).toBe(30);
    });
});

describe("isDofusbookBuildUrl / extractDofusbookBuildId — flexibilité des liens de build", () => {
    // 🐛 Bug du 18/09/2026 : le formulaire (et le schéma Zod serveur) refusaient le
    // format de l'app « desktop » de Dofusbook → toast « FORMAT DE LIEN INVALIDE ».
    const DESKTOP_URL = "https://www.dofusbook.net/desktop/fr/equipement/16582897-feca-multi-low-cost-pvm-200/objets";

    it("accepte le format « desktop » (segment d'app + suffixe d'onglet)", () => {
        expect(isDofusbookBuildUrl(DESKTOP_URL)).toBe(true);
        expect(extractDofusbookBuildId(DESKTOP_URL)).toBe("16582897");
    });

    it("accepte toutes les variantes d'URL du site (langue, perso, private, query, slash)", () => {
        const accepted = [
            "https://www.dofusbook.net/fr/equipement/16582901-feca-multi-premium-pvm-200",
            "https://dofusbook.net/fr/equipement/16582901-feca/",
            "https://www.dofusbook.net/fr/equipement/private/16582901-",
            "https://www.dofusbook.net/fr/equipement/perso/16582901-x",
            "https://www.dofusbook.net/en/equipement/16582901-x?tab=stats#top",
            "https://www.dofusbook.net/desktop/fr/equipement/16582897-x/objets",
        ];
        for (const url of accepted) {
            expect(isDofusbookBuildUrl(url), url).toBe(true);
        }
    });

    it("accepte les liens courts d-bk.net (id résolu côté serveur) mais n'en extrait pas d'id", () => {
        expect(isDofusbookBuildUrl("https://d-bk.net/fr/d/17Zy9")).toBe(true);
        expect(isDofusbookBuildUrl("https://www.d-bk.net/fr/d/17Zy9")).toBe(true);
        expect(extractDofusbookBuildId("https://d-bk.net/fr/d/17Zy9")).toBeNull();
    });

    it("refuse ce qui n'est pas un build (hôte, protocole, page sans id)", () => {
        const refused = [
            "http://www.dofusbook.net/fr/equipement/16582901-x",     // https requis
            "https://evil.com/fr/equipement/16582901-x",
            "https://dofusbook.net.evil.com/fr/equipement/16582901-x", // suffixe trompeur
            "https://www.dofusbook.net/",
            "https://www.dofusbook.net/fr/equipement",               // page « liste », sans id
            "https://d-bk.net/",
            "pas une url",
            "https://www.dofusroom.com/buildroom/build/show/123",     // DofusRoom ⇒ autre validateur
        ];
        for (const url of refused) {
            expect(isDofusbookBuildUrl(url), url).toBe(false);
        }
    });

    it("conserve le validateur DofusRoom pour la compatibilité du schéma serveur", () => {
        expect(isDofusRoomBuildUrl("https://www.dofusroom.com/buildroom/build/show/123")).toBe(true);
        expect(isDofusRoomBuildUrl("https://dofusroom.com/b-123")).toBe(true);
        expect(isDofusRoomBuildUrl("http://dofusroom.com/b-123")).toBe(false);
        expect(isDofusRoomBuildUrl("https://www.dofusbook.net/fr/equipement/16582901-x")).toBe(false);
    });
});

describe("processDofusbookRawData — détail des caractéristiques primaires (Total / ⚡ / Base / Parcho)", () => {
    /**
     * Build de référence relevé dans le **panneau de détail Dofusbook** (18/09/2026) :
     * Vitalité 3150 (base 0 · parcho 100), Sagesse 440, Force 560 (⚡1140),
     * Intelligence 665 (⚡1245), Chance 725 (⚡1305), Agilité 725 (⚡1305), Puissance 580.
     * Les valeurs d'équipement sont celles déduites de la capture (3150 − 100 parcho, etc.).
     */
    function screenshotRaw() {
        return buildRaw({
            stuff: { name: "Eau crit 160", character_level: 200, stuffItem: { amulette: 1 } },
            items: [{
                id: 1,
                name: "Stuff complet",
                picture: 1,
                official: 1,
                effects: [
                    { name: "vi", min: 3050, max: 3050 },
                    { name: "sa", min: 340, max: 340 },
                    { name: "fo", min: 365, max: 365 },
                    { name: "in", min: 365, max: 365 },
                    { name: "ch", min: 425, max: 425 },
                    { name: "ag", min: 425, max: 425 },
                    { name: "pu", min: 580, max: 580 },
                ],
            }],
            stuffStats: {
                base_fo: 95, base_in: 200, base_ch: 200, base_ag: 200,
                scroll_vi: 100, scroll_sa: 100, scroll_fo: 100,
                scroll_in: 100, scroll_ch: 100, scroll_ag: 100,
            },
        });
    }

    it("expose la répartition équipement / base / parchotage de chaque caractéristique", () => {
        const res = processDofusbookRawData("23019276", screenshotRaw());
        expect(res.characteristics).toMatchObject({
            vi: { total: 3150, items: 3050, base: 0, scroll: 100 },
            sa: { total: 440, items: 340, base: 0, scroll: 100 },
            fo: { total: 560, items: 365, base: 95, scroll: 100 },
            in: { total: 665, items: 365, base: 200, scroll: 100 },
            ch: { total: 725, items: 425, base: 200, scroll: 100 },
            ag: { total: 725, items: 425, base: 200, scroll: 100 },
            pu: { total: 580, items: 580, base: 0, scroll: 0 },
        });
    });

    it("sort le socle de PV de niveau de la Vitalité (caractéristique ≠ total de PV)", () => {
        const res = processDofusbookRawData("23019276", screenshotRaw());
        expect(res.levelHp).toBe(1050);                  // 50 + 5 × 200
        expect(res.stats?.vit).toBe(4200);               // total de PV (socle inclus)
        expect(res.characteristics?.vi?.total).toBe(3150); // ce que Dofusbook affiche
    });

    it("garde les totaux d'éléments alignés sur la somme des trois colonnes", () => {
        const res = processDofusbookRawData("23019276", screenshotRaw());
        expect(res.elements).toMatchObject({ fo: 560, in: 665, ch: 725, ag: 725, sa: 440, pu: 580 });
        for (const key of DOFUSBOOK_CHARACTERISTIC_CODES) {
            const c = res.characteristics?.[key];
            expect(c).toBeDefined();
            expect((c?.items ?? 0) + (c?.base ?? 0) + (c?.scroll ?? 0)).toBe(c?.total);
        }
    });

    it("mappe Total / ⚡ (carac + Puissance) / Base / Parcho pour l'affichage", () => {
        const rows = dofusbookCharacteristicRows(processDofusbookRawData("23019276", screenshotRaw()));
        expect(rows.map((r) => r.key)).toEqual([...DOFUSBOOK_CHARACTERISTIC_CODES]);
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
        expect(byKey.fo).toMatchObject({ label: "Force", asset: "terre.png", total: 560, power: 1140 });
        expect(byKey.in).toMatchObject({ total: 665, power: 1245 });
        expect(byKey.ch).toMatchObject({ total: 725, power: 1305 });
        expect(byKey.ag).toMatchObject({ total: 725, power: 1305 });
        // Vitalité / Sagesse / Puissance : pas de colonne ⚡ (non cumulées par la Puissance)
        expect(byKey.vi.power).toBeUndefined();
        expect(byKey.sa.power).toBeUndefined();
        expect(byKey.pu.power).toBeUndefined();
        expect(byKey.vi).toMatchObject({ label: "Vitalité", asset: "pv.png", total: 3150, base: 0, scroll: 100 });
        expect(byKey.pu).toMatchObject({ label: "Puissance", asset: "puissance.png", total: 580, items: 580, base: 0, scroll: 0 });
        expect(byKey.fo.breakdown).toBe("Force : 365 (équipement) + 95 (base) + 100 (parcho) = 560 · 560 + 580 Puissance ⇒ 1140");
        expect(byKey.vi.breakdown).toContain("socle de niveau + 1050 PV ⇒ 4200 PV");
    });

    it("n'invente aucune ligne quand le détail est absent (préview au vieux format)", () => {
        expect(dofusbookCharacteristicRows(null)).toEqual([]);
        expect(dofusbookCharacteristicRows(undefined)).toEqual([]);
        expect(dofusbookCharacteristicRows({ v: 2, id: 1 } as never)).toEqual([]);
    });

    it("ne met que l'équipement dans `items` quand il n'y a ni capital ni parchotage", () => {
        const res = processDofusbookRawData("1", buildRaw({
            stuff: { stuffItem: { a1: 1 } },
            items: [{ id: 1, name: "X", picture: 1, official: 1, effects: [{ name: "fo", min: 100, max: 100 }] }],
        }));
        expect(res.characteristics?.fo).toEqual({ total: 100, items: 100, base: 0, scroll: 0 });
        expect(res.characteristics?.vi).toEqual({ total: 0, items: 0, base: 0, scroll: 0 });
    });
});

describe("dofusbookItemIconId — icônes d'items (bug « mauvais items » galerie / perso)", () => {
    it("retourne l'iconId DofusDB (`picture`)", () => {
        expect(dofusbookItemIconId({ picture: 9143 })).toBe(9143);   // Anneau Poli
        expect(dofusbookItemIconId({ picture: 23001 })).toBe(23001); // Dofus Pourpre
        expect(dofusbookItemIconId({ picture: 9047 })).toBe(9047);   // Gelano
    });

    it("n'utilise JAMAIS l'id interne Dofusbook ni l'id Ankama (cause du bug)", () => {
        // Les deux produisent l'icône d'un AUTRE item : `/img/items/{id}.png` est un
        // namespace d'icônes (id Ankama 8879 → icône d'une hache, id interne 1621 → bottes).
        expect(dofusbookItemIconId({ picture: 9143, id: 1621, official: 8879 } as never)).toBe(9143);
        expect(dofusbookItemIconId({ picture: 0, id: 1621, official: 8879 } as never)).toBeNull();
    });

    it("retourne null quand aucun iconId exploitable (vieux cache) → pas de fausse icône", () => {
        expect(dofusbookItemIconId({ picture: 0 })).toBeNull();
        expect(dofusbookItemIconId(null)).toBeNull();
        expect(dofusbookItemIconId(undefined)).toBeNull();
    });

    it("construit une URL de proxy interne (jamais de hotlink Dofusbook/DofusDB)", () => {
        expect(dofusbookItemIconUrl(9143)).toBe(`/api/assets-dofus/items/9143?v=${DOFUSBOOK_ITEM_ICON_URL_VERSION}`);
        expect(dofusbookItemIconUrl(23001)).toBe(`/api/assets-dofus/items/23001?v=${DOFUSBOOK_ITEM_ICON_URL_VERSION}`);
    });

    it("versionne la clé d'URL pour contourner un placeholder figé en cache navigateur", () => {
        // Le paramètre `v` change la clé de cache (le proxy ignore les query params) : un
        // ancien placeholder SVG en cache 24 h est ainsi ignoré sans hard-reload manuel.
        expect(DOFUSBOOK_ITEM_ICON_URL_VERSION).toBeGreaterThanOrEqual(2);
        expect(dofusbookItemIconUrl(1)).toContain(`?v=${DOFUSBOOK_ITEM_ICON_URL_VERSION}`);
    });

    describe("DOFUSBOOK_STAT_LABELS — libellés des codes de bonus de panoplie", () => {
        /** Codes relevés dans les payloads réels (`cloths[].effects[].name`). */
        const OBSERVED_CODES = [
            "ag", "cc", "ch", "daf", "dc", "def", "dff", "dnf", "dp", "dtf", "epa", "epm", "fo", "fu",
            "in", "ii", "pa", "pm", "po", "pu", "rap", "rc", "rep", "rfp", "rtp", "ta", "vi",
        ];

        it("donne un libellé lisible à chaque code réellement rencontré", () => {
            for (const code of OBSERVED_CODES) {
                const label = DOFUSBOOK_STAT_LABELS[code];
                expect(label, `code « ${code} » sans libellé`).toBeTruthy();
                expect(label).not.toBe(code); // jamais le code brut affiché tel quel
            }
        });

        it("n'invente aucun libellé pour un code inconnu", () => {
            expect(DOFUSBOOK_STAT_LABELS["zzz"]).toBeUndefined();
        });

        it("ancre les codes ambigus sur le référentiel officiel DofusDB", () => {
            expect(DOFUSBOOK_STAT_LABELS.rc).toBe("Ré Crit."); // 87 « Critiques (fixe) »
            expect(DOFUSBOOK_STAT_LABELS.rp).toBe("Ré Pouss."); // 85 « Poussée (fixe) »
            expect(DOFUSBOOK_STAT_LABELS.fu).toBe("Fuite"); // 78
            expect(DOFUSBOOK_STAT_LABELS.ta).toBe("Tacle"); // 79
            expect(DOFUSBOOK_STAT_LABELS.epa).toBe("Esquive PA"); // 27
            expect(DOFUSBOOK_STAT_LABELS.epm).toBe("Esquive PM"); // 28
            expect(DOFUSBOOK_STAT_LABELS.rpa).toBe("Retrait PA"); // 82
            expect(DOFUSBOOK_STAT_LABELS.rpm).toBe("Retrait PM"); // 83
        });
    });

    it("expose l'iconId des items du build (picture conservé par le parseur)", () => {
        const res = processDofusbookRawData("123", buildRaw({
            stuff: { stuffItem: { a1: 1621 } },
            items: [{ id: 1621, name: "Anneau Poli", picture: 9143, official: 8879 }],
        }));
        expect(res.items?.["a1"]?.name).toBe("Anneau Poli");
        expect(res.items?.["a1"]?.picture).toBe(9143);
        expect(res.items?.["a1"]?.official).toBe(8879);
        expect(dofusbookItemIconId(res.items?.["a1"])).toBe(9143);
        // ⚠️ Régression : ni l'id interne (1621) ni l'id Ankama (8879) ne doivent servir d'icône.
        expect(dofusbookItemIconId(res.items?.["a1"])).not.toBe(res.items?.["a1"]?.id);
        expect(dofusbookItemIconId(res.items?.["a1"])).not.toBe(res.items?.["a1"]?.official);
    });
});

describe("getClassName", () => {
    it("mappe les 19 classes Dofus", () => {
        expect(getClassName(1)).toBe("Féca");
        expect(getClassName(13)).toBe("Roublard");
        expect(getClassName(19)).toBe("Forgelance");
    });

    it("renvoie « Inconnu » pour un id hors bornes", () => {
        expect(getClassName(99)).toBe("Inconnu");
    });
});

describe("isDofusbookBlockResponse — détection du challenge anti-bot Cloudflare", () => {
    it("classe en blocage les statuts 403 / 429 / 5xx (challenge ou origine en erreur)", () => {
        expect(isDofusbookBlockResponse(403, "text/html", "<title>Attention Required! | Cloudflare</title>")).toBe(true);
        expect(isDofusbookBlockResponse(429, null, null)).toBe(true);
        expect(isDofusbookBlockResponse(503, "application/json", '{"error":"Worker fetch failed"}')).toBe(true);
        expect(isDofusbookBlockResponse(520, null, null)).toBe(true);
    });

    it("détecte une page HTML de challenge même en 200", () => {
        expect(isDofusbookBlockResponse(200, "text/html; charset=UTF-8", "<h1>Just a moment...</h1>")).toBe(true);
        expect(isDofusbookBlockResponse(200, "text/html", "<html><body>Build</body></html>")).toBe(false);
    });

    it("ne classe PAS en blocage un 404 (build introuvable) ni un 401 (mauvais secret worker)", () => {
        expect(isDofusbookBlockResponse(404, "application/json", '{"type":"FunctionalError","message":"stuff/not-found"}')).toBe(false);
        expect(isDofusbookBlockResponse(401, "application/json", '{"error":"Unauthorized"}')).toBe(false);
    });
});

describe("isUsableDofusbookRawPayload — validation du JSON fourni par le navigateur", () => {
    const validPayload = {
        stuff: { stuffItem: { amulette: { id: 1 } } },
        items: [{ id: 1, picture: 9143 }],
    };

    it("accepte un payload Dofusbook conforme (stuff.stuffItem + items)", () => {
        expect(isUsableDofusbookRawPayload(validPayload)).toBe(true);
        // `items` est optionnel (certains builds n'en renvoient pas)
        expect(isUsableDofusbookRawPayload({ stuff: { stuffItem: {} } })).toBe(true);
    });

    it("refuse tout ce qui n'est pas un objet de build plausible", () => {
        expect(isUsableDofusbookRawPayload(null)).toBe(false);
        expect(isUsableDofusbookRawPayload("payload")).toBe(false);
        expect(isUsableDofusbookRawPayload([validPayload])).toBe(false);
        expect(isUsableDofusbookRawPayload({})).toBe(false);
        expect(isUsableDofusbookRawPayload({ stuff: null })).toBe(false);
        expect(isUsableDofusbookRawPayload({ stuff: { stuffItem: null } })).toBe(false);
        expect(isUsableDofusbookRawPayload({ stuff: { stuffItem: {} }, items: "nope" })).toBe(false);
        // Réponse de challenge / page d'erreur sans `stuff`
        expect(isUsableDofusbookRawPayload({ error: "Attention Required" })).toBe(false);
    });

    it("refuse un payload trop volumineux (protection anti-DoS)", () => {
        const huge = { stuff: { stuffItem: {} }, items: [], filler: "x".repeat(2 * 1024 * 1024) };
        expect(isUsableDofusbookRawPayload(huge)).toBe(false);
    });
});

describe("canonicalClassId (filtre galerie : Forgelance 19 vs 20)", () => {
    it("garde la numérotation Dofusbook 1-19 telle quelle", () => {
        expect(canonicalClassId(1)).toBe(1);
        expect(canonicalClassId(9)).toBe(9);
        expect(canonicalClassId(19)).toBe(19);
        expect(canonicalClassId("9")).toBe(9);
    });

    it("convertit le breed DofusDB / l'id d'icône 20 vers Forgelance = 19", () => {
        expect(canonicalClassId(20)).toBe(19);
        expect(canonicalClassId("20")).toBe(19);
    });

    it("résout les slugs et noms legacy (insensible accents/casse)", () => {
        expect(canonicalClassId("forgelance")).toBe(19);
        expect(canonicalClassId("Forgelance")).toBe(19);
        expect(canonicalClassId("Cra")).toBe(9);
        expect(canonicalClassId("ecaflip")).toBe(6);
    });

    it("retourne 0 pour l'inconnu (ni build ni filtre ne matchent)", () => {
        expect(canonicalClassId(0)).toBe(0);
        expect(canonicalClassId(99)).toBe(0);
        expect(canonicalClassId("zzz")).toBe(0);
        expect(canonicalClassId(null)).toBe(0);
        expect(canonicalClassId(undefined)).toBe(0);
    });
});
