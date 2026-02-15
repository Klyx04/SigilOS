/**
 * 🎨 GOD Dashboard - Live Stats Component (Refactored for Clarity)
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlatformStats {
    guilds: number;
    guildsTrend: number;
    activeGuilds: number;
    users: number;
    usersTrend: number;
    profiles: number;
    activeProfiles: number;
    missions: number;
    missionsTrend: number;
    weeklyActiveUsers: number;
    retentionRate: number;
    density: number;
}

interface StatCardProps {
    label: string;
    value: number;
    trend?: number;
    suffix?: string;
    color: 'violet' | 'green' | 'amber' | 'cyan' | 'blue';
    icon: string;
    realtime?: boolean;
    description?: string;
}

export function LiveStats({ initialStats }: { initialStats: PlatformStats }) {
    const [stats, setStats] = useState(initialStats);

    useEffect(() => {
        const eventSource = new EventSource('/api/god/stats/stream');

        eventSource.onmessage = (event) => {
            const newStats = JSON.parse(event.data);
            setStats(newStats);
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <StatCard
                label="Guildes"
                value={stats.guilds}
                trend={stats.guildsTrend}
                color="violet"
                icon="🏰"
                description="Total des guildes enregistrées"
                realtime
            />

            <StatCard
                label="Aventuriers"
                value={stats.users}
                trend={stats.usersTrend}
                color="blue"
                icon="👥"
                description="Membres totaux SigilOS"
                realtime
            />

            <StatCard
                label="Actifs (7j)"
                value={stats.weeklyActiveUsers}
                color="green"
                icon="⚡"
                description="Utilisateurs uniques sur 7 jours"
                realtime
            />

            <StatCard
                label="Missions"
                value={stats.missions}
                trend={stats.missionsTrend}
                color="amber"
                icon="📋"
                description="Total des quêtes validées"
                realtime
            />

            <StatCard
                label="Engagement"
                value={stats.retentionRate}
                suffix="%"
                color="cyan"
                icon="📊"
                description="Adhésion profil / compte"
            />
        </div>
    );
}

function StatCard({ label, value, trend, suffix = "", color, icon, realtime, description }: StatCardProps) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        if (displayValue === value) return;
        const duration = 1000;
        const steps = 30;
        const stepValue = (value - displayValue) / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
            currentStep++;
            setDisplayValue(prev => {
                const newValue = prev + stepValue;
                return currentStep >= steps ? value : newValue;
            });
            if (currentStep >= steps) clearInterval(interval);
        }, duration / steps);

        return () => clearInterval(interval);
    }, [value, displayValue]);

    const colorConfig = {
        violet: 'border-violet-500/30 text-violet-400 shadow-violet-500/20 from-violet-500/20',
        green: 'border-green-500/30 text-green-400 shadow-green-500/20 from-green-500/20',
        amber: 'border-amber-500/30 text-amber-400 shadow-amber-500/20 from-amber-500/20',
        cyan: 'border-cyan-500/30 text-cyan-400 shadow-cyan-500/20 from-cyan-500/20',
        blue: 'border-blue-500/30 text-blue-400 shadow-blue-500/20 from-blue-500/20'
    }[color];

    return (
        <motion.div
            whileHover={{ scale: 1.02, y: -5 }}
            className={`relative overflow-hidden rounded-3xl bg-zinc-900/40 backdrop-blur-xl border ${colorConfig.split(' ')[0]} shadow-2xl p-6 group transition-all duration-500`}
        >
            <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.split(' ').pop()} via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                        {icon}
                    </div>
                    {realtime && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
                        </div>
                    )}
                </div>

                <div>
                    <div className={`text-4xl font-black ${colorConfig.split(' ')[1]} mb-1 tracking-tighter leading-none`}>
                        {isNaN(displayValue) ? '0' : Math.round(displayValue).toLocaleString()}{suffix}
                    </div>
                    <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">{label}</div>
                    {description && <div className="text-[9px] text-zinc-500 font-medium leading-none">{description}</div>}
                </div>

                {trend !== undefined && trend !== 0 && (
                    <div className="mt-4 flex items-center gap-1 text-[10px] font-bold">
                        {trend > 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                        <span className={trend > 0 ? "text-green-400" : "text-red-400"}>
                            {trend > 0 ? '+' : ''}{trend} (24h)
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
