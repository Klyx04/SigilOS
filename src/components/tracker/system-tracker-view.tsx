"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, BugIcon, LightbulbIcon, Link as LinkIcon, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type SystemIssueType = "BUG" | "AMELIORATION";
type SystemIssueStatus = "A_FAIRE" | "A_INVESTIGUER" | "EN_COURS" | "TERMINE" | "IGNORE";

type Issue = {
    id: number;
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    status: SystemIssueStatus;
    createdAt: Date;
    forumLink: string | null;
};

const PRIORITY_COLORS: Record<string, string> = {
    "Très important": "bg-red-500/10 text-red-500 border-red-500/20",
    "Important": "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "Normal": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Faible": "bg-slate-500/10 text-zinc-500 border-white/5",
};

const StatusBadge = ({ status }: { status: SystemIssueStatus }) => {
    let sc = "bg-primary text-primary-foreground";
    let label = status.replace("_", " ");
    
    if (status === "A_FAIRE") {
        sc = "bg-zinc-800 text-zinc-400 border-zinc-700";
        label = "À FAIRE";
    }
    if (status === "A_INVESTIGUER") {
        sc = "bg-red-500/10 text-red-400 border-red-500/20";
        label = "INVESTIGATION";
    }
    if (status === "EN_COURS") {
        sc = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        label = "EN COURS";
    }
    if (status === "TERMINE") {
        sc = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        label = "RÉSOLU / PRÊT";
    }
    if (status === "IGNORE") {
        sc = "bg-transparent text-zinc-600 border border-zinc-800";
        label = "REPORTÉ";
    }

    return (
        <Badge variant="outline" className={cn("whitespace-nowrap transition-all uppercase tracking-tighter text-[9px] font-black", sc)}>
            {label}
        </Badge>
    );
};

export function SystemTrackerView({ initialIssues }: { initialIssues: Issue[] }) {
    const [filter, setFilter] = useState("");
    const [filterType, setFilterType] = useState<"ALL" | SystemIssueType>("ALL");

    const filteredIssues = initialIssues.filter(i => {
        const matchesFilter = i.description.toLowerCase().includes(filter.toLowerCase()) || 
                              i.category.toLowerCase().includes(filter.toLowerCase());
        const matchesType = filterType === "ALL" || i.type === filterType;
        return matchesFilter && matchesType;
    });

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-950/40 p-4 rounded-2xl border border-white/5 backdrop-blur-3xl">
                <div className="flex flex-wrap gap-3 w-full">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                        <Input
                            placeholder="Filtrer par description ou catégorie..."
                            className="pl-11 h-12 bg-zinc-900/50 border-white/5 focus-visible:ring-emerald-500/20 text-zinc-200 rounded-xl"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                        <SelectTrigger className="w-[200px] h-12 bg-zinc-900/50 border-white/5 text-zinc-300 rounded-xl">
                            <SelectValue placeholder="Tous les types" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 rounded-xl">
                            <SelectItem value="ALL" className="focus:bg-zinc-800 cursor-pointer py-2.5">Tous les types</SelectItem>
                            <SelectItem value="BUG" className="focus:bg-zinc-800 cursor-pointer text-red-400 py-2.5">Bugs uniquement</SelectItem>
                            <SelectItem value="AMELIORATION" className="focus:bg-zinc-800 cursor-pointer text-blue-400 py-2.5">Améliorations</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Main Table */}
            <Card className="border-0 bg-zinc-950/40 backdrop-blur-xl shadow-2xl relative overflow-hidden ring-1 ring-white/5 rounded-3xl">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent bg-white/[0.02]">
                                    <TableHead className="w-[100px] text-zinc-500 font-black uppercase tracking-widest text-[10px] px-6 py-5">Ticket</TableHead>
                                    <TableHead className="w-[140px] text-zinc-500 font-black uppercase tracking-widest text-[10px]">Type / Cat</TableHead>
                                    <TableHead className="w-[130px] text-zinc-500 font-black uppercase tracking-widest text-[10px]">Priorité</TableHead>
                                    <TableHead className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Description</TableHead>
                                    <TableHead className="w-[160px] text-zinc-500 font-black uppercase tracking-widest text-[10px]">État actuel</TableHead>
                                    <TableHead className="w-[120px] text-right text-zinc-500 font-black uppercase tracking-widest text-[10px] px-6">Détails</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredIssues.length === 0 ? (
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableCell colSpan={6} className="text-center h-64 text-zinc-500">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                                    <BugIcon className="h-8 w-8 opacity-20" />
                                                </div>
                                                <p className="font-bold tracking-tight">Aucun ticket ne correspond à votre recherche.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredIssues.map(issue => (
                                        <TableRow key={issue.id} className={cn(
                                            "border-white/5 hover:bg-white/[0.03] transition-all duration-300 group",
                                            issue.status === "TERMINE" && "opacity-60 grayscale-[0.5]"
                                        )}>
                                            <TableCell className="px-6 font-mono text-zinc-500 text-[11px] font-black italic">
                                                SIG-{issue.id}
                                            </TableCell>
                                            
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        {issue.type === "BUG" ? <BugIcon className="h-3.5 w-3.5 text-red-500" /> : <LightbulbIcon className="h-3.5 w-3.5 text-blue-500" />}
                                                        <span className={cn("text-[10px] font-black uppercase tracking-widest", issue.type === "BUG" ? "text-red-500/80" : "text-blue-500/80")}>
                                                            {issue.type}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-zinc-400 pl-5">
                                                        {issue.category}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <Badge variant="outline" className={cn("uppercase tracking-[0.1em] text-[9px] font-black border px-2 py-0.5", PRIORITY_COLORS[issue.priority])}>
                                                    {issue.priority}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="max-w-[450px] py-6">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-start gap-3">
                                                        {issue.status === 'EN_COURS' && (
                                                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0 mt-1.5 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                                                        )}
                                                        <p className="text-[13px] text-zinc-200 font-medium leading-relaxed">
                                                            {issue.description}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                                                        <span className="flex items-center gap-1.5">
                                                            <History className="w-3 h-3" />
                                                            Signalé le {format(new Date(issue.createdAt), "dd MMMM yyyy", { locale: fr })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex flex-col items-start">
                                                    <StatusBadge status={issue.status} />
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right px-6">
                                                {issue.forumLink && (
                                                    <a 
                                                        href={issue.forumLink} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/50 hover:text-blue-400 text-zinc-500 transition-all group/link"
                                                    >
                                                        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover/link:inline">Détails</span>
                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Help Note */}
            <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-4">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                    <LightbulbIcon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest">Contrôle de Qualité</h4>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                        Cette liste est synchronisée en temps réel avec le tracker interne de SigilOS. Si vous rencontrez un bug non listé ici, veuillez le signaler via le bouton de support en bas de votre dashboard.
                    </p>
                </div>
            </div>
        </div>
    );
}
