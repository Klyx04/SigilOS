"use client";

import { useState, useTransition } from "react";
import { MemberCard } from "./member-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOFUS_CLASSES, DOFUS_JOBS, JOB_CATEGORIES } from "@/lib/dofus-assets";
import { Search, Loader2, X } from "lucide-react";
import { getGuildMembers } from "@/server/actions/profile-actions";
import { Label } from "@/components/ui/label";

interface MemberDirectoryProps {
    initialMembers: any[];
    guildId: string;
}

export function MemberDirectory({ initialMembers, guildId }: MemberDirectoryProps) {
    const [members, setMembers] = useState(initialMembers);
    const [isPending, startTransition] = useTransition();

    // Filters
    const [search, setSearch] = useState("");
    const [selectedClass, setSelectedClass] = useState<string | "all">("all");
    const [selectedJob, setSelectedJob] = useState<string | "all">("all");

    // Client-side filtering is enough for small guilds (<200 members) 
    // but the action supports server-side filtering too.
    // Let's mix: Fetch all active profiles initially (done in page), then filter client side for responsiveness.
    // unless we want to demo the server action filter. 
    // Let's stick to client-side filter for instant feedback on small datasets.

    const filteredMembers = members.filter(m => {
        // Search (Name or Pseudo)
        const nameMatch = (m.pseudoDofus || "").toLowerCase().includes(search.toLowerCase()) ||
            (m.user.name || "").toLowerCase().includes(search.toLowerCase());

        if (!nameMatch) return false;

        // Class
        if (selectedClass !== "all" && m.classe !== selectedClass) return false;

        // Job
        if (selectedJob !== "all") {
            const jobs = Array.isArray(m.metiers) ? m.metiers : [];
            if (!jobs.includes(selectedJob)) return false;
        }

        return true;
    });

    const resetFilters = () => {
        setSearch("");
        setSelectedClass("all");
        setSelectedJob("all");
    };

    return (
        <div className="space-y-6">

            {/* TOOLBAR */}
            <div className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end md:items-center">

                <div className="flex-1 w-full space-y-2">
                    <Label>Rechercher</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Pseudo, Nom..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-black/20 border-white/10"
                        />
                    </div>
                </div>

                <div className="w-full md:w-48 space-y-2">
                    <Label>Classe</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue placeholder="Toutes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes</SelectItem>
                            {DOFUS_CLASSES.map(c => <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full md:w-48 space-y-2">
                    <Label>Métier (200)</Label>
                    <Select value={selectedJob} onValueChange={setSelectedJob}>
                        <SelectTrigger className="bg-black/20 border-white/10">
                            <SelectValue placeholder="Tous" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous</SelectItem>
                            {Object.values(DOFUS_JOBS).flat().map(j => <SelectItem key={j.id} value={j.id}>{j.icon} {j.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <Button variant="ghost" size="icon" onClick={resetFilters} className="mb-0.5" title="Réinitialiser">
                    <X className="w-4 h-4" />
                </Button>

            </div>

            {/* RESULTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMembers.map(member => (
                    <MemberCard key={member.id} profile={member} guildId={guildId} />
                ))}
            </div>

            {filteredMembers.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <p>Aucun membre ne correspond à vos critères.</p>
                </div>
            )}
        </div>
    );
}
