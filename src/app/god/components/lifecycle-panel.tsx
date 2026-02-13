/**
 * ♻️ GOD Dashboard - Lifecycle Management Panel
 * 
 * Manage soft-deleted entities:
 * - Guilds pending deletion
 * - User profiles pending deletion
 * - Reactivate or force hard delete
 * - Countdown to scheduled deletion
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Trash2, Clock, Building2, User } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

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
    guildName: string;
    userName: string;
    archivedAt: Date;
    archiveReason: string;
    scheduledDeletion: Date;
}

interface LifecyclePanelProps {
    guilds: SoftDeletedGuild[];
    profiles: SoftDeletedProfile[];
}

export function LifecyclePanel({ guilds, profiles }: LifecyclePanelProps) {
    const [activeTab, setActiveTab] = useState<'guilds' | 'profiles'>('guilds');

    const totalPending = guilds.length + profiles.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">
                        ♻️ Lifecycle Management
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        {totalPending} entité{totalPending > 1 ? 's' : ''} en attente de suppression définitive
                    </p>
                </div>

                {totalPending > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-amber-400 font-medium">
                            Action requise
                        </span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-zinc-800">
                <button
                    onClick={() => setActiveTab('guilds')}
                    className={`px-4 py-2 -mb-px border-b-2 transition-colors ${activeTab === 'guilds'
                        ? 'border-violet-500 text-violet-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Guildes ({guilds.length})
                    </div>
                </button>

                <button
                    onClick={() => setActiveTab('profiles')}
                    className={`px-4 py-2 -mb-px border-b-2 transition-colors ${activeTab === 'profiles'
                        ? 'border-violet-500 text-violet-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Profils ({profiles.length})
                    </div>
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'guilds' && (
                    <motion.div
                        key="guilds"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                    >
                        {guilds.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500 bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/60 rounded-xl">
                                ✅ Aucune guilde en attente de suppression
                            </div>
                        ) : (
                            guilds.map((guild) => (
                                <GuildLifecycleCard key={guild.id} guild={guild} />
                            ))
                        )}
                    </motion.div>
                )}

                {activeTab === 'profiles' && (
                    <motion.div
                        key="profiles"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                    >
                        {profiles.length === 0 ? (
                            <div className="p-12 text-center text-zinc-500 bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/60 rounded-xl">
                                ✅ Aucun profil en attente de suppression
                            </div>
                        ) : (
                            profiles.map((profile) => (
                                <ProfileLifecycleCard key={profile.id} profile={profile} />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function GuildLifecycleCard({ guild }: { guild: SoftDeletedGuild }) {
    const [loading, setLoading] = useState(false);

    // Handle null or invalid scheduledDeletion
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
                window.location.reload(); // Refresh to update UI
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
                window.location.reload(); // Refresh to update UI
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
                {/* Info */}
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

                {/* Actions */}
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

function ProfileLifecycleCard({ profile }: { profile: SoftDeletedProfile }) {
    const [loading, setLoading] = useState(false);

    // Handle null or invalid scheduledDeletion
    const daysRemaining = profile.scheduledDeletion
        ? differenceInDays(new Date(profile.scheduledDeletion), new Date())
        : null;
    const isUrgent = daysRemaining !== null && daysRemaining <= 3;

    const reasonLabel = {
        'KICKED': '👢 Kick du Discord',
        'BANNED': '🔨 Ban du Discord',
        'LEFT': '🚪 Départ volontaire',
        'GUILD_DELETED': '🏰 Guilde supprimée',
    }[profile.archiveReason] || profile.archiveReason;

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
                    <div className="font-medium">{profile.userName}</div>
                    <div className="text-xs text-zinc-500">{profile.guildName}</div>
                </div>

                <div>
                    <div className="text-zinc-500">Raison</div>
                    <div>{reasonLabel}</div>    </div>

                <div>
                    <div className="text-zinc-500">Supprimé</div>
                    <div>{formatDistanceToNow(new Date(profile.archivedAt), { addSuffix: true, locale: fr })}</div>
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
                        if (!confirm(`Supprimer définitivement le profil de ${profile.userName} ?\n\n⚠️ CETTE ACTION EST IRRÉVERSIBLE`)) return;
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
