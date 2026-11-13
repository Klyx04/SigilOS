/**
 * 🎫 Tickets — **one-shot R2** (fin v1, message d'ouverture unifié, boutons par
 * motif, slug FR).
 *
 * Verrouille la refonte demandée sur le comparatif TicketTool :
 *   · la v1 est morte (refus motivé, migration auto, plus aucun texte « à convertir ») ;
 *   · le résumé des listes ne part plus sur Discord ;
 *   · les boutons se retirent/renomment par motif (héritage du global sinon) ;
 *   · aucun nom de contrainte Prisma ne fuit côté client.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
    readTicketMotifButtons,
    readTicketPermissionSettings,
    resolveTicketButtonForMotif,
    ticketButtonLayoutForMotif,
} from "@/lib/tickets/category-permissions";
import { buildActionRows } from "@/lib/tickets/embeds";

const ACTIONS = "src/server/actions/ticket-bot-actions.ts";
const PERMISSIONS_LIB = "src/lib/tickets/category-permissions.ts";
const MOTIFS_TAB =
    "src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-motifs-tab.tsx";
const PANELS_TAB =
    "src/app/dashboard/[guildId]/tickets/_components/tabs/ticket-panels-tab.tsx";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Retire les commentaires : on vérifie le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Corps d'une fonction, du `function <nom>` à l'accolade fermante. */
function functionBody(source: string, name: string): string {
    const start = source.indexOf(`function ${name}`);
    if (start === -1) return "";
    const end = source.indexOf("\n}\n", start);
    return end === -1 ? source.slice(start) : source.slice(start, end + 3);
}

describe("one-shot R2 — surcharge de boutons par motif (pur)", () => {
    it("lit une surcharge partielle et ignore le bruit", () => {
        expect(
            readTicketMotifButtons({
                close: { disabled: true },
                claim: { label: "  Je m'en occupe  " },
                delete: { disabled: false },
                reopen: "pas un objet",
                transcript: { label: "   " },
                unknown: { disabled: true },
            })
        ).toEqual({
            close: { disabled: true },
            claim: { label: "Je m'en occupe" },
        });
    });

    it("illisible = héritage total (jamais d'exception)", () => {
        expect(readTicketMotifButtons(null)).toEqual({});
        expect(readTicketMotifButtons("x")).toEqual({});
        expect(readTicketMotifButtons([])).toEqual({});
    });

    it("borne le libellé surchargé à 80 caractères", () => {
        const parsed = readTicketMotifButtons({ close: { label: "x".repeat(200) } });
        expect(parsed.close?.label?.length).toBeLessThanOrEqual(80);
    });

    it("la surcharge survit à la lecture des réglages", () => {
        const settings = readTicketPermissionSettings({
            categories: { motif1: { closePolicy: "STAFF_ONLY", buttons: { close: { disabled: true } } } },
        });
        expect(settings.categories.motif1?.buttons).toEqual({ close: { disabled: true } });
    });

    it("`disabled` du motif retire le bouton, le libellé le renomme", () => {
        const disabled = resolveTicketButtonForMotif("close", { close: { disabled: true } }, null);
        expect(disabled.access).toBe("disabled");

        const renamed = resolveTicketButtonForMotif("close", { close: { label: "Fermer SVP" } }, null);
        expect(renamed.access).not.toBe("disabled");
        expect(renamed.label).toBe("Fermer SVP");
    });

    it("sans surcharge, le global puis le défaut restrictif s'appliquent", () => {
        const untouched = resolveTicketButtonForMotif("close", {}, null);
        expect(untouched.access).toBe("staff_or_creator");
        const global = resolveTicketButtonForMotif(
            "claim",
            {},
            { claim: { access: "disabled" } }
        );
        expect(global.access).toBe("disabled");
    });

    it("le plan du motif retire les `disabled` (ouvert comme fermé)", () => {
        const open = ticketButtonLayoutForMotif("OPEN", { claim: { disabled: true } }, null);
        expect(open.map((button) => button.key)).toEqual(["close"]);
        const closed = ticketButtonLayoutForMotif("CLOSED", { delete: { disabled: true } }, null);
        expect(closed.map((button) => button.key)).toEqual(["reopen", "transcript"]);
    });

    it("`buildActionRows` honore la surcharge du motif", () => {
        const rows = buildActionRows({
            ticketId: "t1",
            status: "OPEN",
            buttons: null,
            motifButtons: { close: { disabled: true } },
        });
        expect(rows[0]?.components.map((component: { custom_id?: string }) => component.custom_id)).toEqual([
            "tb:claim:t1",
        ]);
        const renamed = buildActionRows({
            ticketId: "t1",
            status: "OPEN",
            buttons: null,
            motifButtons: { claim: { label: "Je prends" } },
        });
        expect(renamed[0]?.components[0]).toMatchObject({ label: "Je prends" });
    });
});

