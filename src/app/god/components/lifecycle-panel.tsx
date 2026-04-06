/**
 * ♻️ GOD Dashboard - Lifecycle Management Panel
 * 
 * Manage soft-deleted entities + Platform Bans:
 * - Tab 1: Guilds pending deletion
 * - Tab 2: Profiles pending deletion
 * - Tab 3: Archived profiles (orphans) with filters
 * - Tab 4: Platform bans (guilds + users)
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, RefreshCw, Trash2, Clock, Building2, User,
    ShieldBan, Filter, Archive, Ban, UserX, Info, Search, Copy, Calendar, MousePointer2, CalendarCheck, Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cleanupGhostUsers, deleteGhostUser } from "@/server/actions/super-admin-actions";
import { JanitorButton } from '../janitor-button';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// ====================
// Types
// ====================

interface SoftDeletedGuild {
    id: string;
    name: string;
    deletedAt: Date;
    deletionReason: string;
    scheduledDeletion: Date;
    _count: {
        profiles: number;
    };
}

interface SoftDeletedProfile {
    id: string;
    archivedAt: Date | null;
    archiveReason: string | null;
    scheduledDeletion: Date | null;
    guild: { name: string };
    user: { name: string | null };
}

interface ArchivedProfile {
    id: string;
    archivedAt: Date | null;
    archiveReason: string | null;
    guild: { name: string };
    user: { name: string | null };
}

interface PlatformBanItem {
    id: string;
    entityType: string;
    discordId: string;
    reason: string;
    bannedBy: string;
    createdAt: Date;
}

interface ActiveGuild {
    id: string;
    name: string;
}

interface GhostUser {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: Date;
    _count: {
        sessions: number;
        guildEvents: number;
    };
    memberInWhitelists?: string[];
}

type TabId = 'guilds' | 'profiles' | 'orphans' | 'bans' | 'ghosts' | 'unauthorized';

interface LifecyclePanelProps {
    guilds: SoftDeletedGuild[];
    profiles: SoftDeletedProfile[];
    archivedProfiles: ArchivedProfile[];
    bans: PlatformBanItem[];
    activeGuilds: ActiveGuild[];
    ghostUsers: GhostUser[];
    unauthorizedConnections: Array<{ id: string; name: string; icon: string | null }>;
}

// ====================
// Main Panel
// ====================

export function LifecyclePanel({
    guilds,
    profiles,
    archivedProfiles,
    bans,
    activeGuilds,
    ghostUsers,
    unauthorizedConnections = []
}: LifecyclePanelProps) {
    const [activeTab, setActiveTab] = useState<TabId>('guilds');

    const totalPending = guilds.length + profiles.length + unauthorizedConnections.length;

    const tabs: { id: TabId; label: string; icon: React.ReactNode; count: number; color: string }[] = [
        { id: 'guilds', label: 'Guildes', icon: <Building2 className="w-4 h-4" />, count: guilds.length, color: 'text-amber-400' },
        { id: 'profiles', label: 'Profils', icon: <User className="w-4 h-4" />, count: profiles.length, color: 'text-rose-400' },
        { id: 'unauthorized', label: 'Suspects', icon: <ShieldBan className="w-4 h-4" />, count: unauthorizedConnections.length, color: 'text-orange-500' },
        { id: 'ghosts', label: 'Fantômes', icon: <UserX className="w-4 h-4" />, count: ghostUsers.length, color: 'text-purple-400' },
        { id: 'orphans', label: 'Orphelins', icon: <Archive className="w-4 h-4" />, count: archivedProfiles.length, color: 'text-zinc-400' },
        { id: 'bans', label: 'Bannis', icon: <ShieldBan className="w-4 h-4" />, count: bans.length, color: 'text-red-500' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-tighter">
                        🛠️ State & Maintenance
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest leading-relaxed">
                        Gestion centralisée du cycle de vie des données, des fantômes et de la sécurité plateforme.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {totalPending > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                                Attention ({totalPending} Anomalies)
                            </span>
                        </div>
                    )}
                    {/* The sidebar is now part of the content flow or available via tabs */}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 -mb-px border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'border-violet-500 text-violet-400'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {tab.icon}
                            {tab.label} ({tab.count})
                        </div>
                    </button>
                ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                    <TabContent key="guilds">
                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl mb-4 flex items-start gap-4">
                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500">Hygiène des Guildes</h4>
                                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                    <strong>Réactiver :</strong> Restaure l'accès immédiat et annule le compte à rebours. <br/>
                                    <strong>Supprimer :</strong> Efface PHYSIQUEMENT toutes les données (Missions, Stocks, Roster) de la base. Action IRRÉVERSIBLE.
                                </p>
                            </div>
                        </div>
                        {guilds.length === 0 ? (
                            <EmptyState>✅ Aucune guilde en attente de suppression</EmptyState>
                        ) : (
                            guilds.map((guild) => (
                                <GuildLifecycleCard key={guild.id} guild={guild} />
                            ))
                        )}
                    </TabContent>

                {activeTab === 'profiles' && (
                    <TabContent key="profiles">
                        {profiles.length === 0 ? (
                            <EmptyState>✅ Aucun profil en attente de suppression</EmptyState>
                        ) : (
                            profiles.map((profile) => (
                                <ProfileLifecycleCard key={profile.id} profile={profile} />
                            ))
                        )}
                    </TabContent>
                )}

                {activeTab === 'unauthorized' && (
                    <TabContent key="unauthorized">
                         <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl mb-4 flex items-start gap-4">
                            <ShieldBan className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500">Connexions non autorisées</h4>
                                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                    Ces serveurs Discord ont ajouté le bot mais ne sont PAS dans la liste blanche (Whitelist). 
                                    Le bot est inactif sur ces serveurs mais consomme des ressources de gateway.
                                </p>
                            </div>
                        </div>
                        {unauthorizedConnections.length === 0 ? (
                            <EmptyState>✅ Aucune connexion parasite détectée</EmptyState>
                        ) : (
                            <div className="space-y-2">
                                {unauthorizedConnections.map(g => (
                                    <div key={g.id} className="flex items-center justify-between p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            {g.icon ? (
                                                <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} className="w-10 h-10 rounded-lg" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-600">?</div>
                                            )}
                                            <div>
                                                <div className="font-bold text-sm text-zinc-200">{g.name}</div>
                                                <div className="text-[10px] font-mono text-zinc-500">{g.id}</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={async () => {
                                                if(!confirm(`Bannir cette guilde (${g.name}) de la plateforme ?`)) return;
                                                const { banEntity } = await import('@/server/actions/god-lifecycle-actions');
                                                await banEntity('GUILD', g.id, "Connexion non autorisée détectée");
                                                window.location.reload();
                                            }}
                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-black uppercase tracking-widest"
                                        >
                                            Bannir
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabContent>
                )}

                {activeTab === 'ghosts' && (
                    <TabContent key="ghosts">
                         <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl mb-4 flex items-start gap-4">
                            <Info className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">Nettoyage des Fantômes</h4>
                                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                    Comptes Discord sans profil de guilde (vieux de <strong>&gt;24h</strong> - GDPR). 
                                    La purge supprime l'entrée "User" et les sessions de connexion. 
                                    Aucune perte de progression métier/xp possible ici.
                                </p>
                            </div>
                            <div className="ml-auto">
                                <JanitorButton />
                            </div>
                        </div>
                        <GhostPurgeTab users={ghostUsers} />
                    </TabContent>
                )}

                {activeTab === 'orphans' && (
                    <TabContent key="orphans">
                         <div className="p-4 bg-zinc-500/5 border border-zinc-500/10 rounded-xl mb-4 flex items-start gap-4">
                            <Archive className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nettoyage technique</h4>
                                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                    Profils existants sans compte Discord lié (suite à une désynchronisation ou suppression manuelle brute).
                                </p>
                            </div>
                            <div className="ml-auto">
                                <JanitorButton />
                            </div>
                        </div>
                        <OrphanPanel profiles={archivedProfiles} activeGuilds={activeGuilds} />
                    </TabContent>
                )}

                {activeTab === 'bans' && (
                    <TabContent key="bans">
                        <section className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl mb-4 flex items-start gap-4">
                            <ShieldBan className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500">Zone de Bannissement</h4>
                                <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                                   Le ban plateforme bloque l'accès au BOT sur TOUTES les guildes pour l'ID spécifié. 
                                   Pour une guilde bannie, le bot ne répondra plus à aucune commande sur ce serveur.
                                </p>
                            </div>
                        </section>
                        <BanPanel bans={bans} />
                    </TabContent>
                )}
            </AnimatePresence>
        </div>
    );
}

