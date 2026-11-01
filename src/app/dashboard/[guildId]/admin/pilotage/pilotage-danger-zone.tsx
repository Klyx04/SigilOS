"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestGuildDeletion } from "@/server/actions/guild-lifecycle-actions";
import { GUILD_DELETION_GRACE_DAYS, isDeletionConfirmationValid } from "@/lib/guild-deletion";

/**
 * « Zone sensible » du pilotage — **propriétaire uniquement** (la page ne rend ni l'onglet ni ce
 * bloc pour un simple administrateur, et l'action serveur revérifie la propriété en direct).
 *
 * Le bouton n'est actif que si le nom du serveur est recopié : une action qui coupe l'accès de tous
 * les membres ne doit pas partir d'un clic mal placé.
 */
export function PilotageDangerZone({ guildId, guildName }: { guildId: string; guildName: string }) {
    const router = useRouter();
    const [typed, setTyped] = useState("");
    const [loading, setLoading] = useState(false);
    const confirmed = isDeletionConfirmationValid(typed, guildName);

    const handleDelete = async () => {
        if (!confirmed) return;
        setLoading(true);
        try {
            const result = await requestGuildDeletion(guildId, typed);
            if (result.success) {
                toast.success("Guilde désactivée. Redirection…");
                router.push("/dashboard");
                router.refresh();
                return;
            }
            toast.error(result.error ?? "La désactivation a échoué.");
        } catch {
            toast.error("Erreur de communication avec le serveur.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="rounded-lg border border-danger/30 bg-danger/[0.04] p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
                Supprimer la guilde
            </h2>

            <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>
                    La guilde est <strong className="text-foreground">désactivée immédiatement</strong> : le
                    tableau de bord et toutes les interactions Discord cessent de répondre.
                </li>
                <li>
                    Les profils des membres sont <strong className="text-foreground">archivés</strong> — aucune
                    donnée personnelle n&apos;est supprimée à ce stade.
                </li>
                <li>
                    La suppression définitive est planifiée à{" "}
                    <strong className="text-foreground">J+{GUILD_DELETION_GRACE_DAYS}</strong> ; d&apos;ici là, le
                    support peut restaurer la guilde.
                </li>
                <li>Le bot reste sur le serveur : rien à réinviter en cas de restauration.</li>
            </ul>

            <div className="space-y-2">
                <label htmlFor="confirm-guild-name" className="block text-xs text-muted-foreground">
                    Recopie le nom du serveur pour confirmer :{" "}
                    <span className="font-semibold text-foreground">{guildName}</span>
                </label>
                <input
                    id="confirm-guild-name"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:border-danger/60"
                />
            </div>

            <button
                type="button"
                onClick={handleDelete}
                disabled={!confirmed || loading}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-danger-foreground transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{loading ? "Suppression…" : "Supprimer la guilde"}</span>
            </button>
        </section>
    );
}
