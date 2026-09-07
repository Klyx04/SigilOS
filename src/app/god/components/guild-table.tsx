/**
 * 🏰 GOD Dashboard - Guild Table Component  
 * 
 * Premium guild management with:
 * - Advanced filters (search, status, sort)
 * - Bulk actions (archive, delete)
 * - Smooth animations
 * - Inline actions
 */

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, ChevronDown, MoreVertical, Check, Users, Calendar, ExternalLink, Trash2, Archive, Eye, ShieldAlert, ShieldCheck, RotateCcw, Plus, UserPlus, FileText, Hash, Copy, Snowflake, AlertTriangle, LogOut, Radio, ShieldX, Ban
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { softDeleteGuild, reactivateGuild, hardDeleteGuild, banEntity } from '@/server/actions/god-lifecycle-actions';
import { addAllowedGuild, removeAllowedGuild, toggleGuildActive } from "@/server/actions/super-admin-actions";
import { forceBotLeaveGuild } from "@/server/actions/god-discord-actions";
import { toast } from 'sonner';
import Link from 'next/link';
import { z } from 'zod';

const whitelistSchema = z.object({
    discordGuildId: z.string().min(17, "ID Discord trop court").max(20, "ID Discord trop long").regex(/^\d+$/, "L'ID doit être numérique"),
    name: z.string().min(2, "Nom trop court").optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
});

interface Guild {
    id: string;
    name: string;
    discordGuildId: string;
    iconUrl: string | null;
    isActive: boolean;
    deletedAt: Date | null;
    deletionReason: string | null;
    scheduledDeletion: Date | null;
    createdAt: Date;
    maxMembers: number;
    isWhitelistOnly?: boolean;
    notes?: string | null;
    tier?: string; // Restore tier
    _count: {
        profiles: number;
    };
}

interface GuildTableProps {
    guilds: Guild[];
    /** 🔄 P2 — true pour un sous-god : whitelist seule, actions destructives masquées. */
    isReadOnly?: boolean;
}

type FilterStatus = 'all' | 'active' | 'autonomous' | 'vip' | 'watch' | 'frozen' | 'deleted';
type SortBy = 'name' | 'members' | 'createdAt' | 'queue';

/** SLA God — une guilde gelée/en attente depuis plus de 24 h est en retard. */
const SLA_FROZEN_MS = 24 * 3600 * 1000;

