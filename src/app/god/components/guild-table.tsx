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
    Search, Filter, ChevronDown, MoreVertical, Check, Users, Calendar, ExternalLink, Trash2, Archive, Eye, ShieldAlert, ShieldCheck, RotateCcw, Plus, UserPlus, FileText, Hash, Copy, Snowflake, AlertTriangle, LogOut, Radio, ShieldX, Ban, Pencil, Info
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
import { isSelfOnboardedGuild, resolveOnboardingOrigin } from '@/lib/onboarding-gating';
import { GOD_STATUS_GLOSSARY, godStatusTitle } from '@/lib/god-status-glossary';

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
    /** Origine : `SYSTEM_GATEWAY` = bot invité (aucune validation humaine). */
    addedBy?: string | null;
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
            // Origine = SOURCE UNIQUE (`resolveOnboardingOrigin`) : le bot invité crée
            // déjà la ligne (`addedBy: "SYSTEM_GATEWAY"`, tier BETA) — une guilde
            // auto-onboardée était comptée « VIP Manuel » avant l'audit du 24/09.
            const isAuto = isSelfOnboardedGuild(g);
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

            const isAuto = isSelfOnboardedGuild(guild);
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
            toast.error(result.error.issues[0].message);
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
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                        Gestion des Guildes
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {filteredGuilds.length} guilde{filteredGuilds.length > 1 ? 's' : ''}
                        {search && ` · Recherche: "${search}"`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Unauthorized bot attempts button */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
                                Connexions non autorisées
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg rounded-xl border border-border bg-background p-6 text-foreground">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                                    <ShieldAlert className="h-5 w-5 text-warning" aria-hidden="true" /> Serveurs ayant invité le Bot
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Ces serveurs Discord ont ajouté le Bot SigilOS mais ne sont pas encore dans la Whitelist. Le bot y reste inactif jusqu'à votre approbation.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4 max-h-[350px] space-y-2 overflow-y-auto pr-1">
                                {guilds.filter(g => g.isWhitelistOnly && g.tier === 'PENDING').length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border bg-surface/5 p-6 text-center text-xs text-muted-foreground">
                                        Aucune tentative non autorisée
                                    </div>
                                ) : (
                                    guilds.filter(g => g.isWhitelistOnly && g.tier === 'PENDING').map(g => (
                                        <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/10 p-3">
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="truncate text-xs font-semibold text-foreground">{g.name}</div>
                                                <div className="font-mono text-xs text-muted-foreground">{g.discordGuildId}</div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={async () => {
                                                    await addAllowedGuild({ discordGuildId: g.discordGuildId, name: g.name });
                                                    toast.success(`Guilde ${g.name} Whitelistée !`);
                                                    window.location.reload();
                                                }}
                                                className="shrink-0"
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
                            <Button className="gap-2">
                                <UserPlus className="h-4 w-4" aria-hidden="true" />
                                Whitelist New Guild
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md rounded-xl border border-border bg-background p-6 text-foreground">
                            <DialogHeader>
                                <DialogTitle className="text-base font-semibold text-foreground">Autoriser une Guilde</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                    L'autorisation de première connexion permet au bot de rejoindre le serveur.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <Hash className="h-3 w-3" aria-hidden="true" /> Discord Guild ID *
                                    </label>
                                    <Input
                                        placeholder="Ex: 1234567890..."
                                        value={newGuildId}
                                        onChange={(e) => setNewGuildId(e.target.value)}
                                        className="h-11 font-mono text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <Filter className="h-3 w-3" aria-hidden="true" /> Nom de la guilde
                                    </label>
                                    <Input
                                        placeholder="Nom mémoriel"
                                        value={newGuildName}
                                        onChange={(e) => setNewGuildName(e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        <FileText className="h-3 w-3" aria-hidden="true" /> Notes (Interne)
                                    </label>
                                    <Input
                                        placeholder="Ex: Guilde de test, Premium..."
                                        value={newGuildNotes}
                                        onChange={(e) => setNewGuildNotes(e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                <Button
                                    onClick={handleAdd}
                                    disabled={isSubmitting}
                                    className="h-12 w-full rounded-lg"
                                >
                                    {isSubmitting ? "Traitement..." : "Valider l'autorisation"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Radar de Surveillance & Métriques d'Onboarding */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <button
                    onClick={() => setFilterStatus('all')}
                    aria-pressed={filterStatus === 'all'}
                    title="Toutes les guildes répertoriées, quel que soit leur statut."
                    className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === 'all' ? 'border-border-strong bg-elevated' : 'border-border bg-surface/10 hover:border-border-strong'}`}
                >
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Total</span>
                        <Users className="h-4 w-4 text-info" aria-hidden="true" />
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{radarStats.total}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Serveurs répertoriés</div>
                </button>

                <button
                    onClick={() => setFilterStatus('autonomous')}
                    aria-pressed={filterStatus === 'autonomous'}
                    title={godStatusTitle("AUTONOME")}
                    className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === 'autonomous' ? 'border-border-strong bg-elevated' : 'border-border bg-surface/10 hover:border-border-strong'}`}
                >
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Autonomes</span>
                        <Radio className="h-4 w-4 text-success" aria-hidden="true" />
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{radarStats.autonomous}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Sans validation humaine</div>
                </button>

                <button
                    onClick={() => setFilterStatus('vip')}
                    aria-pressed={filterStatus === 'vip'}
                    title={godStatusTitle("PRE_APPROUVEE")}
                    className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === 'vip' ? 'border-border-strong bg-elevated' : 'border-border bg-surface/10 hover:border-border-strong'}`}
                >
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Validées par le staff</span>
                        <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{radarStats.vip}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Whitelist God ou ticket</div>
                </button>

                <button
                    onClick={() => setFilterStatus('watch')}
                    aria-pressed={filterStatus === 'watch'}
                    title={godStatusTitle("PEU_DE_MEMBRES")}
                    className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === 'watch' ? 'border-border-strong bg-elevated' : 'border-border bg-surface/10 hover:border-border-strong'}`}
                >
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Peu de membres</span>
                        <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{radarStats.watch}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">&le; 3 profils — à vérifier</div>
                </button>

                <button
                    onClick={() => setFilterStatus('frozen')}
                    aria-pressed={filterStatus === 'frozen'}
                    title={godStatusTitle("GELEE")}
                    className={`rounded-xl border p-4 text-left transition-colors ${filterStatus === 'frozen' ? 'border-border-strong bg-elevated' : 'border-border bg-surface/10 hover:border-border-strong'}`}
                >
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Gelées / Off</span>
                        <Snowflake className="h-4 w-4 text-danger" aria-hidden="true" />
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{radarStats.frozen}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Accès coupés</div>
                </button>
            </div>

            {/* Filters Bar */}
            <div className="rounded-xl border border-border bg-surface/10 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {/* Search */}
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Recherche par nom ou ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-border bg-elevated py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
                        />
                    </div>

                    {/* Les 5 cartes ci-dessus SONT le filtre d'état : pas de menu redondant. */}

                    {/* Sort */}
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [by, order] = e.target.value.split('-');
                            setSortBy(by as SortBy);
                            setSortOrder(order as 'asc' | 'desc');
                        }}
                        className="rounded-lg border border-border bg-elevated px-4 py-2 text-sm text-foreground focus:border-border-strong focus:outline-none"
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

            <GodStatusLegend />

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface/10">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selected.size === filteredGuilds.length && filteredGuilds.length > 0}
                                        onChange={selectAll}
                                        className="h-4 w-4 cursor-pointer rounded border-border bg-elevated accent-foreground"
                                    />
                                </th>
                                <th className="p-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Guilde
                                </th>
                                <th className="hidden p-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                                    Membres
                                </th>
                                <th className="hidden p-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
                                    Statut
                                </th>
                                <th className="hidden p-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
                                    Créée
                                </th>
                                <th className="p-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        <div className="p-12 text-center text-muted-foreground">
                            Aucune guilde trouvée
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Légende dépliable des statuts (G1) — **le glossaire du plan, dans l'écran**.
 *
 * Fermée par défaut : le God qui connaît déjà les statuts n'a pas un pavé de
 * plus au-dessus du tableau. Ouverte, elle répond mot pour mot aux questions
 * « c'est quoi autonome / pré-approuvé / à surveiller / gelée-off ».
 */
function GodStatusLegend() {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-xl border border-border bg-surface/10">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="god-status-legend"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
                <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                    <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Comprendre les statuts
                </span>
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                />
            </button>
            {open ? (
                <dl
                    id="god-status-legend"
                    className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2"
                >
                    {GOD_STATUS_GLOSSARY.map((entry) => (
                        <div key={entry.id} className="space-y-1">
                            <dt className="text-xs font-semibold text-foreground">{entry.label}</dt>
                            <dd className="text-xs text-muted-foreground">{entry.description}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
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

    // Origine — SOURCE UNIQUE (`src/lib/onboarding-gating.ts`). Avant l'audit du
    // 24/09, cette ligne ne reconnaissait ni `addedBy: "SYSTEM_GATEWAY"` ni le
    // tier par défaut ⇒ toute guilde auto-onboardée s'affichait « 👑 VIP Manuel ».
    const origin = resolveOnboardingOrigin(guild);
    const isAutonomous = origin.kind === "AUTONOME";
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
        if (!confirm(`Mettre la guilde "${guild.name}" en pause ? Elle sera archivée 30 jours et son accès au dashboard coupé.`)) return;
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
        if (!confirm(`⚠️ Supprimer DÉFINITIVEMENT la guilde "${guild.name}" ? Cette action est irréversible.`)) return;
        const confirmText = prompt("Saisissez SUPPRIMER pour confirmer :");
        if (confirmText !== 'SUPPRIMER') return;

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
                label: 'En attente',
                color: 'text-muted-foreground bg-muted/40 border-border',
                tooltip: "Demande d'accès en attente d'approbation via ticket."
            }
            : {
                label: 'Approuvée',
                color: 'text-info bg-info/10 border-info/30',
                tooltip: 'Guilde autorisée mais pas encore connectée (Onboarding en attente).'
            }
        : guild.deletedAt
            ? {
                label: 'Supprimée',
                color: 'text-destructive bg-destructive/10 border-destructive/30',
                tooltip: godStatusTitle("SUPPRIMEE") + " Accès au dashboard bloqué.",
            }
            : !guild.isActive
                ? {
                    label: 'Gelée',
                    color: 'text-destructive bg-destructive/10 border-destructive/30',
                    tooltip: godStatusTitle("GELEE"),
                }
                : guild._count.profiles === 0
                    ? {
                        label: 'Inactive',
                        color: 'text-warning bg-warning/10 border-warning/30',
                        tooltip: 'Aucun membre n\'a encore créé de compte.'
                    }
                    : {
                        label: 'Active',
                        color: 'text-success bg-success/10 border-success/30',
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
            className={`group border-b border-border/60 transition-colors hover:bg-elevated/40 ${isUpdating ? 'pointer-events-none opacity-50' : ''}`}
        >
            <td className="p-4">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onSelect}
                    className="h-4 w-4 cursor-pointer rounded border-border bg-elevated accent-foreground"
                />
            </td>

            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="relative group/icon">
                        {guild.iconUrl && guild.iconUrl.length > 5 ? (
                            <img
                                src={`https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guild.iconUrl}.png?size=128`}
                                alt=""
                                className="h-10 w-10 rounded-xl border border-border bg-elevated transition-transform group-hover/icon:scale-105"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                                }}
                            />
                        ) : null}
                        <div className={`${guild.iconUrl && guild.iconUrl.length > 5 ? 'hidden' : ''} fallback-icon flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-elevated text-lg font-semibold text-foreground`}>
                            {guild.name[0]}
                        </div>
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-foreground">{guild.name}</div>
                            {/* Origin badge */}
                            {isAutonomous ? (
                                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success" title={godStatusTitle("AUTONOME")}>
                                    {origin.badge}
                                </span>
                            ) : guild.isWhitelistOnly ? (
                                <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning" title="Bot installé mais guilde jamais déployée — en attente que l'admin clique Déployer sur le portail">
                                    Bot seul — en attente de déploiement
                                </span>
                            ) : (
                                <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent" title={origin.tag === "VIP" ? godStatusTitle("TICKET") : godStatusTitle("PRE_APPROUVEE")}>
                                    {origin.badge}
                                </span>
                            )}
                            {/* Risk score badge */}
                            {isFrozen ? (
                                <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive" title={`${godStatusTitle("GELEE")} Une activation suffit à rouvrir l'accès.`}>
                                    Gelé — activation requise
                                </span>
                            ) : isWatch ? (
                                <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning" title={godStatusTitle("PEU_DE_MEMBRES")}>
                                    Peu de membres — à vérifier
                                </span>
                            ) : (
                                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-success" title="Communauté saine : accès autorisé et plus de 3 profils actifs.">
                                    Sain
                                </span>
                            )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            {guild.discordGuildId}
                            {guild.notes && (
                                <span className="max-w-[150px] truncate text-[11px] italic text-muted-foreground">
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
                            <Users className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                            <span>{guild._count.profiles}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-mono text-muted-foreground">/{guild.maxMembers}</span>
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
                                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                                    title="Modifier le nombre d'emplacements"
                                >
                                    <Pencil className="h-3 w-3" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Alert Badges (50% / 80%) */}
                    {guild.maxMembers > 0 && (guild._count.profiles / guild.maxMembers) >= 0.8 ? (
                        <div className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-center text-caption font-semibold uppercase tracking-wide text-destructive" title="Capacité de la guilde au-delà de 80 % : les nouvelles arrivées risquent d'être refusées.">
                            Seuil &gt; 80% ({Math.round((guild._count.profiles / guild.maxMembers) * 100)}%)
                        </div>
                    ) : guild.maxMembers > 0 && (guild._count.profiles / guild.maxMembers) >= 0.5 ? (
                        <div className="rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-center text-caption font-semibold uppercase tracking-wide text-warning" title="Capacité de la guilde au-delà de 50 % : surveiller la croissance avant le plafond.">
                            Capacité &gt; 50% ({Math.round((guild._count.profiles / guild.maxMembers) * 100)}%)
                        </div>
                    ) : null}

                    {/* Capacity Bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${(guild._count.profiles / guild.maxMembers) >= 0.8 ? "bg-destructive" :
                                (guild._count.profiles / guild.maxMembers) >= 0.5 ? "bg-warning" :
                                    "bg-success"
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

            <td className="hidden p-4 text-caption text-muted-foreground lg:table-cell">
                {formatDistanceToNow(new Date(guild.createdAt), { addSuffix: true, locale: fr })}
                {(!guild.isActive || !!guild.deletedAt) && (Date.now() - new Date(guild.createdAt).getTime() > SLA_FROZEN_MS) && (
                    <span className="ml-2 inline-flex items-center rounded border border-destructive/30 bg-destructive/15 px-1.5 py-0.5 font-semibold uppercase text-destructive" title="SLA God 24 h dépassée">
                        SLA
                    </span>
                )}
            </td>

            <td className="p-4">
                <div className="flex items-center justify-end gap-1">
                    {/* Gel/Dégel UNIQUEMENT via le menu (1 seul point d'entrée — pas de doublon) */}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground">
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 border border-border bg-background text-foreground">
                            <DropdownMenuLabel className="p-3 text-xs uppercase tracking-wide text-muted-foreground">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {!guild.isWhitelistOnly && (
                                <DropdownMenuItem asChild className="cursor-pointer gap-3 p-3 focus:bg-elevated focus:text-foreground">
                                    <Link href={`/god/guilds/${guild.id}`}>
                                        <Eye className="h-4 w-4" aria-hidden="true" />
                                        Inspecter le Roster
                                    </Link>
                                </DropdownMenuItem>
                            )}

                            {!isReadOnly && (
                                <>
                                    <DropdownMenuItem
                                        onClick={handleToggleFreeze}
                                        className={`cursor-pointer gap-3 p-3 ${guild.isActive ? 'focus:bg-destructive/10 focus:text-destructive' : 'focus:bg-success/10 focus:text-success'}`}
                                    >
                                        <Snowflake className="h-4 w-4" aria-hidden="true" />
                                        {guild.isActive ? "Geler l'accès au dashboard" : "Dégeler l'accès au dashboard"}
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={handleForceBotLeave}
                                        className="cursor-pointer gap-3 p-3 focus:bg-warning/10 focus:text-warning"
                                    >
                                        <LogOut className="h-4 w-4" aria-hidden="true" />
                                        Expulser le Bot Discord
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="p-3 text-xs uppercase tracking-wide text-destructive">
                                        Zone danger
                                    </DropdownMenuLabel>

                                    <DropdownMenuItem
                                        onClick={handleBanEntity}
                                        className="cursor-pointer gap-3 p-3 font-semibold focus:bg-destructive/10 focus:text-destructive"
                                    >
                                        <Ban className="h-4 w-4" aria-hidden="true" />
                                        Bannir (bloque l&apos;accès, garde les données)
                                    </DropdownMenuItem>
                                </>
                            )}

                            {guild.isWhitelistOnly ? (
                                <>
                                    {!isReadOnly && (
                                        <DropdownMenuItem
                                            onClick={handleRevokeWhitelist}
                                            className="cursor-pointer gap-3 p-3 font-semibold focus:bg-destructive/10 focus:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                                                    className="cursor-pointer gap-3 p-3 focus:bg-warning/10 focus:text-warning"
                                                >
                                                    <Archive className="h-4 w-4" aria-hidden="true" />
                                                    Archiver 30 jours (réversible)
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    onClick={handleReactivate}
                                                    className="cursor-pointer gap-3 p-3 focus:bg-success/10 focus:text-success"
                                                >
                                                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                                    Réactiver
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuItem
                                                onClick={handleHardDelete}
                                                className="cursor-pointer gap-3 p-3 focus:bg-destructive/10 focus:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                Supprimer définitivement (irréversible)
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
