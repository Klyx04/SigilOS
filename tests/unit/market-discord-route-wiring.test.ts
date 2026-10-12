/**
 * Régression (14/09/2026, constat beta) — **le bouton « Faire une offre » de
 * l'embed Discord était KO** : la soumission de la modale répondait
 * « ❌ Aucun profil SigilOS dans cette guilde » alors que la même offre passait
 * depuis le dashboard.
 *
 * Cause **mesurée** dans la route des interactions (`payload.type === 5`) :
 *   1. la branche `mkt:offer` transmettait `member.user.id` (**snowflake
 *      Discord**) comme `userId`, or `resolveMemberContext`
 *      (`src/server/market/discord-interactions.ts`) lit
 *      `UserProfile.userId` — l'**id interne** SigilOS ⇒ aucun profil trouvé ;
 *   2. le gate RBAC (`mkt → market:trade`) vivait **dans** la branche
 *      `payload.type === 3` (boutons) : les modales n'étaient pas filtrées.
 *
 * Ce test lit les sources (vitest tourne en environnement `node` : aucune route
 * Next n'est instanciable hors requête) et verrouille le **câblage** :
 * carte de permissions à portée module, gate partagé par les deux types
 * d'interaction, identité interne résolue avant l'appel du service, et aucune
 * régression sur les boutons.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/discord/interactions/route.ts";

function read(path: string): string {
    return readFileSync(path, "utf8");
}

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ROUTE_CODE = codeOnly(read(ROUTE));

/** Corps de la branche `mkt:offer` (soumission de modale), commentaires retirés. */
function marketModalBranch(): string {
    const start = ROUTE_CODE.indexOf('prefix === "mkt" && action === "offer"');
    expect(start, "branche `mkt:offer` introuvable dans la route").toBeGreaterThan(-1);
    const end = ROUTE_CODE.indexOf("} else if (", start);
    return ROUTE_CODE.slice(start, end === -1 ? undefined : end);
}

describe("Route Discord — carte RBAC des préfixes (source unique)", () => {
    it("est déclarée à portée **module** (hors du handler POST)", () => {
        const declaration = ROUTE_CODE.indexOf("const DISCORD_PERM_MAP");
        const handler = ROUTE_CODE.indexOf("export async function POST");
        expect(declaration, "carte `DISCORD_PERM_MAP` absente").toBeGreaterThan(-1);
        expect(handler, "handler POST introuvable").toBeGreaterThan(-1);
        expect(declaration, "la carte doit être partagée par les modales (type 5), donc hors du POST").toBeLessThan(handler);
    });

    it("mappe le Marché sur `market:trade` (jamais une chaîne en dur)", () => {
        const declaration = ROUTE_CODE.slice(
            ROUTE_CODE.indexOf("const DISCORD_PERM_MAP"),
            ROUTE_CODE.indexOf("};", ROUTE_CODE.indexOf("const DISCORD_PERM_MAP"))
        );
        expect(declaration).toMatch(/mkt:\s*PERMISSION_IDS\.MARKET_TRADE/);
    });
});

describe("Modale d'offre du Marché (`mkt:offer`, type 5)", () => {
    it("résout l'identité **interne** (jamais le snowflake) avant le service", () => {
        const branch = marketModalBranch();
        expect(branch, "le compte SigilOS doit être résolu dans la branche").toMatch(/findUserByDiscordId\(member\.user\.id\)/);
        expect(branch, "le service attend l'`User.id` interne").toMatch(/userId:\s*account\.userId/);
    });

    it("n'envoie plus jamais `member.user.id` comme `userId` du service", () => {
        const suspicious = [...ROUTE_CODE.matchAll(/userId:\s*member\.user\.id/g)].map((m) => m[0]);
        expect(suspicious, `snowflake transmis comme identité interne : ${suspicious.join(" · ")}`).toEqual([]);
    });

    it("applique le gate RBAC partagé (module + permission)", () => {
        const branch = marketModalBranch();
        expect(branch).toMatch(/isDiscordPrefixAuthorized\(prefix,\s*guild_id,\s*member\.user\.id\)/);
    });
});

describe("Boutons Discord (type 3) — non-régression du gate", () => {
    it("utilise le gate partagé, sans redéfinir la carte localement", () => {
        const handlerStart = ROUTE_CODE.indexOf("export async function POST");
        const handler = ROUTE_CODE.slice(handlerStart);
        expect(handler, "les boutons doivent passer par le gate partagé").toMatch(
            /isDiscordPrefixAuthorized\(prefix,\s*guild_id,\s*member\.user\.id\)/
        );
        expect(handler, "aucune seconde carte de permissions dans le handler").not.toMatch(/const DISCORD_PERM_MAP/);
    });

    it("garde le refus RBAC et le refus « compte requis » en un seul exemplaire", () => {
        const denied = ROUTE_CODE.match(/DISCORD_PERMISSION_DENIED\s*=\s*"/g) ?? [];
        const accountRequired = ROUTE_CODE.match(/DISCORD_ACCOUNT_REQUIRED\s*=\s*"/g) ?? [];
        expect(denied.length, "le texte de refus RBAC doit être déclaré une fois").toBe(1);
        expect(accountRequired.length, "le texte « connecté au moins une fois » doit être déclaré une fois").toBe(1);
    });
});