export function GuildTable({ guilds, isReadOnly = false }: GuildTableProps) {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Whitelist Modal State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newGuildId, setNewGuildId] = useState("");
    const [newGuildName, setNewGuildName] = useState("");
    const [newGuildNotes, setNewGuildNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Radar Heuristics & Stats
    const radarStats = useMemo(() => {
        let total = guilds.length;
        let autonomous = 0;
        let vip = 0;
        let watch = 0;
        let frozen = 0;

        for (const g of guilds) {
            const isAuto = g.notes?.toLowerCase().includes("autonomie") || g.tier === "COMMUNITY";
            if (isAuto) autonomous++;
            else if (!g.isWhitelistOnly) vip++;

            if (!g.isActive || !!g.deletedAt) frozen++;
            else if (!g.isWhitelistOnly && g._count.profiles <= 3) watch++;
        }

        return { total, autonomous, vip, watch, frozen };
    }, [guilds]);

    // Filtered & sorted guilds
    const filteredGuilds = useMemo(() => {
        const result = guilds.filter(guild => {
            // Search filter
            const matchesSearch =
                guild.name.toLowerCase().includes(search.toLowerCase()) ||
                guild.discordGuildId.includes(search);

            const isAuto = guild.notes?.toLowerCase().includes("autonomie") || guild.tier === "COMMUNITY";
            const isFrozen = !guild.isActive || !!guild.deletedAt;
            const isWatch = !guild.isWhitelistOnly && !isFrozen && guild._count.profiles <= 3;

            let matchesStatus = true;
            if (filterStatus === 'active') matchesStatus = guild.isActive && !guild.deletedAt && !guild.isWhitelistOnly;
            else if (filterStatus === 'autonomous') matchesStatus = isAuto && !guild.isWhitelistOnly;
            else if (filterStatus === 'vip') matchesStatus = !isAuto && !guild.isWhitelistOnly;
            else if (filterStatus === 'watch') matchesStatus = isWatch;
            else if (filterStatus === 'frozen') matchesStatus = isFrozen;
            else if (filterStatus === 'deleted') matchesStatus = !guild.isActive && !!guild.deletedAt;

            return matchesSearch && matchesStatus;
        });

        // Sort
        result.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'queue') {
                // File d'attente SLA : gelées/en attente d'abord, plus anciennes d'abord.
                // Ordre fixe (ignore asc/desc) : l'urgence ne se trie pas à l'envers.
                const frozenA = (!a.isActive || !!a.deletedAt) ? 0 : 1;
                const frozenB = (!b.isActive || !!b.deletedAt) ? 0 : 1;
                if (frozenA !== frozenB) return frozenA - frozenB;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortBy === 'members') {
                comparison = a._count.profiles - b._count.profiles;
            } else if (sortBy === 'createdAt') {
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [guilds, search, filterStatus, sortBy, sortOrder]);

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelected(newSelected);
    };

    const handleAdd = async () => {
        const result = whitelistSchema.safeParse({
            discordGuildId: newGuildId.trim(),
            name: newGuildName.trim(),
            notes: newGuildNotes.trim(),
        });

        if (!result.success) {
            toast.error(result.error.errors[0].message);
            return;
        }

        setIsSubmitting(true);
        try {
            await addAllowedGuild(result.data);
            setIsAddOpen(false);
            setNewGuildId("");
            setNewGuildName("");
            setNewGuildNotes("");
            toast.success("Guilde ajoutée à la liste blanche. Rechargement...");
            window.location.reload(); // Refresh to show the new whitelisted guild
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout");
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectAll = () => {
        if (selected.size === filteredGuilds.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredGuilds.map(g => g.id)));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-200 to-violet-500 bg-clip-text text-transparent">
                        Gestion des Guildes
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        {filteredGuilds.length} guilde{filteredGuilds.length > 1 ? 's' : ''}
                        {search && ` · Recherche: "${search}"`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Unauthorized bot attempts button */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 font-black uppercase tracking-widest text-caption px-4 py-5 rounded-xl gap-2 transition-all">
                                <ShieldAlert className="w-4 h-4 text-orange-400" />
                                Connexions non autorisées
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-lg rounded-3xl p-6 backdrop-blur-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-orange-400">
                                    <ShieldAlert className="w-5 h-5" /> Serveurs ayant invité le Bot
                                </DialogTitle>
                                <DialogDescription className="text-zinc-400 text-xs">
                                    Ces serveurs Discord ont ajouté le Bot SigilOS mais ne sont pas encore dans la Whitelist. Le bot y reste inactif jusqu'à votre approbation.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3 mt-4 max-h-[350px] overflow-y-auto pr-1">
                                {guilds.filter(g => g.isWhitelistOnly && g.tier === 'PENDING').length === 0 ? (
                                    <div className="p-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-wider bg-zinc-900/40 rounded-2xl border border-white/5">
                                        ✅ Aucune tentative non autorisée
                                    </div>
                                ) : (
                                    guilds.filter(g => g.isWhitelistOnly && g.tier === 'PENDING').map(g => (
                                        <div key={g.id} className="flex items-center justify-between p-3 bg-zinc-900/60 border border-white/5 rounded-2xl">
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-xs text-white">{g.name}</div>
                                                <div className="text-caption font-mono text-zinc-500">{g.discordGuildId}</div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    await addAllowedGuild({ discordGuildId: g.discordGuildId, name: g.name });
                                                    toast.success(`Guilde ${g.name} Whitelistée !`);
                                                    window.location.reload();
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-caption font-black uppercase tracking-wider px-3 py-1.5 rounded-lg"
                                            >
                                                Autoriser
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-caption px-6 py-5 rounded-xl shadow-lg shadow-violet-500/10 gap-2 border border-violet-400/20 active:scale-95 transition-all">
                                <UserPlus className="w-4 h-4" />
                                Whitelist New Guild
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-white/5 text-white max-w-md rounded-3xl p-8 backdrop-blur-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Autoriser une Guilde</DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm font-medium">
                                    L'autorisation de première connexion permet au bot de rejoindre le serveur.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 mt-8">
                                <div className="space-y-2">
                                    <label className="text-caption font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                        <Hash className="w-3 h-3" /> Discord Guild ID *
                                    </label>
                                    <Input
                                        placeholder="Ex: 1234567890..."
                                        value={newGuildId}
                                        onChange={(e) => setNewGuildId(e.target.value)}
                                        className="bg-zinc-900/50 border-white/5 rounded-xl h-12 font-mono text-sm focus:ring-violet-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-caption font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                        <Filter className="w-3 h-3" /> Nom de la guilde
                                    </label>
                                    <Input
                                        placeholder="Nom mémoriel"
                                        value={newGuildName}
                                        onChange={(e) => setNewGuildName(e.target.value)}
                                        className="bg-zinc-900/50 border-white/5 rounded-xl h-12"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-caption font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                        <FileText className="w-3 h-3" /> Notes (Interne)
                                    </label>
                                    <Input
                                        placeholder="Ex: Guilde de test, Premium..."
                                        value={newGuildNotes}
                                        onChange={(e) => setNewGuildNotes(e.target.value)}
                                        className="bg-zinc-900/50 border-white/5 rounded-xl h-12"
                                    />
                                </div>

                                <Button
                                    onClick={handleAdd}
                                    disabled={isSubmitting}
                                    className="w-full bg-violet-600 hover:bg-violet-700 h-14 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-violet-500/20"
                                >
                                    {isSubmitting ? "Traitement..." : "Valider l'autorisation"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Radar de Surveillance & Métriques d'Onboarding */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filterStatus === 'all' ? 'bg-violet-500/10 border-violet-500/50 ring-1 ring-violet-500/30' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}
                >
                    <div className="text-caption font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Total</span>
                        <ShieldCheck className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="text-2xl font-black text-white mt-1">{radarStats.total}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Serveurs répertoriés</div>
                </button>

                <button
                    onClick={() => setFilterStatus('autonomous')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filterStatus === 'autonomous' ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}
                >
                    <div className="text-caption font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Autonomes</span>
                        <span className="text-xs">🚀</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{radarStats.autonomous}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Installations 1-clic</div>
                </button>

                <button
                    onClick={() => setFilterStatus('vip')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filterStatus === 'vip' ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/30' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}
                >
                    <div className="text-caption font-bold text-purple-400 uppercase tracking-widest flex items-center justify-between">
                        <span>VIP / Manuels</span>
                        <span className="text-xs">👑</span>
                    </div>
                    <div className="text-2xl font-black text-purple-400 mt-1">{radarStats.vip}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Validés par ticket</div>
                </button>

                <button
                    onClick={() => setFilterStatus('watch')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filterStatus === 'watch' ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}
                >
                    <div className="text-caption font-bold text-amber-400 uppercase tracking-widest flex items-center justify-between">
                        <span>À surveiller</span>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-400 mt-1">{radarStats.watch}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">&le; 3 profils actifs</div>
                </button>

                <button
                    onClick={() => setFilterStatus('frozen')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filterStatus === 'frozen' ? 'bg-red-500/10 border-red-500/50 ring-1 ring-red-500/30' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}
                >
                    <div className="text-caption font-bold text-red-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Gelées / Off</span>
                        <Snowflake className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="text-2xl font-black text-red-400 mt-1">{radarStats.frozen}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">Accès coupés</div>
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Recherche par nom ou ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                    >
                        <option value="all">Toutes les guildes ({radarStats.total})</option>
                        <option value="autonomous">🚀 Autonomes ({radarStats.autonomous})</option>
                        <option value="vip">👑 VIP / Manuels ({radarStats.vip})</option>
                        <option value="active">✅ Actives</option>
                        <option value="watch">🟡 À surveiller ({radarStats.watch})</option>
                        <option value="frozen">❄️ Gelées / Inactives ({radarStats.frozen})</option>
                        <option value="deleted">🗑️ Supprimées</option>
                    </select>

                    {/* Sort */}
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [by, order] = e.target.value.split('-');
                            setSortBy(by as SortBy);
                            setSortOrder(order as 'asc' | 'desc');
                        }}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                    >
                        <option value="name-asc">Nom (A-Z)</option>
                        <option value="name-desc">Nom (Z-A)</option>
                        <option value="members-desc">Plus de membres</option>
                        <option value="members-asc">Moins de membres</option>
                        <option value="createdAt-desc">Plus récentes</option>
                        <option value="createdAt-asc">Plus anciennes</option>
                        <option value="queue-asc">File d&apos;attente (urgents d&apos;abord)</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/60 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-800">
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selected.size === filteredGuilds.length && filteredGuilds.length > 0}
                                        onChange={selectAll}
                                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Guilde
                                </th>
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                                    Membres
                                </th>
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                                    Status
                                </th>
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">
                                    Créée
                                </th>
                                <th className="p-4 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {filteredGuilds.map((guild) => (
                                    <GuildRow
                                        key={guild.id}
                                        guild={guild}
                                        selected={selected.has(guild.id)}
                                        onSelect={() => toggleSelect(guild.id)}
                                        isReadOnly={isReadOnly}
                                    />
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filteredGuilds.length === 0 && (
                        <div className="p-12 text-center text-zinc-500">
                            Aucune guilde trouvée
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function GuildRow({ guild, selected, onSelect, isReadOnly }: {
    guild: Guild;
    selected: boolean;
    onSelect: () => void;
    /** 🔄 P2 — true pour un sous-god : whitelist seule, actions destructives masquées. */
    isReadOnly: boolean;
}) {
    const [isUpdating, setIsUpdating] = useState(false);

    const isAutonomous = guild.notes?.toLowerCase().includes("autonomie") || guild.tier === "COMMUNITY";
    const isFrozen = !guild.isActive || !!guild.deletedAt;
    const isWatch = !guild.isWhitelistOnly && !isFrozen && guild._count.profiles <= 3;

    const handleToggleFreeze = async () => {
        setIsUpdating(true);
        try {
            const updated = await toggleGuildActive(guild.discordGuildId);
            toast.success(updated.isActive ? "Guilde dégelée (accès rétabli)" : "Guilde gelée (accès coupé)");
            window.location.reload();
        } catch (e) {
            toast.error("Échec du changement de statut");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleForceBotLeave = async () => {
        if (!confirm(`Expulser le bot SigilOS du serveur "${guild.name}" (${guild.discordGuildId}) ?`)) return;
        setIsUpdating(true);
        try {
            const res = await forceBotLeaveGuild(guild.discordGuildId);
            if (res.success) {
                toast.success("Bot expulsé du serveur Discord !");
            } else {
                toast.error(res.error || "Erreur lors de l'expulsion");
            }
        } catch (e) {
            toast.error("Échec de l'action");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleBanEntity = async () => {
        const reason = prompt(`Bannir définitivement la guilde "${guild.name}" de SigilOS ? Saisissez la raison :`);
        if (!reason || !reason.trim()) return;
        setIsUpdating(true);
        try {
            const res = await banEntity('GUILD', guild.discordGuildId, reason.trim());
            if (res.success) {
                toast.success("Guilde bannie, bot expulsé et caches invalidés !");
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur lors du bannissement");
            }
        } catch (e) {
            toast.error("Échec du ban");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSoftDelete = async () => {
        if (!confirm(`Soft delete guild "${guild.name}"? This will archive it for 30 days.`)) return;
        setIsUpdating(true);
        try {
            await softDeleteGuild(guild.id, "GOD_ADMIN_SOFT_DELETE");
            toast.success("Guilde mise en pause (archivée)");
        } catch (e) {
            toast.error("Échec de l'action");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleReactivate = async () => {
        setIsUpdating(true);
        try {
            await reactivateGuild(guild.id);
            toast.success("Guilde réactivée");
        } catch (e) {
            toast.error("Échec de l'action");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleHardDelete = async () => {
        if (!confirm(`⚠️ HARD DELETE guild "${guild.name}"? This is irreversible.`)) return;
        const confirmText = prompt("Type DELETE to confirm:");
        if (confirmText !== 'DELETE') return;

        setIsUpdating(true);
        try {
            await hardDeleteGuild(guild.id);
            toast.success("Guilde supprimée définitivement");
        } catch (e) {
            toast.error("Échec de l'action");
        } finally {
            setIsUpdating(false);
        }
    };

    const statusConfig = guild.isWhitelistOnly
        ? guild.tier === 'PENDING'
            ? {
                label: '⏳ En attente',
                color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
                tooltip: "Demande d'accès en attente d'approbation via ticket."
            }
            : {
                label: '🛡️ Approuvée',
                color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                tooltip: 'Guilde autorisée mais pas encore connectée (Onboarding en attente).'
            }
        : guild.deletedAt
            ? {
                label: '🗑️ Supprimée',
                color: 'text-red-400 bg-red-500/10 border-red-500/30',
                tooltip: 'Guilde en cours de suppression. Accès au dashboard BLOQUÉ.'
            }
            : !guild.isActive
                ? {
                    label: '❄️ Gelée',
                    color: 'text-red-400 bg-red-500/10 border-red-500/30',
                    tooltip: 'Accès coupé par le staff (Kill-Switch).'
                }
                : guild._count.profiles === 0
                    ? {
                        label: '⚠️ Inactive',
                        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                        tooltip: 'Aucun membre n\'a encore créé de compte.'
                    }
                    : {
                        label: '✅ Active',
                        color: 'text-green-400 bg-green-500/10 border-green-500/30',
                        tooltip: 'Accès autorisé et membres actifs.'
                    };

    const handleRevokeWhitelist = async () => {
        if (!confirm("Révoquer l'autorisation de cette guilde ?")) return;
        setIsUpdating(true);
        try {
            await removeAllowedGuild(guild.discordGuildId);
            toast.success("Autorisation révoquée");
            window.location.reload();
        } catch (e) {
            toast.error("Échec de la révocation");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <motion.tr
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
        >
            <td className="p-4">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onSelect}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 checked:bg-violet-500 checked:border-violet-500 cursor-pointer"
                />
            </td>

            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="relative group/icon">
                        {guild.iconUrl && guild.iconUrl.length > 5 ? (
                            <img
                                src={`https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guild.iconUrl}.png?size=128`}
                                alt=""
                                className="w-10 h-10 rounded-xl border border-white/10 group-hover/icon:scale-110 transition-transform bg-zinc-800"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                }}
                            />
                        ) : null}
                        <div className={`${guild.iconUrl && guild.iconUrl.length > 5 ? 'hidden' : ''} fallback-icon w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-bold text-lg border border-white/10`}>
                            {guild.name[0]}
                        </div>
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="font-bold text-sm text-white">{guild.name}</div>
                            {/* Origin badge */}
                            {isAutonomous ? (
                                <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    🚀 Autonome
                                </span>
                            ) : guild.isWhitelistOnly ? (
                                <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Bot installé mais guilde jamais déployée — en attente que l'admin clique Déployer sur le portail">
                                    🤖 Bot Seul — en attente de déploiement
                                </span>
                            ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    👑 VIP Manuel
                                </span>
                            )}
                            {/* Risk score badge */}
                            {isFrozen ? (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20" title="Guilde désactivée ou supprimée — activation requise (bouton Activer). Normal juste après une invitation, avant le Déployer du portail.">
                                    🔴 Gelé — activation requise
                                </span>
                            ) : isWatch ? (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Faible activité (< 4 membres)">
                                    🟡 À surveiller
                                </span>
                            ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Communauté saine">
                                    🟢 Sain
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                            {guild.discordGuildId}
                            {guild.notes && (
                                <span className="text-caption text-zinc-600 italic truncate max-w-[150px]">
                                    — {guild.notes}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </td>

            <td className="p-4 hidden md:table-cell">
                <div className="space-y-1.5 min-w-[120px]">
                    <div className="flex items-center justify-between text-caption">
                        <div className="flex items-center gap-1 font-medium">
                            <Users className="w-3 h-3 text-zinc-500" />
                            <span>{guild._count.profiles}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-zinc-500 font-mono">/{guild.maxMembers}</span>
                            {!isReadOnly && !guild.isWhitelistOnly && (
                                <button
                                    onClick={async () => {
                                        const input = prompt(`Nouvelle capacité max de membres pour "${guild.name}" :`, String(guild.maxMembers));
                                        if (!input) return;
                                        const newCap = parseInt(input, 10);
                                        if (isNaN(newCap) || newCap < 1 || newCap > 1000) {
                                            toast.error("Capacité invalide (1 - 1000)");
                                            return;
                                        }
                                        const { updateGuildMaxMembers } = await import('@/server/actions/god-lifecycle-actions');
                                        const res = await updateGuildMaxMembers(guild.id, newCap);
                                        if (res.success) {
                                            toast.success(`Capacité portée à ${newCap} membres !`);
                                            window.location.reload();
                                        } else {
                                            toast.error(res.error || "Erreur lors de la modification");
                                        }
                                    }}
                                    className="p-0.5 hover:bg-white/10 rounded text-violet-400 transition-colors"
                                    title="Modifier le nombre d'emplacements"
                                >
                                    ✏️
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Alert Badges (50% / 80%) */}
                    {guild.maxMembers > 0 && (guild._count.profiles / guild.maxMembers) >= 0.8 ? (
                        <div className="text-caption font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded text-center uppercase tracking-wider animate-pulse">
                            ⚠️ Seuil &gt; 80% ({Math.round((guild._count.profiles / guild.maxMembers) * 100)}%)
                        </div>
                    ) : guild.maxMembers > 0 && (guild._count.profiles / guild.maxMembers) >= 0.5 ? (
                        <div className="text-caption font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-center uppercase tracking-wider">
                            ⚡ Capacité &gt; 50% ({Math.round((guild._count.profiles / guild.maxMembers) * 100)}%)
                        </div>
                    ) : null}

                    {/* Capacity Bar */}
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${(guild._count.profiles / guild.maxMembers) >= 0.8 ? "bg-red-500 shadow-sm shadow-red-500/50" :
                                (guild._count.profiles / guild.maxMembers) >= 0.5 ? "bg-amber-500 shadow-sm shadow-amber-500/50" :
                                    "bg-emerald-500"
                                }`}
                            style={{ width: `${Math.min(100, (guild._count.profiles / guild.maxMembers) * 100)}%` }}
                        />
                    </div>
                </div>
            </td>

            <td className="p-4 hidden sm:table-cell">
                <span
                    title={statusConfig.tooltip}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption font-medium border ${statusConfig.color} cursor-help whitespace-nowrap`}
                >
                    {statusConfig.label}
                </span>
            </td>

            <td className="p-4 text-caption text-zinc-400 hidden lg:table-cell">
                {formatDistanceToNow(new Date(guild.createdAt), { addSuffix: true, locale: fr })}
                {(!guild.isActive || !!guild.deletedAt) && (Date.now() - new Date(guild.createdAt).getTime() > SLA_FROZEN_MS) && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400 font-black uppercase" title="SLA God 24 h dépassée">
                        ⏳ SLA
                    </span>
                )}
            </td>

            <td className="p-4">
                <div className="flex items-center justify-end gap-1">
                    {/* Gel/Dégel UNIQUEMENT via le menu (1 seul point d'entrée — pas de doublon) */}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 bg-zinc-950 border-white/10 text-zinc-300 shadow-2xl">
                            <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-widest p-3">Tour de Contrôle</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/5" />

                            {!guild.isWhitelistOnly && (
                                <DropdownMenuItem asChild className="gap-3 p-3 cursor-pointer focus:bg-violet-500/10 focus:text-violet-400">
                                    <Link href={`/god/guilds/${guild.id}`}>
                                        <Eye className="w-4 h-4" />
                                        Inspecter le Roster
                                    </Link>
                                </DropdownMenuItem>
                            )}

                            {!isReadOnly && (
                                <>
                                    <DropdownMenuItem
                                        onClick={handleToggleFreeze}
                                        className={`gap-3 p-3 cursor-pointer ${guild.isActive ? 'focus:bg-red-500/10 focus:text-red-400' : 'focus:bg-emerald-500/10 focus:text-emerald-400'}`}
                                    >
                                        <Snowflake className="w-4 h-4" />
                                        {guild.isActive ? "Geler la guilde (Kill-switch)" : "Dégeler la guilde"}
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={handleForceBotLeave}
                                        className="gap-3 p-3 cursor-pointer focus:bg-orange-500/10 focus:text-orange-400"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Expulser le Bot Discord
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-red-500/20" />
                                    <DropdownMenuLabel className="text-xs text-red-500/80 uppercase tracking-widest p-3">
                                        Zone danger — données affectées entre parenthèses
                                    </DropdownMenuLabel>

                                    <DropdownMenuItem
                                        onClick={handleBanEntity}
                                        className="gap-3 p-3 cursor-pointer focus:bg-red-500/10 focus:text-red-400 font-bold"
                                    >
                                        <Ban className="w-4 h-4" />
                                        Bannir Définitivement (bloque, garde les données)
                                    </DropdownMenuItem>
                                </>
                            )}

                            {guild.isWhitelistOnly ? (
                                <>
                                    <DropdownMenuItem
                                        onClick={() => {
                                            navigator.clipboard.writeText(guild.discordGuildId);
                                            toast.success("ID Discord copié");
                                        }}
                                        className="gap-3 p-3 cursor-pointer focus:bg-blue-500/10 focus:text-blue-400"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copier ID Discord
                                    </DropdownMenuItem>
                                    {!isReadOnly && (
                                        <DropdownMenuItem
                                            onClick={handleRevokeWhitelist}
                                            className="gap-3 p-3 cursor-pointer focus:bg-red-500/10 focus:text-red-400 font-bold"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Révoquer Permission
                                        </DropdownMenuItem>
                                    )}
                                </>
                            ) : (
                                <>
                                    {!isReadOnly && (
                                        <>
                                            {!guild.deletedAt ? (
                                                <DropdownMenuItem
                                                    onClick={handleSoftDelete}
                                                    className="gap-3 p-3 cursor-pointer focus:bg-amber-500/10 focus:text-amber-400"
                                                >
                                                    <Archive className="w-4 h-4" />
                                                    Mettre en pause
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    onClick={handleReactivate}
                                                    className="gap-3 p-3 cursor-pointer focus:bg-emerald-500/10 focus:text-emerald-400"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                    Réactiver
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuItem
                                                onClick={handleHardDelete}
                                                className="gap-3 p-3 cursor-pointer focus:bg-red-500/10 focus:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Hard Delete (supprime TOUT de la BDD)
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </td>
        </motion.tr >
    );
}
