import Link from "next/link";
import { Clock, BookOpen } from "lucide-react";
import type { Guide } from "@/content/guides";

interface GuidesGridProps {
    guides: readonly Guide[];
}

export function GuidesGrid({ guides }: GuidesGridProps) {
    if (guides.length === 0) {
        return (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center">
                <p className="text-sm font-medium text-muted-foreground">Aucun guide publié pour le moment.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guides.map((guide) => (
                <Link
                    key={guide.slug}
                    href={"/guides/" + guide.slug}
                    className="group block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border hover:bg-elevated"
                >
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(guide.updatedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                        </span>
                        <BookOpen className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                    </div>
                    <h3 className="text-base font-bold text-foreground leading-snug group-hover:text-emerald-500 transition-colors">
                        {guide.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {guide.description}
                    </p>
                </Link>
            ))}
        </div>
    );
}
