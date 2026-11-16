"use client";

import { motion } from "framer-motion";
import { SystemHealthDashboard } from "./system-health-dashboard";
import { GodSectionHeader } from "../ui";

const sectionFade = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" as const },
};

interface OverviewTabsProps {
    communication: React.ReactNode;
    worker: React.ReactNode;
}

/**
 * Vue d'ensemble du God — **deux blocs de décision, pas un tableau de bord de plus**.
 *
 * Décision user du 16/11/2026 : retirer « Indicateurs plateforme » et « Activité de la
 * plateforme » (lectures massives pour une information déjà disponible ailleurs) et le
 * flux SSE de 5 s. Restent la santé des services, les annonces et la synchronisation.
 */
export function OverviewTabs({ communication, worker }: OverviewTabsProps) {
    return (
        <div className="space-y-8">
            <motion.div className="space-y-4" {...sectionFade}>
                <GodSectionHeader
                    title="État des services"
                    description="Santé des dépendances, files de jobs et tâches planifiées — lecture directe, aucune exposition publique."
                    badge="Live"
                    badgeVariant="success"
                />
                <SystemHealthDashboard />
            </motion.div>

            <motion.div
                className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3"
                {...sectionFade}
                transition={{ ...sectionFade.transition, delay: 0.1 }}
            >
                <div className="space-y-6 lg:col-span-2">{communication}</div>
                <div className="space-y-6 lg:col-span-1">{worker}</div>
            </motion.div>
        </div>
    );
}
