import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    COUNTED_MODULE_KEYS,
    DASHBOARD_ACCESS_ROLE_NAME,
    getNextOnboardingAction,
    isRbacConfigured,
    isOnboardingComplete,
    isEveryoneRole,
    pickAssignableRoles,
    pickDashboardAccessRolePreselect,
    shouldCreateDashboardAccessRole,
    buildPendingGuildIconUrl,
    getGettingStartedPercent,
    shouldPromptOptionalNextSteps,
} from "@/lib/onboarding-gating";
import { DEFAULT_MODULES } from "@/lib/module-types";
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";

/**
 * One-shot onboarding : landing → portail → invite bot → getting-started.
 * A. RBAC fail-closed sur @everyone (le bug "annuaire/calendrier/mini-jeux
 *    visibles après avoir autorisé everyone").
 * B. Invite bot : pré-sélection de guilde + fail-closed sans clientId.
 * C. Icônes portail : host CDN + ?size=128 (fini les 404).
 * D. % getting-started : progression sur les obligatoires d'abord (fini le 0%).
 */
describe("onboarding-funnel A-Z", () => {
    const EVERYONE = "1545599253949325322"; // @everyone = id Discord de la guilde
    const OTHER_ROLE = "111111111111111111";

    it("A1 — dashboard:login sur un rôle explicite = RBAC configuré", () => {
        expect(isRbacConfigured({ [OTHER_ROLE]: ["dashboard:login"] }, EVERYONE)).toBe(true);
    });

    it("A2 — dashboard:login UNIQUEMENT sur @everyone = NON configuré (fail-closed)", () => {
        expect(isRbacConfigured({ [EVERYONE]: ["dashboard:login"] }, EVERYONE)).toBe(false);
    });

    it("A3 — @everyone + un vrai rôle = configuré (everyone ignoré, rôle compte)", () => {
        expect(
            isRbacConfigured(
                { [EVERYONE]: ["dashboard:login"], [OTHER_ROLE]: ["dashboard:login"] },
                EVERYONE,
            ),
        ).toBe(true);
    });

    it("A4 — mapping vide / null = non configuré", () => {
        expect(isRbacConfigured({}, EVERYONE)).toBe(false);
        expect(isRbacConfigured(null, EVERYONE)).toBe(false);
        expect(isRbacConfigured(undefined, EVERYONE)).toBe(false);
    });

    it("A5 — onboarding complet exige serveur de jeu + RBAC explicite", () => {
        expect(isOnboardingComplete({ [OTHER_ROLE]: ["dashboard:login"] }, 295, EVERYONE)).toBe(true);
        expect(isOnboardingComplete({ [OTHER_ROLE]: ["dashboard:login"] }, null, EVERYONE)).toBe(false);
        expect(isOnboardingComplete({ [EVERYONE]: ["dashboard:login"] }, 295, EVERYONE)).toBe(false);
    });

    it("A6 — isEveryoneRole : l'id @everyone est l'id de la guilde", () => {
        expect(isEveryoneRole(EVERYONE, EVERYONE)).toBe(true);
        expect(isEveryoneRole(OTHER_ROLE, EVERYONE)).toBe(false);
    });

    it("B1 — invite bot pré-sélectionne la guilde (retour /onboarding/success)", () => {
        const url = buildDiscordBotInviteUrl("123456789012345678", {
            guildId: EVERYONE,
            redirectUri: "https://beta.sigilos.fr/onboarding/success",
            scope: "bot",
        });
        expect(url).toContain(`guild_id=${EVERYONE}`);
        expect(url).toContain("redirect_uri=");
        expect(url).toContain("permissions=326686043268");
        expect(url).not.toContain("permissions=8&");
    });

    it("B2 — invite bot fail-closed sans clientId", () => {
        expect(buildDiscordBotInviteUrl("")).toBeNull();
    });

    it("C1 — icône portail : CDN + size bornée", () => {
        expect(buildPendingGuildIconUrl(EVERYONE, "abc123")).toBe(
            `https://cdn.discordapp.com/icons/${EVERYONE}/abc123.png?size=128`,
        );
    });

    it("C2 — icône portail : null sans hash (fallback initiales, pas de 404)", () => {
        expect(buildPendingGuildIconUrl(EVERYONE, null)).toBeNull();
    });

    it("D1 — guilde fraîche : 0% obligatoires (pas de 0% global anxiogène sur les 6 étapes)", () => {
        const steps = [
            { id: "dofus", status: "TO_DO", mandatory: true, points: 20 },
            { id: "rbac", status: "TO_DO", mandatory: true, points: 20 },
            { id: "discord", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "modules", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "presentation", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "missions", status: "TO_DO", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(false);
        expect(res.percent).toBe(0);
        expect(res.mandatoryPercent).toBe(0);
    });

    it("D2 — 1re obligatoire validée = 50% (pas 20%)", () => {
        const steps = [
            { id: "dofus", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "rbac", status: "TO_DO", mandatory: true, points: 20 },
            { id: "discord", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "modules", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "presentation", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "missions", status: "TO_DO", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(false);
        expect(res.percent).toBe(50);
    });

    it("D3 — obligatoires complètes = % global (40/100 ici)", () => {
        const steps = [
            { id: "dofus", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "rbac", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "discord", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "modules", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "presentation", status: "IN_PROGRESS", mandatory: false, points: 15 },
            { id: "missions", status: "TO_DO", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(true);
        expect(res.percent).toBe(40);
    });

    it("D4 — tout complété = 100% + mandatoryComplete", () => {
        const steps = [
            { id: "dofus", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "rbac", status: "COMPLETED", mandatory: true, points: 20 },
            { id: "discord", status: "COMPLETED", mandatory: false, points: 15 },
            { id: "modules", status: "COMPLETED", mandatory: false, points: 15 },
            { id: "presentation", status: "COMPLETED", mandatory: false, points: 15 },
            { id: "missions", status: "COMPLETED", mandatory: false, points: 15 },
        ] as const;
        const res = getGettingStartedPercent([...steps]);
        expect(res.mandatoryComplete).toBe(true);
        expect(res.percent).toBe(100);
    });
});

/**
 * E. 2ᵉ modale « Prochaines étapes » — règle corrigée (22/09/2026).
 *
 * 🔍 Défauts mesurés à la lecture :
 *   ① le layout recopiait une liste de 14 clés qui avait **dérivé** du registre
 *      (`DEFAULT_MODULES` compte 27 clés : `marche`, `commandes`, `tickets`, `succes`, `minigames`,
 *      `logs`, `gallery`, `reactionRoles`, `worldmap`, `quests`, `resources`, `ladderSync`,
 *      `manualLadderSync`, `availability` manquaient) ;
 *   ② elle comptait `admin` — le panneau de configuration, actif **par construction**
 *      (`DEFAULT_MODULES.admin === true`), donc jamais « un module choisi » par l'admin ;
 *   ③ la condition `row présente ET aucun module actif` rendait la modale **inatteignable au moment
 *      prévu** : une guilde qui vient de terminer l'onboarding n'a **aucune ligne `GuildModules`**
 *      (seul écrivain : `updateGuildModules`) ⇒ le prompt ne s'affichait pas le jour de l'activation.
 */
describe("E. prompt « Prochaines étapes » après activation (règle unique)", () => {
    it("E1 — les clés comptées sont DÉRIVÉES du registre (aucune liste recopiée)", () => {
        expect([...COUNTED_MODULE_KEYS].sort()).toEqual(
            Object.keys(DEFAULT_MODULES)
                .filter((k) => k !== "admin")
                .sort(),
        );
        // `admin` = panneau de configuration : jamais compté comme un module choisi.
        expect(COUNTED_MODULE_KEYS).not.toContain("admin");
        // Les clés qui manquaient à la liste codée en dur sont bien couvertes désormais.
        for (const key of ["marche", "commandes", "tickets", "succes", "minigames", "logs", "gallery", "reactionRoles", "availability"]) {
            expect(COUNTED_MODULE_KEYS).toContain(key);
        }
    });

    it("E2 — guilde fraîchement activée (AUCUNE ligne) = modules non configurés ⇒ on propose", () => {
        expect(shouldPromptOptionalNextSteps(null)).toBe(true);
        expect(shouldPromptOptionalNextSteps(undefined)).toBe(true);
    });

    it("E3 — ligne aux défauts (seuls admin/reactionRoles/tickets actifs) ⇒ on propose", () => {
        // `reactionRoles`/`tickets` sont actifs par défaut côté registre : s'ils comptent comme
        // « configuré », la modale redevient inatteignable → ce test fige le comportement voulu.
        expect(shouldPromptOptionalNextSteps({ ...DEFAULT_MODULES, reactionRoles: false, tickets: false })).toBe(true);
    });

    it("E4 — un module réellement activé par l'admin ⇒ plus de prompt", () => {
        expect(shouldPromptOptionalNextSteps({ ...DEFAULT_MODULES, missions: true })).toBe(false);
        expect(shouldPromptOptionalNextSteps({ presentation: true })).toBe(false);
    });

    it("E5 — le layout consomme la règle et ne recopie plus de liste de clés", () => {
        const LAYOUT = readFileSync("src/app/dashboard/[guildId]/layout.tsx", "utf8");
        expect(LAYOUT).toMatch(/shouldPromptOptionalNextSteps\(/);
        expect(LAYOUT).not.toMatch(/const COUNTED_KEYS = \[/);
    });
});

/**
 * F. Cul-de-sac « un seul rôle = @everyone » (question user 22/09/2026).
 *
 * 🔍 Mesure : le layout filtre les rôles servis à la modale (`r.id !== guildId` ⇒ @everyone exclu,
 * `!r.managed` ⇒ rôles d'intégration exclus) et l'action serveur refuse @everyone / rôle managé
 * (`mandatory-onboarding.test.ts`). Si la guilde n'a QUE @everyone (ou que des rôles managés), la
 * liste est vide : « Valider » reste désactivé, la modale est **non fermable** et la gateway
 * redirige toute autre page `/dashboard/[guildId]/*` vers getting-started ⇒ **le owner était
 * bloqué**, sans autre issue que deviner qu'il doit créer un rôle sur Discord.
 */
describe("F. aucun rôle éligible (guilde à un seul @everyone) : plus de cul-de-sac", () => {
    const LAYOUT = readFileSync("src/app/dashboard/[guildId]/layout.tsx", "utf8");
    const MODAL = readFileSync("src/components/admin/onboarding-blocker-modal.tsx", "utf8");

    it("F1 — @everyone et les rôles managés ne sont jamais proposés", () => {
        expect(LAYOUT).toMatch(/r\.id !== guildId && !r\.managed && r\.name/);
        expect(LAYOUT).toMatch(/fetchGuildRoles\(guildId, \{ excludeManaged: false \}\)/);
    });

    it("F2 — l'étape 2 donne les 3 gestes exacts, le lien Discord et le rechargement", () => {
        expect(MODAL).toMatch(/Aucun rôle éligible sur ce serveur/);
        expect(MODAL).toMatch(/discord\.com\/channels\/\$\{guildId\}\/settings\/roles/);
        expect(MODAL).toMatch(/Recharger les rôles/);
        expect(MODAL).toMatch(/startReload\(\(\) => router\.refresh\(\)\)/);
        expect(MODAL).toMatch(/@everyone ne[\s\S]{0,90}convient jamais/);
    });

    it("F3 — la règle reste fail-closed : aucun contournement par @everyone", () => {
        // Le garde-fou qui fait foi est côté serveur (testé dans `mandatory-onboarding.test.ts`).
        // La modale ne doit offrir aucun chemin d'écriture avec @everyone.
        expect(MODAL).not.toMatch(/bypassOnboarding|skipMandatoryOnboarding|canSubmitWithEveryone/);
    });
});

/**
 * E-Z. Mise en route « zéro client perdu » (22/09/2026) : les règles qui décident de
 * la prochaine action et du rôle d'accès, plus les câblages qui les rendent visibles.
 */
describe("onboarding — prochaine action et rôle d'accès A→Z", () => {
    const EVERYONE = "1545599253949325322";
    const step = (over: Partial<{ id: string; status: string; mandatory: boolean }> = {}) => ({
        id: over.id ?? "x",
        title: over.id ?? "x",
        href: `/dashboard/g/${over.id ?? "x"}`,
        status: (over.status ?? "TO_DO") as "COMPLETED" | "IN_PROGRESS" | "TO_DO",
        mandatory: over.mandatory ?? false,
        points: 10,
    });

    it("E1 — une obligation passe AVANT une recommandation déjà entamée", () => {
        const next = getNextOnboardingAction([
            step({ id: "presentation", status: "IN_PROGRESS" }),
            step({ id: "rbac", mandatory: true }),
        ]);
        expect(next?.id).toBe("rbac");
    });

    it("E2 — obligations faites : la recommandation ENTAMÉE est proposée (pas la 1ʳᵉ de la liste)", () => {
        const next = getNextOnboardingAction([
            step({ id: "discord", status: "TO_DO" }),
            step({ id: "modules", status: "IN_PROGRESS" }),
        ]);
        expect(next?.id).toBe("modules");
    });

    it("E3 — tout est fait : aucune action (la page ne propose rien)", () => {
        expect(getNextOnboardingAction([step({ id: "a", status: "COMPLETED" })])).toBeNull();
        expect(getNextOnboardingAction([])).toBeNull();
    });

    it("E4 — le rôle d'accès n'est créé QUE sur un serveur sans rôle utilisable", () => {
        const managed = [{ id: "999", name: "Bot", managed: true }];
        expect(shouldCreateDashboardAccessRole([{ id: EVERYONE, name: "@everyone" }], EVERYONE)).toBe(true);
        expect(shouldCreateDashboardAccessRole(managed, EVERYONE)).toBe(true);
        expect(shouldCreateDashboardAccessRole([], EVERYONE)).toBe(true);
        // Un rôle réel existe ⇒ l'admin choisit le sien, on ne pollue pas son serveur.
        expect(shouldCreateDashboardAccessRole([{ id: "1", name: "Membres" }], EVERYONE)).toBe(false);
        // @everyone et rôles managés ne sont jamais « assignables ».
        expect(pickAssignableRoles([{ id: EVERYONE, name: "@everyone" }, ...managed], EVERYONE)).toEqual([]);
    });

    it("E5 — le rôle d'accès est reconnu malgré accents/casse (pré-sélection de l'étape 2)", () => {
        const roles = [{ id: "5", name: "ACCÈS  dashboard" }, { id: "6", name: "Membres" }];
        expect(pickDashboardAccessRolePreselect(roles, EVERYONE)?.id).toBe("5");
        expect(pickDashboardAccessRolePreselect([{ id: "7", name: "Membres" }], EVERYONE)).toBeNull();
        expect(DASHBOARD_ACCESS_ROLE_NAME).toBe("Accès Dashboard");
    });

    it("E6 — getting-started : un CTA unique calculé côté SERVEUR (plus 7 cartes équivalentes)", () => {
        const code = readFileSync("src/app/dashboard/[guildId]/admin/getting-started/page.tsx", "utf8");
        expect(code).toContain("progress.nextAction");
        expect(code).toContain("Votre prochaine action");
        expect(readFileSync("src/server/actions/onboarding-actions.ts", "utf8")).toContain(
            "nextAction: getNextOnboardingAction(steps)",
        );
    });

    it("E7 — « modules configurés » : le REGISTRE décide (la liste de 14 clés a disparu)", () => {
        const actions = readFileSync("src/server/actions/onboarding-actions.ts", "utf8");
        expect(actions).not.toContain("countEnabledModules");
        expect(actions).toContain("COUNTED_MODULE_KEYS.some");
    });

    it("E8 — cul-de-sac @everyone : pré-sélection + création du rôle depuis la modale", () => {
        const code = readFileSync("src/components/admin/onboarding-blocker-modal.tsx", "utf8");
        expect(code).toContain("pickDashboardAccessRolePreselect(roles, guildId)");
        expect(code).toContain("ensureDashboardAccessRole(guildId)");
        expect(code).toContain("Créer le rôle « {DASHBOARD_ACCESS_ROLE_NAME} »");
    });

    it("E9 — le rôle est créé À L'ACTIVATION de la guilde (le cul-de-sac n'arrive plus)", () => {
        const code = readFileSync("src/server/actions/admin-actions.ts", "utf8");
        expect(code).toMatch(/await ensureDashboardAccessRoleCore\(guildId, discordUserId\)/);
        // …et l'action reste réservée aux admins Discord + rate-limitée (fail-closed).
        expect(code).toMatch(/requireGuildAdmin\(guildId, "Création du rôle d'accès au dashboard"/);
        expect(code).toContain("ensureAccessRole:${session.user.id}");
    });

    it("E10 — least privilege : le rôle créé ne porte AUCUN droit Discord", () => {
        const code = readFileSync("src/server/discord.ts", "utf8");
        expect(code).toMatch(/export async function createGuildRole/);
        expect(code).toContain('permissions: "0"');
        expect(code).toMatch(/\/api\/v10\/guilds\/\$\{guildId\}\/roles/);
    });

    it("E11 — wizard : le pseudo validé à l'étape 1 n'est plus rejoué au ladder à l'étape 2", () => {
        const code = readFileSync("src/components/dashboard/onboarding-wizard.tsx", "utf8");
        expect(code).toContain("setPseudoSaved(true)");
        expect(code).toMatch(/\.\.\.\(pseudoSaved \? \{\} : \{ pseudoDofus: pseudo\.trim\(\) \}\)/);
        expect(code).not.toContain("pseudo.trim() !== initialPseudo");
    });

    it("E12 — 2ᵉ modale : « Plus tard » n'est plus un primaire vert, la fermeture est explicite", () => {
        const code = readFileSync("src/components/admin/onboarding-next-steps-modal.tsx", "utf8");
        expect(code).not.toContain("hover:bg-success "); // hover mort (invisible)
        expect(code).toContain("Plus tard — ne plus afficher");
        expect(code).toContain('aria-labelledby="onboarding-next-steps-title"');
    });
});
