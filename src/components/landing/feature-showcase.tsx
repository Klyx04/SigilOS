"use client";

import { motion } from "framer-motion";
import { Shield, Sword, Users, Scroll, Zap, Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const FEATURES = [
    {
        id: "missions",
        label: "Missions",
        icon: Scroll,
        title: "Gestion Hebdomadaire",
        description: "Générez et validez les missions de guilde en un clic. Analyse OCR automatique des screenshots de victoire.",
        image: "/assets/ui/feature-missions.png" // Placeholder
    },
    {
        id: "songes",
        label: "Songes Infinis",
        icon: Sword,
        title: "Organisation Tactique",
        description: "Planifiez vos runs, gérez les étages et la file d'attente. Notifications Discord automatiques.",
        image: "/assets/ui/feature-songes.png" // Placeholder
    },
    {
        id: "directory",
        label: "Annuaire",
        icon: Users,
        title: "Profils & Métiers",
        description: "Fiches membres détaillées, disponibilités et annuaire des artisans connecté.",
        image: "/assets/ui/feature-directory.png" // Placeholder
    },
    {
        id: "security",
        label: "Sécurité",
        icon: Shield,
        title: "Protection Absolue",
        description: "Architecture Zero Trust. Validation stricte des permissions et isolation des données.",
        image: "/assets/ui/feature-security.png" // Placeholder
    }
];

export function FeatureShowcase() {
    const [activeTab, setActiveTab] = useState("missions");

    return (
        <section className="py-24 px-4 relative">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        Arsenal Complet
                    </h2>
                    <p className="text-zinc-400 mt-4 max-w-2xl mx-auto">
                        Une suite d'outils conçue pour l'excellence.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Navigation Tabs */}
                    <div className="lg:col-span-4 space-y-2">
                        {FEATURES.map((feature) => (
                            <button
                                key={feature.id}
                                onClick={() => setActiveTab(feature.id)}
                                className={cn(
                                    "w-full flex items-center p-4 rounded-xl text-left transition-all duration-300 border border-transparent",
                                    activeTab === feature.id
                                        ? "bg-white/10 border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                        : "hover:bg-white/5 text-zinc-400 hover:text-white"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg mr-4 bg-gradient-to-br from-white/5 to-white/0",
                                    activeTab === feature.id ? "text-indigo-400" : "text-zinc-500"
                                )}>
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{feature.label}</h3>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="lg:col-span-8 relative min-h-[400px]">
                        {FEATURES.map((feature) => (
                            activeTab === feature.id && (
                                <motion.div
                                    key={feature.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute inset-0 bg-zinc-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-xl flex flex-col justify-center"
                                >
                                    <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                                        <feature.icon className="w-32 h-32" />
                                    </div>

                                    <h3 className="text-3xl font-bold text-white mb-4">{feature.title}</h3>
                                    <p className="text-xl text-zinc-300 leading-relaxed max-w-lg">
                                        {feature.description}
                                    </p>

                                    <div className="mt-8 flex gap-4">
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 bg-black/20 px-3 py-1 rounded-full">
                                            <Zap className="w-3 h-3 text-amber-400" />
                                            <span>Temps réel</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 bg-black/20 px-3 py-1 rounded-full">
                                            <Lock className="w-3 h-3 text-emerald-400" />
                                            <span>Sécurisé</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
