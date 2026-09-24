"use client";

/**
 * Commentaires du registre — modale unique : journal du membre (du plus ancien
 * au plus récent, avec la date exacte et son auteur) et ajout jusqu'au plafond
 * (10). Ouverte depuis la colonne « Commentaires » comme depuis la modale
 * d'édition : une seule source, aucun doublon d'écran.
 */
import { useState, useTransition } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    MAX_REGISTRY_COMMENTS,
    REGISTRY_COMMENT_MAX_LENGTH,
    canAddRegistryComment,
    sortRegistryComments,
    type RegistryComment,
} from "@/lib/member-registry";
import { addMemberRegistryComment } from "@/server/actions/member-lifecycle-actions";

interface MemberRegistryCommentsDialogProps {
    guildId: string;
    profileId: string;
    memberName: string;
    comments: RegistryComment[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Relecture du registre après un ajout réussi. */
    onAdded: () => void;
    canManageMembers: boolean;
}

export function MemberRegistryCommentsDialog({
    guildId,
    profileId,
    memberName,
    comments,
    open,
    onOpenChange,
    onAdded,
    canManageMembers,
}: MemberRegistryCommentsDialogProps) {
    const [draft, setDraft] = useState("");
    const [isPending, startTransition] = useTransition();
    const ordered = sortRegistryComments(comments);
    const canAdd = canManageMembers && canAddRegistryComment(comments.length);

    const submit = () => {
        const body = draft.trim();
        if (!body) {
            toast.error("Commentaire vide");
            return;
        }
        startTransition(async () => {
            const res = await addMemberRegistryComment(guildId, { profileId, body });
            if (!res.success) {
                toast.error(res.error || "Commentaire non enregistré");
                return;
            }
            toast.success("Commentaire ajouté");
            setDraft("");
            onAdded();
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Commentaires — {memberName}</DialogTitle>
                    <DialogDescription>
                        Journal du staff : {comments.length}/{MAX_REGISTRY_COMMENTS}, du plus ancien au plus récent.
                        Chaque entrée est horodatée et signée.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[45vh] space-y-2.5 overflow-y-auto">
                    {ordered.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">Aucun commentaire pour l&apos;instant.</p>
                    ) : (
                        ordered.map((c) => (
                            <div key={c.id} className="rounded-xl border border-border/70 bg-surface/50 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                    <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                        {new Date(c.createdAt).toLocaleString("fr-FR")}
                                    </span>
                                </div>
                                <p className="mt-1.5 whitespace-pre-wrap text-xs text-foreground/90">{c.body}</p>
                            </div>
                        ))
                    )}
                </div>

                {canAdd ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="registry-comment-draft">Nouveau commentaire</Label>
                        <Textarea
                            id="registry-comment-draft"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={2}
                            maxLength={REGISTRY_COMMENT_MAX_LENGTH}
                            placeholder="Ce qui doit rester écrit : raison d'une prolongation, incident, contexte…"
                        />
                    </div>
                ) : (
                    <p className="text-[11px] text-muted-foreground">
                        {canManageMembers
                            ? `Plafond de ${MAX_REGISTRY_COMMENTS} commentaires atteint.`
                            : "Permission « Gérer les membres » requise pour ajouter un commentaire."}
                    </p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Fermer
                    </Button>
                    {canAdd && (
                        <Button onClick={submit} disabled={isPending} className="gap-1.5">
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            Ajouter
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
