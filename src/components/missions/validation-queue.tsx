'use client'

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateSubmission } from "@/server/actions/mission-actions";
import { Submission, Mission, UserProfile, User, MissionCategory } from "@prisma/client";
import { Check, X, ExternalLink, Sparkles, Search, Filter as FilterIcon, User as UserIcon, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ExtendedSubmission = Submission & {
    mission: Mission;
    profile: {
        id: string;
        userId: string;
        discordNickname: string | null;
        pseudoDofus: string | null;
        classe: string | null;
        discordRoleName: string | null;
        isAdmin: boolean;
        user: {
            id: string;
            name: string | null;
            image: string | null;
        };
    };
};

const CATEGORIES: { label: string; value: MissionCategory | 'ALL' }[] = [
    { label: "Toutes les catégories", value: "ALL" },
    { label: "Donjon", value: "DONJON" },
    { label: "Régulation", value: "REGULATION" },
    { label: "Anomalie", value: "ANOMALIE" },
    { label: "Songes", value: "SONGES" },
    { label: "Expédition", value: "EXPEDITION" },
    { label: "Événement", value: "EVENT" },
];

export function ValidationQueue({ submissions: initialSubmissions, guildId }: { submissions: ExtendedSubmission[], guildId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [submissions, setSubmissions] = useState(initialSubmissions);

    useEffect(() => {
        setSubmissions(initialSubmissions);
    }, [initialSubmissions]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<MissionCategory | 'ALL'>('ALL');

    const handleDecision = (id: string, status: "VALIDATED" | "REJECTED") => {
        setProcessingId(id);
        startTransition(async () => {
            const result = await validateSubmission(guildId, id, status);
            setProcessingId(null);

            if (result.success) {
                toast.success(status === "VALIDATED" ? "Validé avec succès" : "Refusé");
                setSubmissions(prev => prev.filter(s => s.id !== id));
                router.refresh(); // Ensure server state is synced
            } else {
                toast.error(result.error || "Erreur action");
            }
        });
    };

    // Filter Logic
    const filteredSubmissions = submissions.filter(item => {
        const matchesCategory = categoryFilter === 'ALL' || item.mission.category === categoryFilter;

        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            (item.profile.pseudoDofus || "").toLowerCase().includes(searchLower) ||
            (item.profile.user.name || "").toLowerCase().includes(searchLower) ||
            (item.mission.title || "").toLowerCase().includes(searchLower);

        return matchesCategory && matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Toolbar: Stats & Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-400 border-r border-white/10 pr-4">
                        <span className="text-white font-medium">{submissions.length}</span> en attente
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white transition-colors"
                        onClick={() => startTransition(() => router.refresh())}
                        disabled={isPending}
                        title="Actualiser la liste"
                    >
                        <RefreshCcw className={cn("w-4 h-4", isPending && "animate-spin")} />
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Chercher membre ou mission..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 bg-black/20 border-white/10"
                        />
                    </div>

                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                        <SelectTrigger className="w-full sm:w-[180px] h-9 bg-black/20 border-white/10">
                            <FilterIcon className="w-3.5 h-3.5 mr-2 opacity-50" />
                            <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORIES.map(c => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Grid */}
            {filteredSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[40vh] text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <Check className="w-12 h-12 mb-4 opacity-20" />
                    <p>Aucune soumission correspondante.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredSubmissions.map((item) => (
                        <Card key={item.id} className="bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col">
                            {/* Header: User Info */}
                            <CardHeader className="p-3 bg-zinc-950/50 border-b border-zinc-800/50 flex flex-row items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden relative shrink-0 border border-white/10">
                                    {item.profile.user.image ? (
                                        <Image
                                            src={item.profile.user.image}
                                            alt={item.profile.user.name || "User"}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full w-full text-zinc-600">
                                            <UserIcon className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-white truncate">
                                            {item.profile.discordNickname || item.profile.user.name || "Membre Inconnu"}
                                        </span>
                                        {item.profile.isAdmin && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] shrink-0" />
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-zinc-900 border-purple-500/30 text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                                        Administration
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {item.profile.pseudoDofus && (
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-zinc-800 text-zinc-400 font-normal">
                                                {item.profile.pseudoDofus}
                                            </Badge>
                                        )}
                                        {item.profile.classe && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-zinc-700 text-zinc-500 font-normal ml-1">
                                                {item.profile.classe}
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-zinc-500">
                                        Soumis le {new Date(item.createdAt).toLocaleDateString()} à {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </CardHeader>

                            {/* Content: Mission & Proof */}
                            <CardContent className="p-4 space-y-3 flex-1">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <Badge variant="outline" className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-400 border-zinc-700">
                                            {item.mission.category}
                                        </Badge>
                                        <h4 className="text-sm font-bold text-white leading-tight">{item.mission.title || "Mission Sans Titre"}</h4>
                                        <p className="text-xs text-indigo-400 mt-0.5 font-medium">Rang {item.mission.tier}</p>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="relative aspect-video rounded-lg bg-black overflow-hidden border border-zinc-800 group mt-2">
                                    <Image
                                        src={item.proofUrl}
                                        alt="Preuve"
                                        fill
                                        className="object-contain"
                                    />

                                    {/* OCR Badge */}
                                    {item.ocrScore !== null && (
                                        <div className={cn(
                                            "absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md",
                                            (item.ocrScore || 0) >= 95 ? "bg-green-500/90 text-white" :
                                                (item.ocrScore || 0) >= 70 ? "bg-yellow-500/90 text-black" :
                                                    "bg-red-500/90 text-white"
                                        )}>
                                            <Sparkles className="w-3 h-3" />
                                            {Math.round(item.ocrScore || 0)}%
                                        </div>
                                    )}

                                    <a
                                        href={item.proofUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-2"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Voir en grand
                                    </a>
                                </div>
                            </CardContent>

                            {/* Footer: Actions */}
                            <CardFooter className="p-3 bg-zinc-950/30 border-t border-zinc-800/50 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-red-900/30 hover:bg-red-950/50 hover:text-red-400 text-red-500"
                                    onClick={() => handleDecision(item.id, "REJECTED")}
                                    disabled={processingId === item.id}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Refuser
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="w-full bg-green-600 hover:bg-green-500 text-white"
                                    onClick={() => handleDecision(item.id, "VALIDATED")}
                                    disabled={processingId === item.id}
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Valider
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
