/**
 * Notifications — référentiel d'affichage (ordre, libellés, icônes) et rangée de filtres.
 *
 * 🛡️ Ce que ce test protège — trois défauts **mesurés** le 15/10/2026 :
 * ① la cloche listait **8** catégories pendant que la page en listait **10** : `SUCCESS`, `OCRE`
 *    et `SYSTEM` étaient **infiltrables** dans la cloche (et les deux listes se contredisaient) ;
 * ② la rangée de filtres affichait huit boutons à `(0)` sur trois lignes bancales — aucun
 *    renseignement, aucune régularité ;
 * ③ un chemin d'image non borné finit dans un `<img>` chez le destinataire : une URL distante y
 *    serait un appel sortant et une fuite d'IP (règle « zéro empreinte », `AGENTS.md` §5.11).
 */
import { describe, expect, it } from "vitest";
import { NotificationCategory } from "@prisma/client";
import {
    NOTIFICATION_ALL_FILTER,
    NOTIFICATION_CATEGORY_ICONS,
    NOTIFICATION_CATEGORY_LABELS,
    NOTIFICATION_CATEGORY_ORDER,
    NOTIFICATION_IMAGE_KINDS,
    buildNotificationFilters,
    isNotificationImageKind,
    notificationCategoryIcon,
    notificationCategoryLabel,
    sanitizeNotificationImageUrl,
} from "@/lib/notification-categories";

const ALL_CATEGORIES = Object.values(NotificationCategory) as NotificationCategory[];

describe("référentiel des catégories", () => {
    it("l'ordre canonique couvre TOUTE l'enum, sans doublon (aucune catégorie oubliable)", () => {
        expect([...NOTIFICATION_CATEGORY_ORDER].sort()).toEqual([...ALL_CATEGORIES].sort());
        expect(new Set(NOTIFICATION_CATEGORY_ORDER).size).toBe(NOTIFICATION_CATEGORY_ORDER.length);
    });

    it("chaque catégorie a un libellé non vide et unique (le vocabulaire ne se contredit pas)", () => {
        const labels = ALL_CATEGORIES.map((category) => NOTIFICATION_CATEGORY_LABELS[category]);
        for (const label of labels) expect(label.trim().length).toBeGreaterThan(0);
        expect(new Set(labels).size).toBe(labels.length);
    });

    it("chaque catégorie a un asset du jeu, servi par l'app (jamais une URL distante)", () => {
        for (const category of ALL_CATEGORIES) {
            const icon = NOTIFICATION_CATEGORY_ICONS[category];
            expect(icon, category).toBeTruthy();
            expect(icon.startsWith("/"), category).toBe(true);
        }
    });

    it("une valeur inconnue retombe sur le vocabulaire Système (jamais un trou d'affichage)", () => {
        expect(notificationCategoryLabel("PAS_UNE_CATEGORIE")).toBe("Système");
        expect(notificationCategoryLabel(null)).toBe("Système");
        expect(notificationCategoryIcon("PAS_UNE_CATEGORIE")).toBe(NOTIFICATION_CATEGORY_ICONS.SYSTEM);
    });
});

describe("rangée de filtres", () => {
    it("« Toutes » est toujours en tête, quoi qu'il arrive", () => {
        expect(buildNotificationFilters({}, "ALL")[0]).toEqual(NOTIFICATION_ALL_FILTER);
        expect(buildNotificationFilters({ MISSION: 4 }, "MISSION")[0].id).toBe("ALL");
    });

    it("n'affiche QUE les catégories qui contiennent quelque chose", () => {
        const filters = buildNotificationFilters({ MISSION: 3, MARKET: 1 }, "ALL");
        expect(filters.map((f) => f.id)).toEqual(["ALL", "MISSION", "MARKET"]);
    });

    it("garde la catégorie ACTIVE même vide (sinon elle disparaîtrait sous le curseur)", () => {
        const filters = buildNotificationFilters({ MISSION: 3 }, "OCRE");
        expect(filters.map((f) => f.id)).toEqual(["ALL", "MISSION", "OCRE"]);
        expect(filters.find((f) => f.id === "OCRE")?.label).toBe("Ocre");
    });

    it("respecte l'ordre canonique, quel que soit l'ordre des compteurs", () => {
        const filters = buildNotificationFilters({ SYSTEM: 1, MISSION: 1, DONJONS: 1 }, "ALL");
        expect(filters.map((f) => f.id)).toEqual(["ALL", "MISSION", "DONJONS", "SYSTEM"]);
    });

    it("un compteur à zéro ou négatif n'ouvre pas de filtre", () => {
        expect(buildNotificationFilters({ MISSION: 0, DONJONS: -3 }, "ALL").map((f) => f.id)).toEqual(["ALL"]);
    });
});

describe("chemin d'asset d'une notification (fail-closed)", () => {
    it("accepte un chemin interne servi par l'app", () => {
        for (const path of [
            "/api/assets-dofus/items/32239",
            "/api/assets-dofus/monsters/1.webp",
            "/assets/icons/succes.png",
            "/uploads/assets-dofus/monsters/4834.webp?url=x",
        ]) {
            expect(sanitizeNotificationImageUrl(path), path).toBe(path);
        }
    });

    it("refuse tout ce qui n'est pas un chemin relatif interne", () => {
        for (const value of [
            "https://evil.example/pixel.png",
            "http://evil.example/pixel.png",
            "//evil.example/pixel.png", // URL protocol-relative
            "assets/icons/succes.png", // relatif sans « / »
            "javascript:alert(1)",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "C:\\Windows\\x.png",
            "/api/../secret",
            "",
            "   ",
            null,
            undefined,
            42,
            {},
            "x".repeat(513),
        ]) {
            expect(sanitizeNotificationImageUrl(value), String(value)).toBeNull();
        }
    });

    it("ne reconnaît que les types d'asset déclarés", () => {
        for (const kind of NOTIFICATION_IMAGE_KINDS) {
            expect(isNotificationImageKind(kind)).toBe(true);
        }
        for (const value of ["dungeon", "ITEM ", null, 42, {}]) {
            expect(isNotificationImageKind(value)).toBe(false);
        }
    });
});
