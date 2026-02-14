/**
 * 🎨 GOD Dashboard - Live Stats Component
 * 
 * Premium real-time stats with:
 * - SSE streaming updates
 * - Smooth count animations
 * - Trend indicators
 * - Glassmorphism + gradients
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, FileText, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
}

interface StatCardProps {
    label: string;
    value: number;
    trend?: number;
    color: 'violet' | 'green' | 'amber' | 'cyan';
    icon: string; // Emoji as string
    realtime?: boolean;
}

export function LiveStats({ initialStats }: { initialStats: PlatformStats }) {
    const [stats, setStats] = useState(initialStats);

    // SSE connection for real-time updates
    useEffect(() => {
        const eventSource = new EventSource('/api/god/stats/stream');

        eventSource.onmessage = (event) => {
            const newStats = JSON.parse(event.data);
            setStats(newStats);
        };

        eventSource.onerror = () => {
            console.warn('[GOD] SSE connection lost, retrying...');
            eventSource.close();
        };

        return () => eventSource.close();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard
                label="Guildes Totales"
                value={stats.guilds}
                trend={stats.guildsTrend}
                color="violet"
                icon="🏰"
                realtime
            />

            <StatCard
                label="Unités Actives"
                value={stats.activeGuilds}
                color="green"
                icon="✨"
                realtime
            />

            <StatCard
                label="Aventuriers"
                value={stats.users}
                trend={stats.usersTrend}
                color="cyan"
                icon="👥"
                realtime
            />

            <StatCard
                label="Profils Synchro"
                value={stats.activeProfiles}
                color="green"
                icon="👤"
                realtime
            />

            <StatCard
                label="Missions Actives"
                value={stats.missions}
                trend={stats.missionsTrend}
                color="amber"
                icon="📋"
                realtime
            />
        </div>
    );
}

function StatCard({ label, value, trend, color, icon, realtime }: StatCardProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const [isAnimating, setIsAnimating] = useState(false);

    // Smooth number animation when value changes
    useEffect(() => {
        if (displayValue === value) return;

        setIsAnimating(true);
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

            if (currentStep >= steps) {
                clearInterval(interval);
                setIsAnimating(false);
            }
        }, duration / steps);

        return () => clearInterval(interval);
    }, [value, displayValue]);

    const colorConfig = {
        violet: {
            gradient: 'from-violet-500/20 via-violet-500/10 to-transparent',
            border: 'border-violet-500/30',
            text: 'text-violet-400',
            glow: 'shadow-violet-500/20',
            icon: 'text-violet-400'
        },
        green: {
            gradient: 'from-green-500/20 via-green-500/10 to-transparent',
            border: 'border-green-500/30',
            text: 'text-green-400',
            glow: 'shadow-green-500/20',
            icon: 'text-green-400'
        },
        amber: {
            gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
            border: 'border-amber-500/30',
            text: 'text-amber-400',
            glow: 'shadow-amber-500/20',
            icon: 'text-amber-400'
        },
        cyan: {
            gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
            border: 'border-cyan-500/30',
            text: 'text-cyan-400',
            glow: 'shadow-cyan-500/20',
            icon: 'text-cyan-400'
        }
    }[color];

    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -5 }}
            className={`
        relative overflow-hidden rounded-3xl
        bg-zinc-900/30 backdrop-blur-xl
        border ${colorConfig.border}
        shadow-2xl ${colorConfig.glow}
        p-8
        group
        transition-all duration-500
      `}
        >
            {/* Animated gradient background */}
            <div className={`
        absolute inset-0 bg-gradient-to-br ${colorConfig.gradient}
        opacity-0 group-hover:opacity-100
        transition-opacity duration-500
      `} />

            {/* Content */}
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className={`text-4xl ${colorConfig.icon} drop-shadow-lg group-hover:scale-110 transition-transform`}>
                        {icon}
                    </div>

                    {realtime && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-2 h-2 rounded-full bg-emerald-500"
                            />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
                        </div>
                    )}
                </div>

                <div className={`text-4xl md:text-5xl font-black ${colorConfig.text} mb-2 tracking-tighter leading-none`}>
                    {isNaN(displayValue) ? '0' : Math.round(displayValue).toLocaleString()}
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">
                        {label}
                    </div>

                    {trend !== undefined && trend !== 0 && (
                        <TrendIndicator value={trend} />
                    )}
                </div>
            </div>

            {/* Shimmer effect on animation */}
            {isAnimating && (
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 0.8 }}
                />
            )}
        </motion.div>
    );
}

function TrendIndicator({ value }: { value: number }) {
    const isPositive = value > 0;
    const isNegative = value < 0;

    return (
        <div className={`
      flex items-center gap-1 text-xs font-medium
      ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-zinc-500'}
    `}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
            {isPositive && '+'}{value}
        </div>
    );
}
