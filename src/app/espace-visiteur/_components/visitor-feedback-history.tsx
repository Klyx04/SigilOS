import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { VisitorFeedbackButton } from "@/components/feedback/visitor-feedback-button";
import { TRACKER_STATUS_LABELS, type TrackerStatusValue } from "@/lib/feedback-ticket-mapping";
import type { MyVisitorFeedbackItem } from "@/server/actions/feedback-actions";

const STATUS_CLASS: Record<TrackerStatusValue, string> = {
    A_FAIRE: "border-border bg-elevated text-muted-foreground",
    A_INVESTIGUER: "border-danger/30 bg-danger/10 text-danger",
    EN_COURS: "border-warning/30 bg-warning/10 text-warning",
    TERMINE: "border-success/30 bg-success/10 text-success",
    IGNORE: "border-border bg-transparent text-muted-foreground",
};

/**
 * Historique personnel des signalements d'un visiteur connecté.
 * Aucune donnée interne n'est affichée : référence publique, statut, texte,
 * et réponses que l'équipe a explicitement rendues visibles.
 */
export function VisitorFeedbackHistory({ items }: { items: MyVisitorFeedbackItem[] }) {
    return (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">Mes signalements</h2>
                    <p className="text-sm text-muted-foreground">
                        Retrouve ici les retours que tu as envoyés et les réponses de l&apos;équipe.
                    </p>
                </div>
                <VisitorFeedbackButton sourcePage="espace-visiteur:general" compact />
            </div>

            {items.length === 0 ? (
                <p className="rounded-lg border border-border bg-background px-3 py-4 text-sm text-muted-foreground">
                    Aucun signalement pour le moment. Un bug, une idée ? Le bouton « Signaler » est là.
                </p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => (
                        <li key={item.ref} className="space-y-2 rounded-lg border border-border bg-background p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{item.ref}</span>
                                <span className={`rounded-lg border px-2 py-0.5 text-caption font-medium ${STATUS_CLASS[item.status]}`}>
                                    {TRACKER_STATUS_LABELS[item.status]}
                                </span>
                                <span className="text-caption text-muted-foreground">
                                    {format(new Date(item.createdAt), "dd MMM yyyy", { locale: fr })}
                                </span>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.description}</p>
                            {item.replies.length > 0 && (
                                <div className="space-y-1.5 border-t border-border pt-2">
                                    <p className="flex items-center gap-1.5 text-caption font-medium text-foreground">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Réponses de l&apos;équipe
                                    </p>
                                    <ul className="space-y-1.5">
                                        {item.replies.map((reply, index) => (
                                            <li key={`${reply.at}-${index}`} className="text-sm text-muted-foreground">
                                                {reply.emoji ? `${reply.emoji} ` : ""}{reply.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