// ====================
// Shared Components
// ====================

function TabContent({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
            {...props}
        >
            {children}
        </motion.div>
    );
}

function EmptyState({ children }: { children: React.ReactNode }) {
    return (
        <div className="p-12 text-center text-zinc-500 bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/60 rounded-xl">
            {children}
        </div>
    );
}

// ====================
// Guild Card (unchanged behavior)
// ====================

function GuildLifecycleCard({ guild }: { guild: SoftDeletedGuild }) {
    const [loading, setLoading] = useState(false);

    const daysRemaining = guild.scheduledDeletion
        ? differenceInDays(new Date(guild.scheduledDeletion), new Date())
        : null;
    const isUrgent = daysRemaining !== null && daysRemaining <= 7;

    const reasonLabel = {
        'SERVER_DELETED': '🏰 Serveur Discord supprimé',
        'BOT_REMOVED': '🤖 Bot retiré du serveur',
        'ADMIN_REQUEST': '👮 Demande administrateur',
    }[guild.deletionReason] || guild.deletionReason;

    const handleReactivate = async () => {
        setLoading(true);
        try {
            const { reactivateGuild } = await import('@/server/actions/god-lifecycle-actions');
            const result = await reactivateGuild(guild.id);
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.error || 'Erreur lors de la réactivation');
            }
        } catch (error) {
            console.error('[LifecyclePanel] Reactivate error:', error);
            alert('Erreur lors de la réactivation');
        } finally {
            setLoading(false);
        }
    };

    const handleHardDelete = async () => {
        if (!confirm(`Supprimer définitivement "${guild.name}" et ses ${guild._count.profiles} profils ?\n\n⚠️ CETTE ACTION EST IRRÉVERSIBLE`)) return;
        setLoading(true);
        try {
            const { hardDeleteGuild } = await import('@/server/actions/god-lifecycle-actions');
            const result = await hardDeleteGuild(guild.id);
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.error || 'Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('[LifecyclePanel] Hard delete error:', error);
            alert('Erreur lors de la suppression');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            layout
            className={`
        relative overflow-hidden rounded-xl p-5
        bg-zinc-900/30 backdrop-blur-sm
        border ${isUrgent ? 'border-red-500/30' : 'border-zinc-800/60'}
        ${isUrgent ? 'shadow-lg shadow-red-500/10' : ''}
      `}
        >
            {isUrgent && (
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent" />
            )}

            <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{guild.name}</h3>
                        {isUrgent && (
                            <div className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium">
                                ⚠️ Urgent
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-zinc-500">Raison</div>
                            <div className="font-medium">{reasonLabel}</div>
                        </div>
                        <div>
                            <div className="text-zinc-500">Membres affectés</div>
                            <div className="font-medium">{guild._count.profiles}</div>
                        </div>
                        <div>
                            <div className="text-zinc-500">Supprimé</div>
                            <div className="font-medium">
                                {formatDistanceToNow(new Date(guild.deletedAt), { addSuffix: true, locale: fr })}
                            </div>
                        </div>
                        <div>
                            <div className="text-zinc-500">Suppression définitive</div>
                            <div className={`font-medium flex items-center gap-1 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
                                <Clock className="w-3 h-3" />
                                {daysRemaining !== null ? `Dans ${daysRemaining}j` : 'Non planifiée'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleReactivate}
                        disabled={loading}
                        className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Réactiver
                    </button>
                    <button
                        onClick={handleHardDelete}
                        disabled={loading}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ====================
// Profile Card (unchanged behavior)
// ====================

function ProfileLifecycleCard({ profile }: { profile: SoftDeletedProfile }) {
    const [loading, setLoading] = useState(false);

    const daysRemaining = profile.scheduledDeletion
        ? differenceInDays(new Date(profile.scheduledDeletion), new Date())
        : null;
    const isUrgent = daysRemaining !== null && daysRemaining <= 3;

    const reasonLabel = (profile.archiveReason ? (({
        'KICKED': '👢 Kick du Discord',
        'BANNED': '🔨 Ban du Discord',
        'LEFT': '🚪 Départ volontaire',
        'GUILD_DELETED': '🏰 Guilde supprimée',
    } as any)[profile.archiveReason]) : 'Raison inconnue') || profile.archiveReason;

    return (
        <motion.div
            layout
            className={`
        flex items-center justify-between p-4
        bg-zinc-900/30 backdrop-blur-sm
        border ${isUrgent ? 'border-red-500/30' : 'border-zinc-800/60'}
        rounded-lg
      `}
        >
            <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                <div>
                    <div className="font-medium text-zinc-200">{profile.user.name || 'Inconnu'}</div>
                    <div className="text-xs text-zinc-500">{profile.guild.name}</div>
                </div>
                <div>
                    <div className="text-zinc-500">Raison</div>
                    <div>{reasonLabel}</div>    </div>
                <div>
                    <div className="text-zinc-500">Supprimé</div>
                    <div>{profile.archivedAt ? formatDistanceToNow(new Date(profile.archivedAt), { addSuffix: true, locale: fr }) : '—'}</div>
                </div>
                <div>
                    <div className="text-zinc-500">Dans</div>
                    <div className={isUrgent ? 'text-red-400 font-medium' : ''}>
                        {daysRemaining !== null ? `${daysRemaining}j` : 'Non planifiée'}
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={async () => {
                        setLoading(true);
                        try {
                            const { reactivateProfile } = await import('@/server/actions/god-lifecycle-actions');
                            const result = await reactivateProfile(profile.id);
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.error || 'Erreur lors de la réactivation');
                            }
                        } catch (error) {
                            console.error('[LifecyclePanel] Reactivate profile error:', error);
                            alert('Erreur lors de la réactivation');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                    className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors disabled:opacity-50"
                    title="Réactiver"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <button
                    onClick={async () => {
                        if (!confirm(`Supprimer définitivement le profil de ${profile.user.name || 'cet utilisateur'} ?\n\n⚠️ CETTE ACTION EST IRRÉVERSIBLE`)) return;
                        setLoading(true);
                        try {
                            const { hardDeleteProfile } = await import('@/server/actions/god-lifecycle-actions');
                            const result = await hardDeleteProfile(profile.id);
                            if (result.success) {
                                window.location.reload();
                            } else {
                                alert(result.error || 'Erreur lors de la suppression');
                            }
                        } catch (error) {
                            console.error('[LifecyclePanel] Hard delete profile error:', error);
                            alert('Erreur lors de la suppression');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors disabled:opacity-50"
                    title="Supprimer"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}

// ====================
// Orphan Panel (NEW - filtered archived profiles)
// ====================

function OrphanPanel({
    profiles,
    activeGuilds,
}: {
    profiles: ArchivedProfile[];
    activeGuilds: ActiveGuild[];
}) {
    const [filterGuild, setFilterGuild] = useState<string>('');
    const [filterReason, setFilterReason] = useState<string>('');

    const filtered = profiles.filter((p) => {
        if (filterGuild && p.guild.name !== filterGuild) return false;
        if (filterReason && p.archiveReason !== filterReason) return false;
        return true;
    });

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Filter className="w-4 h-4" />
                    Filtres :
                </div>

                <select
                    value={filterGuild}
                    onChange={(e) => setFilterGuild(e.target.value)}
                    className="px-3 py-1.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
                >
                    <option value="">Toutes les guildes</option>
                    {activeGuilds.map((g) => (
                        <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                </select>

                <select
                    value={filterReason}
                    onChange={(e) => setFilterReason(e.target.value)}
                    className="px-3 py-1.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-violet-500/50"
                >
                    <option value="">Toutes les raisons</option>
                    <option value="LEFT">🚪 Départ</option>
                    <option value="KICKED">👢 Kick</option>
                    <option value="BANNED">🔨 Ban</option>
                    <option value="GUILD_DELETED">🏰 Guilde supprimée</option>
                </select>

                {(filterGuild || filterReason) && (
                    <button
                        onClick={() => { setFilterGuild(''); setFilterReason(''); }}
                        className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                    >
                        Réinitialiser
                    </button>
                )}
            </div>

            {/* Results */}
            <div className="text-xs text-zinc-600 mb-2">
                {filtered.length} profil{filtered.length > 1 ? 's' : ''} archivé{filtered.length > 1 ? 's' : ''}
            </div>

            {filtered.length === 0 ? (
                <EmptyState>✅ Aucun profil orphelin</EmptyState>
            ) : (
                <div className="space-y-2">
                    {filtered.map((profile) => (
                        <div
                            key={profile.id}
                            className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800/60 rounded-lg text-sm"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-zinc-500 text-xs shadow-inner">
                                    <Archive className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-medium text-zinc-200">{profile.user.name || 'Inconnu'}</div>
                                    <div className="text-xs text-zinc-500">{profile.guild.name}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-zinc-500 text-xs">
                                    {{
                                        'LEFT': '🚪 Départ',
                                        'KICKED': '👢 Kick',
                                        'BANNED': '🔨 Ban',
                                        'GUILD_DELETED': '🏰 Guilde',
                                    }[profile.archiveReason || ''] || profile.archiveReason}
                                </div>
                                <div className="text-zinc-600 text-xs">
                                    {profile.archivedAt
                                        ? formatDistanceToNow(new Date(profile.archivedAt), { addSuffix: true, locale: fr })
                                        : '—'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ====================
// Ban Panel (NEW - platform bans)
// ====================

function BanPanel({ bans }: { bans: PlatformBanItem[] }) {
    const [loading, setLoading] = useState<string | null>(null);
    const [showBanForm, setShowBanForm] = useState(false);
    const [banType, setBanType] = useState<'GUILD' | 'USER'>('GUILD');
    const [banDiscordId, setBanDiscordId] = useState('');
    const [banReason, setBanReason] = useState('');

    const handleUnban = async (banId: string) => {
        if (!confirm('Lever ce ban plateforme ?')) return;
        setLoading(banId);
        try {
            const { unbanEntity } = await import('@/server/actions/god-lifecycle-actions');
            const result = await unbanEntity(banId);
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.error || 'Erreur');
            }
        } catch (error) {
            console.error('[BanPanel] Unban error:', error);
            alert('Erreur lors du débannissement');
        } finally {
            setLoading(null);
        }
    };

    const handleBan = async () => {
        if (!banDiscordId.trim() || !banReason.trim()) return;
        if (!confirm(`Bannir ${banType === 'GUILD' ? 'la guilde' : "l'utilisateur"} ${banDiscordId} de SigilOS ?\n\nRaison : ${banReason}`)) return;

        setLoading('new');
        try {
            const { banEntity } = await import('@/server/actions/god-lifecycle-actions');
            const result = await banEntity(banType, banDiscordId.trim(), banReason.trim());
            if (result.success) {
                window.location.reload();
            } else {
                alert(result.error || 'Erreur');
            }
        } catch (error) {
            console.error('[BanPanel] Ban error:', error);
            alert('Erreur lors du bannissement');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Add Ban */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowBanForm(!showBanForm)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-medium text-sm transition-colors flex items-center gap-2"
                >
                    <Ban className="w-4 h-4" />
                    {showBanForm ? 'Annuler' : 'Nouveau ban'}
                </button>
            </div>

            {/* Ban Form */}
            <AnimatePresence>
                {showBanForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                            <div className="flex gap-3">
                                <select
                                    value={banType}
                                    onChange={(e) => setBanType(e.target.value as 'GUILD' | 'USER')}
                                    className="px-3 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-red-500/50"
                                >
                                    <option value="GUILD">🏰 Guilde</option>
                                    <option value="USER">👤 Utilisateur</option>
                                </select>

                                <input
                                    type="text"
                                    value={banDiscordId}
                                    onChange={(e) => setBanDiscordId(e.target.value)}
                                    placeholder="Discord ID"
                                    className="flex-1 px-3 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
                                />
                            </div>

                            <input
                                type="text"
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                placeholder="Raison du ban..."
                                className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
                            />

                            <button
                                onClick={handleBan}
                                disabled={!banDiscordId.trim() || !banReason.trim() || loading === 'new'}
                                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <ShieldBan className="w-4 h-4" />
                                Bannir de SigilOS
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Ban List */}
            {bans.length === 0 ? (
                <EmptyState>✅ Aucun ban plateforme actif</EmptyState>
            ) : (
                <div className="space-y-2">
                    {bans.map((ban) => (
                        <div
                            key={ban.id}
                            className="flex items-center justify-between p-4 bg-zinc-900/30 border border-red-500/10 rounded-lg"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`px-2 py-1 rounded text-xs font-medium ${ban.entityType === 'GUILD'
                                    ? 'bg-violet-500/20 text-violet-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {ban.entityType === 'GUILD' ? '🏰 Guilde' : '👤 User'}
                                </div>
                                <div>
                                    <div className="font-mono text-sm text-zinc-300">{ban.discordId}</div>
                                    <div className="text-xs text-zinc-500">{ban.reason}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-xs text-zinc-600">
                                    {formatDistanceToNow(new Date(ban.createdAt), { addSuffix: true, locale: fr })}
                                </div>
                                <button
                                    onClick={() => handleUnban(ban.id)}
                                    disabled={loading === ban.id}
                                    className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                    Lever le ban
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ====================
// Ghost Purge Sub-Panel (Integrated)
// ====================

function GhostPurgeTab({ users }: { users: GhostUser[] }) {
    const [isPurgingAll, setIsPurgingAll] = useState(false);
    const [purgingId, setPurgingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const filtered = users.filter(u => 
        !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase())
    );

    const handlePurgeAll = async () => {
        if (!confirm("Voulez-vous purger TOUS les fantômes (comptes sans profil) vieux de plus de 24h ?")) return;
        setIsPurgingAll(true);
        try {
            const res = await cleanupGhostUsers();
            if (res.success) toast.success(`${res.count} fantômes purgés.`);
            else toast.error("Erreur.");
        } finally { setIsPurgingAll(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative group flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <Input 
                        placeholder="Rechercher Fantôme..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-zinc-900/50 border-zinc-800"
                    />
                </div>
                <Button variant="destructive" size="sm" onClick={handlePurgeAll} disabled={isPurgingAll || users.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" /> Tout Purger
                </Button>
            </div>

            <div className="space-y-2">
                {filtered.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800/60 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                                <UserX className="w-4 h-4 text-zinc-500" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-zinc-300">{user.name || 'Fantôme Inconnu'}</div>
                                <div className="text-[10px] text-zinc-600 font-mono tracking-tighter">{user.id}</div>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={async () => {
                                if(!confirm('Supprimer ce compte Discord ?')) return;
                                setPurgingId(user.id);
                                try {
                                    await deleteGhostUser(user.id);
                                } finally {
                                    setPurgingId(null);
                                }
                            }}
                            disabled={purgingId === user.id}
                        >
                            {purgingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-zinc-600 hover:text-red-500" />}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
