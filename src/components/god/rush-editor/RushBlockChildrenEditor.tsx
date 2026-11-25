"use client";

/**
 * Éditeur des **sous-blocs** d'un bloc du Rush (Tips, Obtention Dofus, Séparateur, Combat).
 *
 * Pourquoi : ces types existaient uniquement au niveau du guide ; le studio les forçait en
 * chapitre 0, donc impossible de poser une « Obtention Dofus » **après une quête d'un bloc**.
 * Ici, la position est choisie parmi les quêtes du bloc (`order + 0.5`) ou « fin du bloc ».
 *
 * Le sous-bloc ne participe ni à la progression ni à la route : il ne change aucun compteur.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
    RUSH_CHILD_POSITION_END,
    RUSH_CHILD_TYPES,
    isRushChildType,
    rushChildPositionAfter,
} from "@/lib/rush-block-children";
import { RUSH_DOFUS_META } from "@/lib/rush-dofus-meta";
import {
    createRushMilestoneChild,
    deleteRushMilestoneChild,
    updateRushMilestoneChild,
} from "@/server/actions/optimized-guide-actions";
import type { RushMilestoneChild, RushMilestoneChildType } from "@/types/rush-guide-types";

type SequenceOption = {
    id: string;
    order: number;
    subGuideName?: string | null;
    subGuideRef?: string | null;
};

type ChildDraft = {
    type: RushMilestoneChildType;
    title: string;
    description: string;
    tips: string;
    dofusId: string | null;
    imageUrl: string;
    position: number;
};

const TYPE_LABEL: Record<RushMilestoneChildType, string> = {
    INFO: "Conseil / Tips",
    DOFUS_OBTAINED: "Obtention Dofus",
    SEPARATEUR: "Séparateur",
    COMBAT_TACTIQUE: "Combat tactique",
    COMBAT_SEMI_TACTIQUE: "Combat semi-tactique",
};

const DEFAULT_TITLE: Record<RushMilestoneChildType, string> = {
    INFO: "Nouveau conseil",
    DOFUS_OBTAINED: "Obtention Dofus",
    SEPARATEUR: "Nouvelle section",
    COMBAT_TACTIQUE: "Combat tactique",
    COMBAT_SEMI_TACTIQUE: "Combat semi-tactique",
};

function sequenceLabel(sequence: SequenceOption): string {
    return sequence.subGuideName?.trim() || sequence.subGuideRef?.trim() || "Quête";
}

function childToDraft(child: RushMilestoneChild): ChildDraft {
    return {
        type: isRushChildType(child.type) ? child.type : "INFO",
        title: child.title ?? "",
        description: child.description ?? "",
        tips: child.tips ?? "",
        dofusId: child.dofusId ?? null,
        imageUrl: child.imageUrl ?? "",
        position: Number.isFinite(child.position) ? child.position : RUSH_CHILD_POSITION_END,
    };
}

function positionLabel(position: number, sequences: readonly SequenceOption[]): string {
    if (position >= RUSH_CHILD_POSITION_END) return "Fin du bloc";
    const after = [...sequences]
        .filter((sequence) => sequence.order <= position)
        .sort((a, b) => b.order - a.order)[0];
    return after ? `Après ${sequenceLabel(after)}` : "Début du bloc";
}

export function RushBlockChildrenEditor({
    milestoneId,
    sequences,
    childBlocks,
}: {
    milestoneId: string;
    sequences: readonly SequenceOption[];
    childBlocks: readonly RushMilestoneChild[];
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<ChildDraft | null>(null);

    const sortedChildren = [...childBlocks].sort(
        (a, b) => a.position - b.position || a.order - b.order
    );

    const create = async (type: RushMilestoneChildType) => {
        if (pending) return;
        setPending(true);
        try {
            const res = await createRushMilestoneChild({
                milestoneId,
                type,
                title: DEFAULT_TITLE[type],
                position: RUSH_CHILD_POSITION_END,
            });
            if (!res?.success || !res.child) throw new Error("Création refusée");
            const child = res.child;
            setEditingId(child.id);
            setDraft({
                type: isRushChildType(child.type) ? child.type : type,
                title: child.title ?? DEFAULT_TITLE[type],
                description: child.description ?? "",
                tips: child.tips ?? "",
                dofusId: child.dofusId ?? null,
                imageUrl: child.imageUrl ?? "",
                position: Number(child.position) || RUSH_CHILD_POSITION_END,
            });
            router.refresh();
            toast.success("Sous-bloc créé");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur");
        } finally {
            setPending(false);
        }
    };

    const startEdit = (child: RushMilestoneChild) => {
        setEditingId(child.id);
        setDraft(childToDraft(child));
    };

    const save = async () => {
        if (!editingId || !draft || pending) return;
        setPending(true);
        try {
            const res = await updateRushMilestoneChild({
                id: editingId,
                milestoneId,
                type: draft.type,
                title: draft.title,
                description: draft.description || null,
                tips: draft.tips || null,
                dofusId: draft.dofusId || null,
                imageUrl: draft.imageUrl || null,
                position: draft.position,
            });
            if (!res?.success) throw new Error("Enregistrement refusé");
            setEditingId(null);
            setDraft(null);
            router.refresh();
            toast.success("Sous-bloc enregistré");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur");
        } finally {
            setPending(false);
        }
    };

    const remove = async (id: string) => {
        if (pending) return;
        setPending(true);
        try {
            const res = await deleteRushMilestoneChild(id);
            if (!res?.success) throw new Error("Suppression refusée");
            if (editingId === id) {
                setEditingId(null);
                setDraft(null);
            }
            router.refresh();
            toast.success("Sous-bloc supprimé");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur");
        } finally {
            setPending(false);
        }
    };

    const update = (patch: Partial<ChildDraft>) =>
        setDraft((current) => (current ? { ...current, ...patch } : current));

    return (
        <div className="space-y-2 rounded-xl border border-border p-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                    Sous-blocs ({sortedChildren.length})
                </p>
                <div className="flex flex-wrap gap-1">
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => create("INFO")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-caption font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
                    >
                        <Plus className="h-3 w-3" aria-hidden /> Tips
                    </button>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => create("DOFUS_OBTAINED")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-caption font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
                    >
                        <Plus className="h-3 w-3" aria-hidden /> Obtention Dofus
                    </button>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => create("COMBAT_SEMI_TACTIQUE")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-caption font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
                    >
                        <Plus className="h-3 w-3" aria-hidden /> Combat
                    </button>
                </div>
            </div>

            {sortedChildren.length === 0 && !draft ? (
                <p className="text-caption text-muted-foreground">
                    Aucun sous-bloc : un Tips ou une Obtention Dofus peut se poser après une quête du bloc.
                </p>
            ) : (
                <ul className="space-y-1">
                    {sortedChildren.map((child) => (
                        <li
                            key={child.id}
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/40 px-2 py-1"
                        >
                            <span className="rounded-[3px] border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {TYPE_LABEL[isRushChildType(child.type) ? child.type : "INFO"]}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                                {child.title}
                            </span>
                            <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">
                                {positionLabel(child.position, sequences)}
                            </span>
                            <button
                                type="button"
                                onClick={() => startEdit(child)}
                                aria-label={`Modifier ${child.title}`}
                                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <Pencil className="h-3 w-3" aria-hidden />
                            </button>
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => remove(child.id)}
                                aria-label={`Supprimer ${child.title}`}
                                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                            >
                                <Trash2 className="h-3 w-3" aria-hidden />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {draft ? (
                <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
                    <div className="grid gap-1.5 sm:grid-cols-2">
                        <label className="text-caption font-medium text-muted-foreground">
                            Type
                            <select
                                value={draft.type}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    if (isRushChildType(next)) update({ type: next });
                                }}
                                className="mt-0.5 w-full rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-foreground"
                            >
                                {RUSH_CHILD_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {TYPE_LABEL[type]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-caption font-medium text-muted-foreground">
                            Position
                            <select
                                value={String(draft.position)}
                                onChange={(event) => update({ position: Number(event.target.value) })}
                                className="mt-0.5 w-full rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-foreground"
                            >
                                <option value={String(RUSH_CHILD_POSITION_END)}>Fin du bloc</option>
                                {sequences.map((sequence) => (
                                    <option key={sequence.id} value={String(rushChildPositionAfter(sequence.order))}>
                                        Après {sequenceLabel(sequence)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block text-caption font-medium text-muted-foreground">
                        Titre
                        <input
                            value={draft.title}
                            maxLength={120}
                            onChange={(event) => update({ title: event.target.value })}
                            className="mt-0.5 w-full rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-foreground"
                        />
                    </label>

                    {draft.type === "DOFUS_OBTAINED" ? (
                        <div>
                            <p className="text-caption font-medium text-muted-foreground">Dofus obtenu</p>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                                {RUSH_DOFUS_META.map((dofus) => (
                                    <button
                                        key={dofus.id}
                                        type="button"
                                        onClick={() => update({ dofusId: dofus.id })}
                                        title={dofus.label}
                                        className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-caption font-semibold transition-all ${
                                            draft.dofusId === dofus.id
                                                ? "border-border text-foreground"
                                                : "border-border text-muted-foreground opacity-50 hover:opacity-100"
                                        }`}
                                        style={
                                            draft.dofusId === dofus.id
                                                ? { borderColor: dofus.color, background: `${dofus.color}20` }
                                                : undefined
                                        }
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={dofus.imageUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                                        {dofus.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <label className="block text-caption font-medium text-muted-foreground">
                        {draft.type === "SEPARATEUR" ? "Note / position / lien" : "Texte du sous-bloc"}
                        <textarea
                            value={draft.type === "SEPARATEUR" ? draft.description : draft.tips}
                            onChange={(event) =>
                                update(
                                    draft.type === "SEPARATEUR"
                                        ? { description: event.target.value }
                                        : { tips: event.target.value }
                                )
                            }
                            rows={4}
                            maxLength={8000}
                            className="mt-0.5 w-full resize-y rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-foreground"
                            placeholder={
                                draft.type === "SEPARATEUR"
                                    ? "Note, position ou lien affiché sous le titre"
                                    : "Markdown borné : **gras**, *italique*, - liste, {or}…{/or}"
                            }
                        />
                    </label>

                    <label className="block text-caption font-medium text-muted-foreground">
                        Image (URL ou chemin, optionnel)
                        <input
                            value={draft.imageUrl}
                            maxLength={500}
                            onChange={(event) => update({ imageUrl: event.target.value })}
                            className="mt-0.5 w-full rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-foreground"
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            disabled={pending || !draft.title.trim()}
                            onClick={save}
                            className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1 text-caption font-semibold text-success-foreground transition-colors hover:opacity-90 disabled:opacity-40"
                        >
                            <Check className="h-3.5 w-3.5" aria-hidden /> Enregistrer
                        </button>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                                setEditingId(null);
                                setDraft(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden /> Annuler
                        </button>
                        {editingId ? (
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => remove(editingId)}
                                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1 text-caption font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                            >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Supprimer
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
