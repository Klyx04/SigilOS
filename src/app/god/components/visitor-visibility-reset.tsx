"use client";

/**
 * God — visiteurs (V3-b) : bouton de **réinitialisation de visibilité**.
 *
 * Réversible et journalisé : les trois consentements repassent à `false`. Le
 * visiteur reste libre de les réactiver depuis son espace. Aucune suppression.
 */

import { useTransition } from "react";
import { ShieldOff, UserX, Ban } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { resetGodVisitorVisibility, deleteGodVisitorUser } from "@/server/actions/god-visitor-actions";
import { banEntity } from "@/server/actions/god-lifecycle-actions";

export function VisitorVisibilityReset({
    profileId,
    pseudo,
}: {
    profileId: string;
    pseudo: string | null;
}) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const handleClick = () => {
        const name = pseudo ?? "ce profil";
        if (!confirm(`Masquer toutes les visibilités de ${name} ? Il pourra les réactiver lui-même.`)) {
            return;
        }
        startTransition(async () => {
            const res = await resetGodVisitorVisibility({ profileId });
            if (res.success) {
                toast.success("Visibilités réinitialisées");
                router.refresh();
            } else {
                toast.error(res.error || "Échec de la réinitialisation");
            }
        });
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            aria-label={pseudo ? `Réinitialiser les visibilités de ${pseudo}` : "Réinitialiser les visibilités"}
            title="Masquer les trois visibilités (réversible et journalisé)"
            className="shrink-0 rounded-lg border border-border bg-elevated p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
        </button>
    );
}

/**
 * V3-c — actions **destructives** de la fiche visiteur.
 *
 * · « Bannir » : `PlatformBan` (l'identifiant Discord est conservé).
 * · « Bannir + supprimer » : ban **puis** suppression complète du `User`
 *   (cascade). Confirmation par saisie de `SUPPRIMER`.
 * · Refusé si le compte possède une guilde (le serveur le vérifie aussi).
 */
export function VisitorDestructiveActions({
    profileId,
    pseudo,
    discordId,
    ownsGuild,
}: {
    profileId: string;
    pseudo: string | null;
    discordId: string | null;
    ownsGuild: boolean;
}) {
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const name = pseudo ?? "ce compte";

    const handleBan = () => {
        if (!discordId) {
            toast.error("Aucun compte Discord lié — bannissement impossible.");
            return;
        }
        if (!confirm(`Bannir ${name} de la plateforme ? L'accès est bloqué, le compte reste en base.`)) return;
        startTransition(async () => {
            const res = await banEntity("USER", discordId, "Bannissement depuis la fiche visiteur (God)");
            if (res.success) {
                toast.success("Compte Discord banni");
                router.refresh();
            } else {
                toast.error(res.error || "Échec du bannissement");
            }
        });
    };

    const handleDelete = () => {
        if (!confirm(`Supprimer DÉFINITIVEMENT ${name} et toutes ses données ? Cette action est irréversible.`)) return;
        const typed = prompt("Saisis SUPPRIMER pour confirmer :");
        if (typed !== "SUPPRIMER") {
            toast.error("Suppression annulée");
            return;
        }
        startTransition(async () => {
            const res = await deleteGodVisitorUser({ profileId });
            if (res.success) {
                toast.success(res.banned ? "Compte supprimé et Discord banni" : "Compte supprimé");
                router.refresh();
            } else {
                toast.error(res.error || "Échec de la suppression");
            }
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleBan}
                    disabled={pending || ownsGuild || !discordId}
                    className="inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning transition-colors hover:bg-warning/20 disabled:opacity-50"
                >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Bannir
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pending || ownsGuild}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                >
                    <UserX className="h-4 w-4" aria-hidden="true" />
                    Bannir + supprimer
                </button>
            </div>
            {ownsGuild ? (
                <p className="text-xs text-muted-foreground">
                    Ce compte possède une guilde : transfère la propriété avant de le bannir ou de le supprimer.
                </p>
            ) : !discordId ? (
                <p className="text-xs text-muted-foreground">
                    Aucun compte Discord lié : seul le compte local peut être supprimé.
                </p>
            ) : null}
        </div>
    );
}

