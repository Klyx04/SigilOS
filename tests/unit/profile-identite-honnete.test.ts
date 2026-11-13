/**
 * Identité de combat — **un refus ne doit jamais ressembler à un enregistrement**.
 *
 * Défaut mesuré le 30/10/2026 (signalement utilisateur « il enregistre, il refresh, il retombe sur
 * “Configurer mon identité” ») :
 *  ① la modale se fermait **avant** la réponse du serveur, donc un refus (`pseudo déjà pris`,
 *    `introuvable sur le serveur`, `champs invalides`) passait pour un succès ;
 *  ② l'état optimiste n'était **jamais annulé** : l'écran gardait la valeur refusée ;
 *  ③ `localProfile` était initialisé une seule fois (`useState(profile)`) et ne suivait plus les
 *    props serveur après un rafraîchissement ;
 *  ④ le refus RBAC journalisait **deux identifiants Discord** (règle : jamais de snowflake).
 *
 * Ces gardes vérifient l'intention dans le code (comme `succes-ui-deslop`) : aucune base, aucun rendu.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (path: string) =>
    read(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const CLASS_DISPLAY = "src/components/profile/class-display.tsx";
const BENTO = "src/components/profile/profile-bento-grid.tsx";
const ACTIONS = "src/server/actions/profile-actions.ts";

describe("modale d'identité — elle attend la réponse du serveur", () => {
    it("la sauvegarde est attendue, et la fermeture vient APRÈS le contrôle du résultat", () => {
        const src = codeOf(CLASS_DISPLAY);
        expect(src).toContain("await onSave?.(selectedMain, localPseudo)");
        expect(src).toContain("res.success === false");
        expect(src).toContain("setSaveError");
        // `setIsOpen(false)` ne doit apparaître qu'après le test de `res.success === false`.
        const closeIndex = src.indexOf("setIsOpen(false)", src.indexOf("const handleSave"));
        const guardIndex = src.indexOf("res.success === false", src.indexOf("const handleSave"));
        expect(guardIndex).toBeGreaterThan(-1);
        expect(closeIndex).toBeGreaterThan(guardIndex);
    });

    it("le refus est affiché DANS la modale (role=alert), pas seulement en toast", () => {
        const src = read(CLASS_DISPLAY);
        expect(src).toMatch(/role="alert"/);
        expect(src).toMatch(/\{saveError && \(/);
    });

    it("le bouton est désactivé pendant l'appel (anti double-clic)", () => {
        const src = read(CLASS_DISPLAY);
        expect(src).toContain("const [isSaving, setIsSaving] = useState(false)");
        expect(src).toMatch(/disabled=\{[^}]*isSaving[^}]*\}/);
        expect(src).toContain("Enregistrement…");
    });
});

describe("état local — le serveur est la vérité", () => {
    it("l'état optimiste est annulé quand le serveur refuse", () => {
        const src = codeOf(BENTO);
        expect(src).toContain("const previous = { classe: localProfile.classe, pseudoDofus: localProfile.pseudoDofus }");
        expect(src).toContain("setLocalProfile(prev => ({ ...prev, ...previous }))");
        expect(src).toContain('return { success: false, error: res.error || "La sauvegarde a échoué." }');
    });

    it("l'identité se resynchronise quand les props serveur changent", () => {
        const src = codeOf(BENTO);
        expect(src).toMatch(/\}, \[profile\.pseudoDofus, profile\.classe\]\)/);
        expect(src).toContain("{ ...prev, pseudoDofus: profile.pseudoDofus, classe: profile.classe }");
    });
});

describe("refus serveur — un code dans les logs, une phrase à l'écran", () => {
    const src = codeOf(ACTIONS);
    /**
     * `profile-actions.ts` contient beaucoup d'actions : on ne juge **que** le corps de
     * `updateUserProfile` (sinon on attrape les messages d'autres écrans, ce qui rendrait la garde
     * fausse dans les deux sens).
     */
    const body = (() => {
        const start = src.indexOf("export async function updateUserProfile");
        const end = src.indexOf("\nexport ", start + 1);
        return start === -1 ? "" : src.slice(start, end === -1 ? undefined : end);
    })();

    it("le corps de la fonction est bien délimité (garde utile)", () => {
        expect(body).toContain("PROFILE_DB_ERROR");
        expect(body).not.toContain("export async function updateAvailability");
    });

    it("chaque refus porte un code court et journalisé", () => {
        for (const code of [
            "PROFILE_SCHEMA_INVALID",
            "PROFILE_GUILD_NOT_FOUND",
            "PROFILE_UNAUTHORIZED",
            "PROFILE_FORBIDDEN",
            "PROFILE_PSEUDO_TAKEN",
            "PROFILE_LADDER_NOT_FOUND",
            "PROFILE_DB_ERROR",
        ]) {
            expect(body, code).toContain(code);
        }
        expect(body).toContain('logger.warn("[updateUserProfile] refus"');
    });

    it("aucun identifiant Discord dans les logs (jamais de snowflake)", () => {
        expect(body).not.toContain("Unauthorized profile update attempt by");
        expect(body).not.toContain("${session.user.id}");
    });

    it("aucun message interne en anglais à l'écran", () => {
        expect(body).not.toContain('error: "Unauthorized"');
        expect(body).not.toContain('error: "Données invalides"');
    });
});
