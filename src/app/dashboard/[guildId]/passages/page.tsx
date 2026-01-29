import { Coins } from "lucide-react";

export default function PassagesPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <Coins
                        className="w-12 h-12 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]"
                        strokeWidth={1.5}
                    />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Passages & Services</h1>
                    <p className="text-zinc-400">Marketplace de services et passages de donjons.</p>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center min-h-[400px] border border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in duration-500">
                <div className="p-4 rounded-full bg-white/5 mb-4 animate-pulse">
                    <Coins className="w-8 h-8 text-white/50" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Module en construction</h3>
                <p className="text-zinc-500 max-w-md text-center">
                    Cette fonctionnalité sera bientôt disponible. Elle permettra de proposer et rechercher des services rémunérés (Passages, PL, Métiers).
                </p>
            </div>
        </div>
    );
}