describe("one-shot R2 — aucun nom de contrainte ne fuit côté client", () => {
    it("le message de doublon est FR et ne cite aucune contrainte", () => {
        // La constante vit dans le lib (une action `"use server"` ne peut
        // exporter que des fonctions async) : on la lit là où elle vit.
        const source = read(PERMISSIONS_LIB);
        const match = source.match(/TICKET_MOTIF_DUPLICATE_MESSAGE\s*=\s*"([^"]+)"/);
        expect(match, "constante TICKET_MOTIF_DUPLICATE_MESSAGE introuvable").not.toBeNull();
        const message = match?.[1] ?? "";
        expect(message).toContain("Recharge");
        expect(message).not.toContain("TicketForm_guildId_slug_key");
        expect(message).not.toContain("P2002");
        expect(message.toLowerCase()).not.toContain("prisma");
    });

    it("le serveur mappe `P2002` (création parcours, formulaire, garde-fou global)", () => {
        const code = codeOnly(read(ACTIONS));
        expect((code.match(/P2002/g) || []).length).toBeGreaterThanOrEqual(3);
        expect(code).toContain("TICKET_MOTIF_DUPLICATE_MESSAGE");
    });

    it("`saveTicketFormAction` ne laisse jamais fuir le brut (course double-clic)", () => {
        const body = codeOnly(functionBody(read(ACTIONS), "saveTicketFormAction"));
        expect(body, "saveTicketFormAction introuvable").not.toBe("");
        expect(body).toContain("P2002");
        expect(body).toContain("TICKET_MOTIF_DUPLICATE_MESSAGE");
    });

    it("la migration auto reprend le formulaire gagnant au lieu d'exploser en P2002", () => {
        const body = codeOnly(functionBody(read(ACTIONS), "migrateCategoriesToMotifsAction"));
        expect(body, "migrateCategoriesToMotifsAction introuvable").not.toBe("");
        // Idempotence : réutilise le `q-<slug>` existant avant tout create…
        expect(body).toContain("slug: formSlug");
        // …reprend le gagnant sur course, et le filet final traduit P2002 en FR.
        expect(body).toContain("P2002");
        expect(body).toContain("TICKET_MOTIF_DUPLICATE_MESSAGE");
    });
});

describe("one-shot R2 — la v1 est morte côté serveur", () => {
    it("une catégorie héritée est refusée avec un message qui guide vers le dashboard", () => {
        const code = codeOnly(read(ACTIONS));
        expect(code).toContain("Ce bouton vient d'une ancienne catégorie");
        // Plus aucun salon créé depuis une catégorie : la création ne connaît
        // que le parcours (la migration, elle, lit encore les catégories : c'est
        // son travail de les convertir).
        const create = codeOnly(functionBody(read(ACTIONS), "internalHandleTicketCreate"));
        expect(create).not.toContain("createTicketChannelDiscord(");
        expect(create).not.toContain("ticketBotCategory");
        expect(create).not.toContain("category.namingPattern");
    });

    it("l'accueil ne mélange plus le résumé des listes (texte du motif + notice)", () => {
        const code = codeOnly(read(ACTIONS));
        expect(code).toContain("[categoryOverride?.welcomeMessage, notice]");
        expect(code).not.toContain("journey.description, notice");
    });

    it("l'ouverture et les patchs portent la surcharge de boutons du motif", () => {
        const code = codeOnly(read(ACTIONS));
        expect((code.match(/motifButtons: /g) || []).length).toBeGreaterThanOrEqual(5);
        expect(code).toContain("motifButtonsOf(");
    });

    it("la migration bascule les panneaux sur les parcours (fini les vieux boutons)", () => {
        const code = codeOnly(read(ACTIONS));
        expect(code).toContain("categoryIds: panel.categoryIds.filter(");
    });
});

describe("one-shot R2 — fini les textes « à convertir » côté UI", () => {
    it("l'onglet Types de demande migre tout seul, sans bouton ni bannière", () => {
        const code = codeOnly(read(MOTIFS_TAB));
        expect(code).not.toContain("Tout convertir en types de demande");
        expect(code).not.toContain("ne sont pas encore converties en types de demande complets");
        expect(code).toContain("migrateCategoriesToMotifsAction(guildId)");
        expect(code).toContain("useEffect");
    });

    it("l'onglet Panneaux n'en parle plus et enregistre 100 % parcours", () => {
        const code = codeOnly(read(PANELS_TAB));
        expect(code).not.toContain("à convertir dans l'onglet");
        expect(code).not.toContain("ancienne(s) catégorie(s)");
        expect(code).toContain("categoryIds: []");
    });

    it("le formulaire est guidé en 5 étapes avec le vocabulaire simple", () => {
        const code = codeOnly(read(MOTIFS_TAB));
        expect(code).toContain("1 · Bouton sur le panneau");
        expect(code).toContain("2 · Message d'ouverture du salon");
        expect(code).toContain("3 · Équipe et accès");
        expect(code).toContain("4 · Fermeture et boutons du salon");
        expect(code).toContain("5 · Questionnaire d'ouverture");
        expect(code).toContain("Équipe qui traite ce motif");
        // 16/10/2026 — le champ s'appelle « Description interne (mémo staff) » ;
        // l'ancien vocabulaire ne doit pas revenir.
        expect(code).toContain("Description interne (mémo staff)");
        expect(code).not.toContain("Résumé affiché sur les listes");
        expect(code).not.toContain("Rôles staff de ce motif");
        expect(code).not.toContain("Courte description (affichée sur les listes)");
    });
});
