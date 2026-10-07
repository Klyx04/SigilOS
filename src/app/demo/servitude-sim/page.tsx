import type { Metadata } from "next";
import { DungeonTabs } from "@/components/dungeons/dungeon-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Simulateurs tactiques — 6 donjons niveau 200",
    description:
        "Cartes tactiques réelles de 6 donjons (placements + obstacles), butin 1-8, 19 classes posables, sorts et dégâts des monstres.",
    robots: { index: false, follow: true },
};

/**
 * Démo — simulateurs tactiques (1 onglet par donjon).
 * Pages publiques sans session : les placements viennent des `cellsData`
 * siphonnées du client (`src/lib/dungeons/fers-tyrannie.ts`,
 * `src/lib/dungeons/tour-solar.ts`), les sorts des monstres de
 * `getMonsterStats` (chargés côté client à la sélection). Chaque donjon garde
 * son état en local isolé (`storageKey`).
 */
export default function ServitudeSimDemoPage() {
    return (
        <main className="min-h-screen max-w-6xl mx-auto px-4 py-8">
            <header className="mb-6 space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-warning">
                    Démo — simulateurs tactiques
                </p>
                <h1 className="text-2xl font-black text-foreground">Donjons niveau 200</h1>
                <p className="text-sm text-muted-foreground">
                    Salles réelles (obstacles + placements de départ) · butin 1-8 · 19 classes
                    posables · sorts et dégâts des monstres.
                </p>
            </header>
            <DungeonTabs />
        </main>
    );
}
