"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const SCREENSHOTS = [
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

    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % SCREENSHOTS.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isPaused]);

    const next = () => setCurrentIndex((prev) => (prev + 1) % SCREENSHOTS.length);
    const prev = () => setCurrentIndex((prev) => (prev - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);

    return (
        <div
            className="relative group w-full mx-auto"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Main Framework Wrap */}
            <div className="relative aspect-[16/10] md:aspect-[16/9] rounded-[2rem] md:rounded-[3rem] overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl shadow-accent-teal/10">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/10 via-transparent to-accent-gold/5 opacity-50" />

                {/* Image Track */}
                <div className="relative w-full h-full">
                    {SCREENSHOTS.map((screenshot, index) => (
                        <div
                            key={index}
                            className={cn(
                                "absolute inset-0 transition-all duration-1000 ease-in-out transform",
                                index === currentIndex
                                    ? "opacity-100 scale-100 translate-x-0"
                                    : index < currentIndex
                                        ? "opacity-0 scale-95 -translate-x-full"
                                        : "opacity-0 scale-95 translate-x-full"
                            )}
                        >
                            <Image
                                src={screenshot.src}
                                alt={screenshot.alt}
                                fill
                                className="object-cover object-top p-2 md:p-4 rounded-[2rem] md:rounded-[3rem]"
                                priority={index === 0}
                                unoptimized
                            />
                        </div>
                    ))}
                </div>

                {/* Overlays */}
                <div className="absolute inset-0 pointer-events-none border-[8px] md:border-[12px] border-zinc-950/80 rounded-[2rem] md:rounded-[3rem]" />
                <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-[2rem] md:rounded-[3rem]" />
            </div>

            {/* Navigation Buttons */}
            <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:scale-110 active:scale-95 z-20"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 hover:scale-110 active:scale-95 z-20"
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Indicators & Controls */}
            <div className="flex items-center justify-center gap-6 mt-12">
                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
                    {SCREENSHOTS.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={cn(
                                "h-1.5 transition-all duration-500 rounded-full",
                                index === currentIndex
                                    ? "w-8 bg-accent-teal shadow-[0_0_15px_rgba(42,191,176,0.5)]"
                                    : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
                            )}
                        />
                    ))}
                </div>

                <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-3 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all hover:bg-white/10"
                >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
            </div>

            {/* Title Display */}
            <div className="text-center mt-6">
                <p className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em] h-4">
                    {SCREENSHOTS[currentIndex].alt}
                </p>
            </div>
        </div>
    );
}
