"use client";

import { motion } from "framer-motion";
import { siteConfig } from "@/config/site-config";
import { Button } from "@/components/ui/button";
import { ArrowRight, Terminal } from "lucide-react";
import { signIn } from "next-auth/react";

export function HeroSection() {
    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden px-4 md:px-6">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.04] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">

                {/* V2 Logo - Hero Centerpiece */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-32 h-32 md:w-48 md:h-48 mx-auto mb-8"
                >
                    <div className="absolute inset-0 bg-purple-500/20 blur-[50px] rounded-full animate-pulse-slow"></div>
                    <img
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS Void Egg"
                        className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)] relative z-10"
                    />
                </motion.div>

                {/* Badge Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mx-auto"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                        {siteConfig.hero.badge}
                    </span>
                </motion.div>

                {/* Main Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white font-heading"
                >
                    {siteConfig.hero.title} <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-200 to-fuchsia-400">
                        {siteConfig.hero.titleSuffix}
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-lg md:text-2xl text-zinc-400 max-w-3xl mx-auto leading-relaxed"
                >
                    {siteConfig.hero.subtitle}
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                >
                    <Button
                        size="lg"
                        className="h-12 px-8 rounded-full bg-white text-black hover:bg-zinc-200 text-base font-bold tracking-tight shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105"
                        onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
                    >
                        {siteConfig.hero.cta}
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        className="h-12 px-8 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md"
                    >
                        <Terminal className="mr-2 w-4 h-4" />
                        {siteConfig.hero.secondaryCta}
                    </Button>
                </motion.div>

                {/* Login Note */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="text-xs text-zinc-500 font-mono"
                >
                    {siteConfig.hero.loginNote}
                </motion.p>
            </div>
        </section>
    );
}
