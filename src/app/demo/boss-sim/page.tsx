import { getDofensiveDungeonForBoss } from "@/server/actions/dofensive-actions";
import { BossMapSimClient } from "@/components/demo/BossMapSimClient";

export const dynamic = "force-dynamic";

/**
 * Démo — simulation de fiche boss avec sélecteur de map façon Dofensive.
 * Paramètres (optionnels) : ?boss=NomDuBoss&dungeon=NomDuDonjon
 * Exemple : /demo/boss-sim?boss=Servitude&dungeon=Fers de la Tyrannie
 * Défaut : Donjon du Comte Harebourg.
 */
export default async function BossSimDemoPage({
    searchParams,
}: {
    searchParams: Promise<{ boss?: string; dungeon?: string }>;
}) {
    const sp = await searchParams;
    const boss = (sp.boss ?? "Comte Harebourg").trim();
    const dungeon = (sp.dungeon ?? "").trim() || undefined;

    const res = await getDofensiveDungeonForBoss(boss, dungeon);

    if (!res.success || !res.data) {
        return (
            <main className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-lg font-black text-foreground">Donjon « {boss} »</p>
                <p className="text-sm text-muted-foreground">
                    {res.error ?? "Donjon introuvable chez Dofensive"}
                </p>
            </main>
        );
    }

    return (
        <main className="min-h-screen max-w-6xl mx-auto px-4 py-8">
            <header className="mb-6 space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-warning">Démo — sélecteur de map façon Dofensive</p>
                <h1 className="text-2xl font-black text-foreground">{res.data.dungeonName}</h1>
                <p className="text-sm text-muted-foreground">
                    {res.data.maps.length} salles réelles (obstacles + placements de départ) · source : dofensive.com/api
                </p>
            </header>
            <BossMapSimClient dungeon={res.data} />
        </main>
    );
}

