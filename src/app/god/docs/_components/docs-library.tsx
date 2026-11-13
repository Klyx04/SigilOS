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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 font-bold text-[11px] uppercase tracking-widest">
                <Shield className="w-3 h-3" /> Staff
            </span>
        );
    }
    if (level === "PUBLIC") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-zinc-400 font-bold text-[11px] uppercase tracking-widest">
                <Globe className="w-3 h-3" /> Public
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-teal-500/20 bg-teal-500/5 text-teal-400 font-bold text-[11px] uppercase tracking-widest">
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
                    <Badge variant="outline" className="px-3 py-1 rounded-full border-white/10 bg-white/5 text-zinc-300 font-bold">
                        {stats.total} fiche{stats.total > 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 rounded-full border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-bold">
                        {stats.online} en ligne
                    </Badge>
                    {stats.drafts > 0 && (
                        <Badge variant="outline" className="px-3 py-1 rounded-full border-amber-500/20 bg-amber-500/5 text-amber-400 font-bold">
                            {stats.drafts} brouillon{stats.drafts > 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {missing.length > 0 && (
                        <Button
                            onClick={handleCreateMissing}
                            disabled={isCreating}
                            className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-widest"
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
                    <div className="flex items-center gap-1 p-1 rounded-xl border border-white/5 bg-black/40">
                        {SCOPE_TABS.map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setScope(tab.value)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors",
                                    scope === tab.value
                                        ? "bg-teal-600 text-white"
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Titre, slug, catégorie…"
                            className="bg-black/40 border-white/5 h-10 pl-9 w-full sm:w-64 rounded-xl text-sm focus:border-teal-500/50"
                        />
                    </div>
                </div>
            </div>

            {/* Groupes par module */}
            {groups.length === 0 && (
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl px-8 py-20 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-4 text-zinc-600" />
                    <p className="text-zinc-400 font-medium">
                        {docs.length === 0
                            ? "Aucune archive documentaire détectée dans la base."
                            : "Aucune fiche ne correspond à cette recherche."}
                    </p>
                    {docs.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setQuery(""); setScope("all"); }}
                            className="mt-4 text-teal-400 hover:text-teal-300"
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
                    <section key={group.category} className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                        <header className="flex items-center justify-between gap-4 px-6 md:px-8 py-5 bg-white/[0.03] border-b border-white/5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                                    <CategoryIcon className="w-4 h-4 text-teal-400" />
                                </div>
                                <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight truncate">
                                    {group.category}
                                </h2>
                            </div>
                            <span className="text-xs font-mono text-zinc-500 shrink-0">
                                {group.docs.length} fiche{group.docs.length > 1 ? "s" : ""}
                            </span>
                        </header>
                        <ul className="divide-y divide-white/5">
                            {group.docs.map((doc) => {
                                const DocIcon = getDocMeta(doc.slug).icon;
                                return (
                                    <li key={doc.id} className="group flex flex-col md:flex-row md:items-center gap-3 md:gap-4 px-6 md:px-8 py-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                                                <DocIcon className="w-4 h-4 text-zinc-400 group-hover:text-teal-400 transition-colors" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white truncate">{doc.title}</span>
                                                    {!doc.isPublished && (
                                                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 font-black tracking-widest uppercase">
                                                            Brouillon
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-[11px] text-zinc-600 truncate">/docs/{doc.slug}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-12 md:pl-0 shrink-0">
                                            <AccessBadge level={doc.accessLevel} />
                                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-white/5 text-zinc-500 hover:text-white border border-transparent hover:border-white/10" asChild>
                                                <Link href={`/docs/${doc.slug}`} target="_blank" title="Voir le rendu">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl bg-white/5 text-teal-400 hover:text-amber-400 hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20" asChild>
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
                <p className="text-center text-xs text-zinc-600 font-mono">
                    {matchCount} fiche{matchCount > 1 ? "s" : ""} affichée{matchCount > 1 ? "s" : ""}
                </p>
            )}
        </div>
    );
}
