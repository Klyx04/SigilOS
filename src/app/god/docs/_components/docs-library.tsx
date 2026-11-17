"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, ExternalLink, Search, Shield, Users, Globe, FileText, FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDocMeta, CATEGORY_META } from "@/lib/doc-meta";
import { groupDocsByCategory, docScopeOf, missingModuleDocSlugs, type DocListItem } from "@/lib/docs-modules";
import { createMissingModuleDocsAction } from "@/server/actions/doc-actions";
import { DeleteDocButton } from "./delete-button";
import type { DocPageData } from "@/server/actions/doc-actions";

type ScopeFilter = "all" | "user" | "staff";

const SCOPE_TABS: { value: ScopeFilter; label: string }[] = [
    { value: "all", label: "Toutes" },
    { value: "user", label: "Membres" },
    { value: "staff", label: "Staff" },
];

function AccessBadge({ level }: { level: string }) {
    if (level === "ADMIN") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-warning/20 bg-warning/5 text-warning font-bold text-[11px] uppercase tracking-wide">
                <Shield className="w-3 h-3" /> Staff
            </span>
        );
    }
    if (level === "PUBLIC") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-surface/10 text-muted-foreground font-bold text-[11px] uppercase tracking-wide">
                <Globe className="w-3 h-3" /> Public
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-success/20 bg-success/5 text-success font-bold text-[11px] uppercase tracking-wide">
            <Users className="w-3 h-3" /> Membres
        </span>
    );
}

export function DocsLibrary({ docs }: { docs: DocPageData[] }) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<ScopeFilter>("all");
    const [isCreating, startCreating] = useTransition();

    const stats = useMemo(() => ({
        total: docs.length,
        online: docs.filter((d) => d.isPublished).length,
        drafts: docs.filter((d) => !d.isPublished).length,
    }), [docs]);

    // Couverture « un module = une fiche » : slugs du contrat absents de la base.
    const missing = useMemo(
        () => missingModuleDocSlugs(docs.map((d) => d.slug)),
        [docs]
    );

    const handleCreateMissing = () => {
        startCreating(async () => {
            const res = await createMissingModuleDocsAction();
            if (res.success) {
                const n = res.data?.created.length ?? 0;
                toast.success(n === 0 ? "Couverture complète : rien à créer." : `${n} page${n > 1 ? "s" : ""} de couverture créée${n > 1 ? "s" : ""} — à rédiger.`);
                router.refresh();
            } else {
                toast.error(res.error || "Création impossible");
            }
        });
    };

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = docs.filter((doc) => {
            if (scope !== "all" && docScopeOf(doc) !== scope) return false;
            if (!q) return true;
            return (
                doc.title.toLowerCase().includes(q) ||
                doc.slug.toLowerCase().includes(q) ||
                doc.category.toLowerCase().includes(q)
            );
        });
        return groupDocsByCategory(filtered as DocListItem[]);
    }, [docs, query, scope]);

    const matchCount = groups.reduce((n, g) => n + g.docs.length, 0);

    return (
        <div className="space-y-8">
            {/* Compteurs + filtres */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="px-3 py-1 rounded-full border-border bg-surface/10 text-foreground font-bold">
                        {stats.total} fiche{stats.total > 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 rounded-full border-success/20 bg-success/5 text-success font-bold">
                        {stats.online} en ligne
                    </Badge>
                    {stats.drafts > 0 && (
                        <Badge variant="outline" className="px-3 py-1 rounded-full border-warning/20 bg-warning/5 text-warning font-bold">
                            {stats.drafts} brouillon{stats.drafts > 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {missing.length > 0 && (
                        <Button
                            onClick={handleCreateMissing}
                            disabled={isCreating}
                            className="h-10 px-4 rounded-xl bg-warning hover:bg-warning text-warning-foreground font-bold text-xs uppercase tracking-wide"
                            title={`Pages sans fiche : ${missing.map((m) => m.slug).join(", ")}`}
                        >
                            {isCreating ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <FilePlus2 className="w-4 h-4 mr-2" />
                            )}
                            {missing.length} page{missing.length > 1 ? "s" : ""} manquante{missing.length > 1 ? "s" : ""}
                        </Button>
                    )}
                    <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-background/40">
                        {SCOPE_TABS.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setScope(tab.value)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors",
                                    scope === tab.value
                                        ? "bg-success text-success-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Titre, slug, catégorie…"
                            className="bg-background/40 border-border h-10 pl-9 w-full sm:w-64 rounded-xl text-sm focus:border-success/50"
                        />
                    </div>
                </div>
            </div>

            {/* Groupes par module */}
            {groups.length === 0 && (
                <div className="bg-surface/40 border border-border rounded-xl px-8 py-20 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground font-medium">
                        {docs.length === 0
                            ? "Aucune archive documentaire détectée dans la base."
                            : "Aucune fiche ne correspond à cette recherche."}
                    </p>
                    {docs.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setQuery(""); setScope("all"); }}
                            className="mt-4 text-success hover:text-success"
                        >
                            Réinitialiser les filtres
                        </Button>
                    )}
                </div>
            )}

            {groups.map((group) => {
                const catMeta = CATEGORY_META[group.category];
                const CategoryIcon = catMeta?.icon ?? FileText;
                return (
                    <section key={group.category} className="bg-surface/40 border border-border rounded-xl overflow-hidden shadow-sm">
                        <header className="flex items-center justify-between gap-4 px-6 md:px-8 py-5 bg-elevated/[0.03] border-b border-border">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                                    <CategoryIcon className="w-4 h-4 text-success" />
                                </div>
                                <h2 className="text-base md:text-lg font-semibold text-foreground uppercase tracking-tight truncate">
                                    {group.category}
                                </h2>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                                {group.docs.length} fiche{group.docs.length > 1 ? "s" : ""}
                            </span>
                        </header>
                        <ul className="divide-y divide-border">
                            {group.docs.map((doc) => {
                                const DocIcon = getDocMeta(doc.slug).icon;
                                return (
                                    <li key={doc.id} className="group flex flex-col md:flex-row md:items-center gap-3 md:gap-4 px-6 md:px-8 py-4 hover:bg-elevated/[0.02] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-9 h-9 rounded-xl bg-surface/10 border border-border flex items-center justify-center shrink-0">
                                                <DocIcon className="w-4 h-4 text-muted-foreground group-hover:text-success transition-colors" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-foreground truncate">{doc.title}</span>
                                                    {!doc.isPublished && (
                                                        <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full border border-warning/20 font-semibold tracking-wide uppercase">
                                                            Brouillon
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-[11px] text-muted-foreground truncate">/docs/{doc.slug}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-12 md:pl-0 shrink-0">
                                            <AccessBadge level={doc.accessLevel} />
                                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-surface/10 text-muted-foreground hover:text-foreground border border-transparent hover:border-border" asChild>
                                                <Link href={`/docs/${doc.slug}`} target="_blank" title="Voir le rendu">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-surface/10 text-success hover:text-warning hover:bg-success/10 border border-transparent hover:border-success/20" asChild>
                                                <Link href={`/god/docs/${doc.id}`} title="Modifier">
                                                    <Edit className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                            <div className="scale-100 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all">
                                                <DeleteDocButton id={doc.id} />
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}

            {matchCount > 0 && (
                <p className="text-center text-xs text-muted-foreground font-mono">
                    {matchCount} fiche{matchCount > 1 ? "s" : ""} affichée{matchCount > 1 ? "s" : ""}
                </p>
            )}
        </div>
    );
}
