"use client";

import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import { SystemHealthDashboard } from "./system-health-dashboard";
import { GodSectionHeader, GodCard, GodCardHeader, GodCardBody } from "../ui";

const sectionFade = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" as const },
};

interface OverviewTabsProps {
    stats: React.ReactNode;
    chart: React.ReactNode;
    communication: React.ReactNode;
    worker: React.ReactNode;
}

export function OverviewTabs({ stats, chart, communication, worker }: OverviewTabsProps) {
    return (
        <div className="space-y-12">
            {/* Section 1: System Status & Infrastructure (Immediate Full-Width Visibility) */}
            <motion.div className="space-y-4" {...sectionFade}>
                <GodSectionHeader
                    title="État des Services & Infrastructures"
                    description="Santé des services, files de jobs et infrastructure en temps réel."
                    badge="Live"
                    badgeVariant="success"
                />
                <SystemHealthDashboard />
            </motion.div>

            {/* Section 2: Unified Two-Column Layout */}
            <motion.div
                className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
                {...sectionFade}
                transition={{ ...sectionFade.transition, delay: 0.1 }}
            >
                {/* Left Column (2 Cols): Communication & System Announcements */}
                <div className="lg:col-span-2 space-y-6">
                    {communication}
                </div>

                {/* Right Column (1 Col): Worker Controls & Quick Admin Tools */}
                <div className="lg:col-span-1 space-y-6 sticky top-6">
                    {/* Worker Sync Card */}
                    <GodCard>
                        <GodCardHeader
                            title={
                                <span className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-violet-400" />
                                    Worker Sync & Diagnostic
                                </span>
                            }
                            description="Outils de forçage manuel et réinitialisation des caches externes (Ladder, Metamob, Items Dofus)."
                        />
                        <GodCardBody>{worker}</GodCardBody>
                    </GodCard>
                </div>
            </motion.div>
        </div>
    );
}
