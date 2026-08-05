import Link from "next/link";
import { ShieldAlert, Eye } from "lucide-react";

// Scope labels humains
const SCOPE_LABELS: Record<string, string> = {
    guilds: "Guildes",
    "game-data": "Game Data",
    users: "Utilisateurs",
    logs: "Logs",
    news: "News",
    maintenance: "Maintenance",
};

/**
 * Bandeau d'avertissement affiché aux sub-gods dans le dashboard God.
 * Rappelle que toutes leurs actions sont auditées + leur scope actif.
 * On ne l'affiche pas pour un super-admin complet (tous scopes actifs).
 */
export function GodAccessBanner({ activeScopes, isFullAdmin }: { activeScopes: string[]; isFullAdmin: boolean }) {
    if (isFullAdmin) return null;

    const scopeNames = activeScopes.length > 0
        ? activeScopes.map(s => SCOPE_LABELS[s] || s).join(", ")
        : "aucun";

    return (
        <div className="mx-4 mt-4 md:mx-8 lg:mx-12 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col md:flex-row md:items-center gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3 shrink-0">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <div className="text-xs font-black text-amber-300 uppercase tracking-widest">Accès délégué (sub-god)</div>
                    <div className="text-[11px] text-amber-400/80 font-semibold">Scopes actifs : {scopeNames}</div>
                </div>
            </div>

            <div className="flex-1 text-xs text-amber-300/90 leading-relaxed">
                ⚠️ <strong>Toutes vos actions dans ce panel sont auditées</strong> (logs God : qui, quand, quoi).
                N'effectuez que les opérations couvertes par vos scopes. Les opérations hors scope sont bloquées (sécurité fail-closed).
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Link
                    href="/god/delegates"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black text-amber-200 uppercase tracking-widest transition-colors"
                >
                    <Eye className="w-4 h-4" /> Mes scopes
                </Link>
            </div>
        </div>
    );
}