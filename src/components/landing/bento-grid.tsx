"use client";

import { motion } from "framer-motion";
import { siteConfig } from "@/config/site-config";
import { cn } from "@/lib/utils";
import { Sword, Scroll, Users, Shield } from "lucide-react";

const ICONS = {
    songes: Sword,
    missions: Scroll,
    directory: Users,
    security: Shield,
};

export function BentoGrid() {
    return (
        <section className="py-24 px-4 md:px-6 max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                    {siteConfig.features.title}
                </h2>
                <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
                    {siteConfig.features.subtitle}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 auto-rows-[250px]">
                {siteConfig.features.items.map((feature, i) => {
                    const Icon = ICONS[feature.id as keyof typeof ICONS] || Shield;
                    const isLarge = i === 0 || i === 3; // Make 1st and 4th card wider

                    return (
                        <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className={cn(
                                "group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-sm transition-all hover:bg-white/5",
                                isLarge ? "md:col-span-2" : "md:col-span-1"
                            )}
                        >
                            <div className="relative z-10 h-full flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/0 border border-white/5">
                                        <Icon className="w-6 h-6 text-zinc-200" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{feature.title}</h3>
                                    <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
                                </div>

                                <div className="flex items-center justify-between mt-4">
                                    <span className={cn(
                                        "text-xs font-mono px-2 py-1 rounded-full border",
                                        feature.status === "Live"
                                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                            : "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
                                    )}>
                                        {feature.status}
                                    </span>
                                </div>
                            </div>

                            {/* Hover Gradient */}
                            <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
}
