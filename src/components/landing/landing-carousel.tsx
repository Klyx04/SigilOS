"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const SCREENSHOTS = [
    { src: "/assets/screenshots/map-monde.png?v=2", alt: "Carte Interactive Dofus" },
    { src: "/assets/screenshots/guide-complet.png?v=2", alt: "Guide Quêtes et Succès" },
    { src: "/assets/screenshots/galerie.png?v=2", alt: "Galerie d'Images de la Guilde" },
    { src: "/assets/screenshots/recherche-donjons.png?v=2", alt: "Recherche de Groupes & Donjons" },
    { src: "/assets/screenshots/screenshot1.png?v=2", alt: "Tableau de bord SigilOS" },
    { src: "/assets/screenshots/screenshot2.png?v=2", alt: "Profil Personnel Complet" },
    { src: "/assets/screenshots/screenshot3.png?v=2", alt: "Calendrier de guilde Complet" },
    { src: "/assets/screenshots/screenshot4.png?v=2", alt: "Gestion des Songes" },
    { src: "/assets/screenshots/screenshot5.png?v=2", alt: "Intégration Metamob OCRE" },
    { src: "/assets/screenshots/screenshot6.png?v=2", alt: "Validation Missions de Guilde" },
    { src: "/assets/screenshots/screenshot7.png?v=2", alt: "Annuaire de Guilde Interne" },
    { src: "/assets/screenshots/screenshot8.png?v=2", alt: "Annuaire de Guilde Publique" },
    { src: "/assets/screenshots/screenshot9.png?v=2", alt: "Gestion des droits granulaire" },
    { src: "/assets/screenshots/screenshot10.png?v=2", alt: "Module administration complet" },
];

export function LandingCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            setDirection(1);
            setCurrentIndex((prev) => (prev + 1) % SCREENSHOTS.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isPaused]);

    const next = () => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % SCREENSHOTS.length);
    };
    const prev = () => {
        setDirection(-1);
        setCurrentIndex((prev) => (prev - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.9,
        }),
    };

    return (
        <div
            className="relative group w-full mx-auto"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Decoration Glows */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/10  rounded-full pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10  rounded-full pointer-events-none" />

            {/* Main Framework Wrap */}
            <div className="relative aspect-[16/10] md:aspect-[16/9] rounded-[2rem] md:rounded-[3rem] overflow-hidden bg-zinc-950 border border-white/10 ">
                
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-amber-500/5 opacity-50" />

                {/* Animated Image Track */}
                <div className="relative w-full h-full flex items-center justify-center">
                    <AnimatePresence initial={false} custom={direction}>
                        <motion.div
                            key={currentIndex}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.4 },
                                scale: { duration: 0.4 }
                            }}
                            className="absolute inset-0 p-2 md:p-6"
                        >
                            <div className="relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/5 shadow-inner bg-zinc-900">
                                <Image
                                    src={SCREENSHOTS[currentIndex].src}
                                    alt={SCREENSHOTS[currentIndex].alt}
                                    fill
                                    className="object-cover object-top"
                                    priority
                                    unoptimized
                                />
                                {/* Bottom masking to hide potential content cut */}
                                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent opacity-40" />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Overlays (Bezel effect) */}
                <div className="absolute inset-0 pointer-events-none border-[6px] md:border-[10px] border-zinc-950 rounded-[2rem] md:rounded-[3rem]" />
                <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-[2rem] md:rounded-[3rem]" />
            </div>

            {/* Navigation Buttons */}
            <button
                onClick={prev}
                className="absolute left-8 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:scale-110 active:scale-95 z-20"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <button
                onClick={next}
                className="absolute right-8 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:scale-110 active:scale-95 z-20"
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Indicators & Controls */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12">
                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
                    {SCREENSHOTS.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                setDirection(index > currentIndex ? 1 : -1);
                                setCurrentIndex(index);
                            }}
                            className={cn(
                                "h-1.5 transition-all duration-150 rounded-full",
                                index === currentIndex
                                    ? "w-8 bg-emerald-500 "
                                    : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
                            )}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className="p-3 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all hover:bg-white/10"
                    >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    
                    <div className="h-4 w-px bg-white/10 mx-2" />

                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider min-w-[200px] text-center">
                        {SCREENSHOTS[currentIndex].alt}
                    </p>
                </div>
            </div>
        </div>
    );
}
