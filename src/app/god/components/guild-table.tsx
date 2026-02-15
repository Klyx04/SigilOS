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
import { Search, Filter, ChevronDown, MoreVertical, Check, Users, Calendar, ExternalLink, Trash2, Archive, Eye, ShieldAlert, ShieldCheck, RotateCcw } from 'lucide-react';
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
import { softDeleteGuild, reactivateGuild, hardDeleteGuild } from '@/server/actions/god-lifecycle-actions';
import { toast } from 'sonner';
import Link from 'next/link';

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
    _count: {
        profiles: number;
    };
}

interface GuildTableProps {
    guilds: Guild[];
}

type FilterStatus = 'all' | 'active' | 'inactive' | 'deleted';
type SortBy = 'name' | 'members' | 'createdAt';

export function GuildTable({ guilds }: GuildTableProps) {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Filtered & sorted guilds
    const filteredGuilds = useMemo(() => {
        const result = guilds.filter(guild => {
            // Search filter
            const matchesSearch =
                guild.name.toLowerCase().includes(search.toLowerCase()) ||
                guild.discordGuildId.includes(search);

            // Status filter
            const matchesStatus =
                filterStatus === 'all' ||
                (filterStatus === 'active' && guild.isActive && !guild.deletedAt) ||
                (filterStatus === 'inactive' && guild.isActive && guild._count.profiles === 0) ||
                (filterStatus === 'deleted' && !guild.isActive && guild.deletedAt);

            return matchesSearch && matchesStatus;
        });

        // Sort
        result.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'name') {
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

    const selectAll = () => {
        if (selected.size === filteredGuilds.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredGuilds.map(g => g.id)));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-200 to-violet-500 bg-clip-text text-transparent">
                        Gestion des Guildes
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        {filteredGuilds.length} guilde{filteredGuilds.length > 1 ? 's' : ''}
                        {search && ` · Recherche: "${search}"`}
                    </p>
                </div>

                <div className="flex gap-2">
                    {/* TODO: Add Guild button */}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/60 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom ou ID Discord..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                        className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                    >
                        <option value="all">Toutes les guildes</option>
                        <option value="active">✅ Actives</option>
                        <option value="inactive">⚠️ Inactives (0 membre)</option>
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
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Membres / Capacité
                                </th>
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="p-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
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

function GuildRow({ guild, selected, onSelect }: {
    guild: Guild;
    selected: boolean;
    onSelect: () => void;
}) {
    const [isUpdating, setIsUpdating] = useState(false);

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

    const statusConfig = guild.deletedAt
        ? { label: '🗑️ Supprimée', color: 'text-red-400 bg-red-500/10 border-red-500/30' }
        : guild._count.profiles === 0
            ? { label: '⚠️ Inactive', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
            : { label: '✅ Active', color: 'text-green-400 bg-green-500/10 border-green-500/30' };

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
                        <div className="font-medium">{guild.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{guild.discordGuildId}</div>
                    </div>
                </div>
            </td>

            <td className="p-4">
                <div className="space-y-1.5 min-w-[120px]">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-medium">
                            <Users className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{guild._count.profiles}</span>
                        </div>
                        <span className="text-zinc-500 font-mono text-[10px]">/{guild.maxMembers}</span>
                    </div>
                    {/* Capacity Bar */}
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${(guild._count.profiles / guild.maxMembers) >= 0.95 ? "bg-red-500" :
                                (guild._count.profiles / guild.maxMembers) >= 0.8 ? "bg-amber-500" :
                                    "bg-emerald-500"
                                }`}
                            style={{ width: `${Math.min(100, (guild._count.profiles / guild.maxMembers) * 100)}%` }}
                        />
                    </div>
                </div>
            </td>

            <td className="p-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${statusConfig.color}`}>
                    {statusConfig.label}
                </span>
            </td>

            <td className="p-4 text-sm text-zinc-400">
                {formatDistanceToNow(new Date(guild.createdAt), { addSuffix: true, locale: fr })}
            </td>

            <td className="p-4">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* SECURITY: Super admin should NOT have direct access to guild dashboards */}
                    {/* TODO: Create /god/guilds/[id] for read-only admin inspection */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-white/10 text-zinc-300 shadow-2xl">
                            <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-widest p-3">Actions God Mode</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/5" />

                            <DropdownMenuItem asChild className="gap-3 p-3 cursor-pointer focus:bg-violet-500/10 focus:text-violet-400">
                                <Link href={`/god/guilds/${guild.id}`}>
                                    <Eye className="w-4 h-4" />
                                    Voir le Roster
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem className="gap-3 p-3 cursor-pointer focus:bg-blue-500/10 focus:text-blue-400">
                                <Calendar className="w-4 h-4" />
                                Journal d'Audit
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="bg-white/5" />

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
                                Hard Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </td>
        </motion.tr >
    );
}
