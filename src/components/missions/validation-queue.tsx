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
import { Check, X, ExternalLink, Search, Filter as FilterIcon, User as UserIcon, RefreshCcw, ShieldCheck, Users, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ValidationCard } from "./validation-card";

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
    helpers: {
        id: string;
        pseudoDofus: string | null;
        user: {
            name: string | null;
            image: string | null;
        };
    }[];
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
                        <SelectContent className="max-h-[300px]">
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
                        <ValidationCard
                            key={item.id}
                            submission={item}
                            onValidate={() => handleDecision(item.id, "VALIDATED")}
                            onReject={() => handleDecision(item.id, "REJECTED")}
                            isProcessing={processingId === item.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
