"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ALIGNMENTS, ORDERS } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { updateMyAlignment } from "../_actions/public-alignment";

/**
 * Modale « Mon alignement » du guide public (V2a-4 — demande user : « on peut toujours pas
 * changer son ali comme la mécanique du guide interne ? »).
 *
 * Cité → Ordre, puis Enregistrer. Deux différences assumées avec l'interne :
 *  · pas de `guildId` (l'écriture vise `PublicProfile` du visiteur connecté, jamais une guilde) ;
 *  · pas de tranche demandée : elle reste **déduite des quêtes validées** par le guide.
 *
 * Le formulaire est propre au visiteur : `AlignmentChoiceForm` (interne) est câblé sur les
 * actions de guilde (`updateUserProfile`, `resetAlignmentProgress`) et ne peut pas être réutilisé.
 */
export function PublicAlignmentModal({
    open,
    onClose,
    alignment,
    alignmentOrder,
    locale = "fr",
    localOnly = false,
    onLocalSave,
}: {
    open: boolean;
    onClose: () => void;
    alignment: string | null;
    alignmentOrder: string | null;
    locale?: "fr" | "en";
    /**
     * V2a-4 — visiteur **non connecté** : le même geste, mais le choix reste LOCAL
     * (il pilote la route via `resolveRushRoute`). Aucune écriture serveur, donc aucune
     * garde à contourner : `save()` n'appelle jamais l'action dans ce mode.
     */
    localOnly?: boolean;
    onLocalSave?: (value: {
        alignment: "bontarien" | "brakmarien" | "neutre";
        alignmentOrder: string | null;
    }) => void;
}) {
    const en = locale === "en";
    const router = useRouter();
    const [camp, setCamp] = useState<"bontarien" | "brakmarien" | null>(null);
    const [order, setOrder] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Le brouillon repart du profil à CHAQUE ouverture, jamais d'une saisie abandonnée.
    useEffect(() => {
        if (!open) return;
        setCamp(alignment === "bontarien" || alignment === "brakmarien" ? alignment : null);
        setOrder(alignmentOrder ?? null);
        setError(null);
    }, [open, alignment, alignmentOrder]);

    const orders = camp
        ? (ORDERS as unknown as Record<string, Array<{ id: string; name: string; icon: string }>>)[camp] ?? []
        : [];

    const option = (active: boolean) =>
        cn(
            "flex items-center gap-1.5 rounded-[4px] border px-2 py-1.5 text-[11px] font-semibold transition-colors",
            active
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
        );

    const save = async () => {
        setSaving(true);
        setError(null);
        const payload = {
            alignment: (camp ?? "neutre") as "bontarien" | "brakmarien" | "neutre",
            alignmentOrder: camp ? order : null,
        };
        // Anonyme : choix LOCAL, aucune écriture serveur (et donc rien à garder côté action).
        if (localOnly) {
            onLocalSave?.(payload);
            setSaving(false);
            toast.success(
                en ? "Alignment saved for this browser" : "Alignement enregistré pour ce navigateur"
            );
            onClose();
            return;
        }
        try {
            const result = await updateMyAlignment(payload);
            if (!result.success) {
                setError(result.error);
                return;
            }
            toast.success(en ? "Alignment updated" : "Alignement mis à jour");
            router.refresh();
            onClose();
        } catch {
            setError(en ? "Could not save." : "Enregistrement impossible.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent className="da-modal da-portal gap-0 p-0 sm:max-w-md">
                <header className="da-modal-head">
                    <DialogTitle className="da-modal-title">{en ? "My alignment" : "Mon alignement"}</DialogTitle>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        {en
                            ? "City and Order — the tier still follows your validated quests."
                            : "Cité et Ordre — la tranche reste déduite de tes quêtes validées."}
                    </p>
                </header>

                <div className="space-y-3 p-4">
                    <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {en ? "City" : "Cité"}
                        </p>
                        <div className="grid grid-cols-3 gap-1">
                            {ALIGNMENTS.map((alg) => {
                                const active = alg.id === "neutre" ? !camp : camp === alg.id;
                                return (
                                    <button
                                        key={alg.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => {
                                            setCamp(
                                                alg.id === "neutre" ? null : (alg.id as "bontarien" | "brakmarien")
                                            );
                                            setOrder(null);
                                        }}
                                        className={option(active)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={alg.icon} alt="" className="h-4 w-4 object-contain" />
                                        <span className="truncate">{alg.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {camp && (
                        <div>
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {en ? "Order" : "Ordre"}
                            </p>
                            <div className="space-y-1">
                                {orders.map((ord) => {
                                    const active = order === ord.id;
                                    return (
                                        <button
                                            key={ord.id}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => setOrder(active ? null : ord.id)}
                                            className={cn(option(active), "w-full text-left")}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={ord.icon} alt="" className="h-4 w-4 object-contain" />
                                            <span className="truncate">{ord.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {error && <p className="text-[11px] text-danger">{error}</p>}
                </div>

                <footer className="da-modal-foot">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {en ? "Cancel" : "Annuler"}
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-[4px] border border-success/50 bg-success/15 px-2.5 py-1.5 text-[11px] font-semibold text-success transition-colors hover:bg-success/25 disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                        {en ? "Save" : "Enregistrer"}
                    </button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}