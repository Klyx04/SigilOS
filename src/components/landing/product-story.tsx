"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const STORIES = [
    {
        id: "guides",
        label: "Guides",
        title: "Une quête devient un rendez-vous de guilde.",
        description:
            "Coordonnées copiables, position de reprise, étapes validées et membres actuellement sur le même objectif : le guide devient collectif.",
        bullets: ["Présence en direct", "Coordonnées & carte", "Étapes validées"],
        image: "/assets/screenshots/guide-complet.png",
        alt: "Guide de quête SigilOS : étapes, positions et membres présents sur le même objectif",
        ratio: "aspect-[2.3/1]",
    },
    {
        id: "sorties",
        label: "Sorties & groupes",
        title: "Une sortie ne se perd plus dans un salon Discord.",
        description:
            "Créez le groupe, définissez les besoins, partagez les succès visés et notifiez uniquement les rôles concernés.",
        bullets: ["Date & places", "Besoins de classe", "Notification Discord"],
        image: "/assets/screenshots/screenshot3.png",
        alt: "Calendrier de sorties SigilOS : groupes, besoins de classe et notifications",
        ratio: "aspect-[16/10]",
    },
    {
        id: "progression",
        label: "Progression",
        title: "Voyez ce que votre guilde accomplit vraiment.",
        description:
            "Missions, Dofus, Songes et services : des signaux clairs pour décider quoi faire ce soir.",
        bullets: ["Vue guilde", "Métriques utiles", "Recrutement"],
        image: "/assets/screenshots/screenshot6.png",
        alt: "Validation des missions de guilde SigilOS : progression et statistiques",
        ratio: "aspect-[16/10]",
    },
];

export function ProductStory() {
    const [activeId, setActiveId] = useState(STORIES[0].id);
    const active = STORIES.find((s) => s.id === activeId) ?? STORIES[0];

    const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = STORIES.length - 1;
        let next = -1;
        if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
        if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = last;
        if (next >= 0) {
            e.preventDefault();
            setActiveId(STORIES[next].id);
            document.getElementById(`story-tab-${STORIES[next].id}`)?.focus();
        }
    };

    return (
        <section id="produit" className="w-full border-t border-white/5 py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mb-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400 mb-4">
                        Produit
                    </p>
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
                        Conçu pour que la guilde joue ensemble.
                    </h2>
                </div>

                <div
                    role="tablist"
                    aria-label="Fonctionnalités SigilOS"
                    className="flex gap-1 border-b border-white/10 mb-8 overflow-x-auto overflow-y-hidden no-scrollbar"
                >
                    {STORIES.map((s, idx) => (
                        <button
                            key={s.id}
                            role="tab"
                            id={`story-tab-${s.id}`}
                            aria-selected={activeId === s.id}
                            aria-controls={`story-panel-${s.id}`}
                            onClick={() => setActiveId(s.id)}
                            onKeyDown={(e) => onTabKeyDown(e, idx)}
                            className={cn(
                                "px-4 py-2.5 rounded-t-lg text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px",
                                activeId === s.id
                                    ? "text-white border-emerald-400"
                                    : "text-zinc-500 border-transparent hover:text-white"
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                <div
                    role="tabpanel"
                    id={`story-panel-${active.id}`}
                    aria-labelledby={`story-tab-${active.id}`}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
                >
                    <div>
                        <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-3">
                            {active.title}
                        </h3>
                        <p className="text-zinc-400 text-[15px] leading-relaxed mb-5">
                            {active.description}
                        </p>
                        <ul className="flex flex-wrap gap-2">
                            {active.bullets.map((b) => (
                                <li
                                    key={b}
                                    className="text-[11px] font-semibold text-zinc-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full"
                                >
                                    {b}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div
                        className={cn(
                            "relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#101313]",
                            active.ratio
                        )}
                    >
                        <Image
                            src={active.image}
                            alt={active.alt}
                            fill
                            sizes="(max-width: 768px) 100vw, 520px"
                            className="object-cover object-top"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

