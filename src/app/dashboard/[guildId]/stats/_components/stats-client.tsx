"use client";

import { BarChart3, Users, Star, Coins, CheckCircle2, Target, Moon, CalendarDays, HandHeart, Key } from "lucide-react";
import type { GuildStats } from "@/server/actions/guild-stats-actions";
import StatCard from "./stat-card";
import ActivityChart from "./activity-chart";
import MissionsStats from "./missions-stats";
import SongesStats from "./songes-stats";
import EventsStats from "./events-stats";
import CommunityStats from "./community-stats";
import ServicesStats from "./services-stats";
import RecordsSection from "./records-section";
import SocialStats from "./social-stats";
import MiniGamesStats from "./mini-games-stats";
import PerformanceStats from "./performance-stats";
import RetentionStats from "./retention-stats";
import { MessageSquare, Gamepad2, Timer, TrendingUp } from "lucide-react";

interface StatsClientProps {
    stats: GuildStats;
}

function formatKamas(val: number): string {
    if (val >= 1000000000) return `${(val / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} G`;
    if (val >= 1000000) return `${(val / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })} M`;
    if (val >= 1000) return `${(val / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} K`;
    return val.toLocaleString();
}

export default function StatsClient({ stats }: StatsClientProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <BarChart3
                        className="w-12 h-12 text-violet-500 drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]"
                        strokeWidth={1.5}
                    />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Statistiques Guilde</h1>
                    <p className="text-zinc-400">Vue d'ensemble de l'activité et des performances.</p>
                </div>
            </div>

            {/* KPI Cards — Row 1 (Activity) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Membres actifs" value={stats.activeMembers} accent="violet" />
                <StatCard icon={Star} label="XP Total" value={stats.totalXp.toLocaleString()} accent="teal" />
                <StatCard icon={CheckCircle2} label="Missions validées" value={stats.totalMissionsValidated} accent="emerald" />
                <StatCard icon={Target} label="Taux validation" value={`${stats.validationRate}%`} accent="rose" />
            </div>

            {/* KPI Cards — Row 2 (Kamas & Guildatons) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Coins} label="Guildatons Actuels" value={stats.totalGuildatons.toLocaleString()} accent="amber" />
                <StatCard icon={Coins} label="Guildatons Gagnés" value={(stats.totalGuildatonsEarned || 0).toLocaleString()} accent="yellow" />
                <StatCard icon={Coins} label="Kamas Collectés" value={formatKamas(stats.totalKamasCollected || 0)} accent="orange" />
                <StatCard icon={HandHeart} label="Pts Entraide" value={stats.totalEntraidePoints} accent="pink" />
            </div>

            {/* KPI Cards — Row 3 (Social/Game) */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                <StatCard icon={Moon} label="Songes complétés" value={stats.totalSongesCompleted} accent="blue" />
                <StatCard icon={CalendarDays} label="Events organisés" value={stats.totalEvents} accent="sky" />
            </div>

            {/* Activity Chart */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-violet-400" />
                    Activité — 12 dernières semaines
                </h3>
                <ActivityChart data={stats.weeklyActivity} />
            </section>

            {/* Missions & Songes — 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-teal-400" />
                        Missions
                    </h3>
                    <MissionsStats
                        categories={stats.missionsByCategory}
                        topValidators={stats.topValidators}
                        topDonors={stats.topDonors}
                    />
                </section>

                <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Moon className="w-5 h-5 text-blue-400" />
                        Songes Infinis
                    </h3>
                    <SongesStats songes={stats.songes} />
                </section>
            </div>

            {/* Events & Community & Services — 3 sections en grilles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-cyan-400" />
                        Événements
                    </h3>
                    <EventsStats events={stats.events} />
                </section>

                <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <HandHeart className="w-5 h-5 text-pink-400" />
                        Communauté & Entraide
                    </h3>
                    <CommunityStats community={stats.community} />
                </section>
            </div>

            {/* Prêts & Coffre */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-amber-400" />
                    Services Guilde — Prêts & Coffre
                </h3>
                <ServicesStats services={stats.services} />
            </section>

            {/* NEW: Discord Activity */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-violet-400" />
                    Activité Discord — Top Bavards & Vocal
                </h3>
                <SocialStats social={stats.social} />
            </section>

            {/* NEW: Mini-Games Records */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-indigo-400" />
                    Records Mini-Jeux — Hall of Fame
                </h3>
                <MiniGamesStats miniGames={stats.miniGames} />
            </section>

            {/* NEW: Admin Performance */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Timer className="w-5 h-5 text-rose-400" />
                    Performance & Réactivité — Staff Guilde
                </h3>
                <PerformanceStats performance={stats.performance} />
            </section>

            {/* NEW: Retention & Growth */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Santé de la Guilde & Rétention
                </h3>
                <RetentionStats retention={stats.retention} totalMembers={stats.activeMembers} />
            </section>

            {/* Records */}
            <section>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🏆 Records & Fun Facts
                </h3>
                <RecordsSection records={stats.records} topAchievers={stats.topAchievers} />
            </section>
        </div>
    );
}
