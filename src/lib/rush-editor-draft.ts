/**
 * Brouillon local du formulaire de quête — **règle pure** (E2b-suite 2/2, 12/11/2026).
 *
 * 🎯 Mesure : dans le studio, un rechargement de page (ou un crash navigateur) perdait
 * toute saisie non enregistrée. Le brouillon est stocké **par quête** dans le navigateur,
 * restauré au montage, et **jeté à l'enregistrement**.
 *
 * 🛡️ Borné (Zod, 4 000 caractères par champ) et fail-closed : un JSON illisible ou une
 * forme inattendue renvoie `null` — on garde alors les valeurs de la base, jamais un
 * brouillon douteux. Les donjons, tags et positions ne sont pas couverts (saisie
 * structurée) : le brouillon couvre les champs texte et la route.
 */

import { z } from "zod";

const DraftField = z.string().max(4000);

export const rushEditorDraftSchema = z.object({
    name: DraftField,
    note: DraftField,
    tips: DraftField,
    dofusdbUrl: DraftField,
    noobsUrl: DraftField,
    alignReq: DraftField,
    alignOrderCode: DraftField,
    alignLevelReq: DraftField,
    classReq: DraftField,
    metamobMonsterId: DraftField,
    icon: DraftField,
    bontaName: DraftField,
    bontaTips: DraftField,
    brakName: DraftField,
    brakTips: DraftField,
    isSuccess: z.boolean(),
});

export type RushEditorDraft = z.infer<typeof rushEditorDraftSchema>;

export const RUSH_EDITOR_DRAFT_PREFIX = "rush-editor-draft:";

/** Clé de stockage d'une quête — stable, jamais recalculée depuis le nom. */
export function rushEditorDraftKey(sequenceId: string): string {
    return `${RUSH_EDITOR_DRAFT_PREFIX}${sequenceId}`;
}

/** Lit un brouillon : `null` si absent, illisible ou hors bornes (fail-closed). */
export function parseRushEditorDraft(raw: string | null | undefined): RushEditorDraft | null {
    if (!raw) return null;
    try {
        const parsed = rushEditorDraftSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/** Sérialise un brouillon — re-borne par le schéma avant écriture. */
export function serializeRushEditorDraft(draft: RushEditorDraft): string {
    return JSON.stringify(rushEditorDraftSchema.parse(draft));
}
