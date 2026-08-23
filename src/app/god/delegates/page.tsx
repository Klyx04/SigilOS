import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { listDelegates, listBrickGrants } from "@/server/actions/god-delegate-actions";
import { SUBGOD_USABLE_SCOPES } from "@/lib/god-scopes";
import { DelegatesManager } from "./delegates-manager";
import { AccessHistory, type DelegateHistoryItem, type GrantHistoryItem } from "./access-history";
import { ShieldCheck, Users, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
    title: "GOD | Sous-Gods",
    description: "Gestion des accès délégués au dashboard God",
};

function SectionBadge({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
    return (
        <div className={cn("inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-black uppercase tracking-widest", color)}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </div>
    );
}

export default async function DelegatesPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    // 🛡️ Guard (fix #108) : la gestion des sous-gods est RÉSERVÉE au super-admin.
    // Avant : on acceptait le scope "users" → un sous-god avec ce scope (qui n'ouvre
    // QUE la brique tickets) pouvait gérer les délégations = montée de privilège.
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/god");

    const result = await listDelegates();
    const delegates = result.success ? (result.data ?? []) : [];
    const error = result.success ? null : result.error;

    // D5 : grants par brique (PIM)
    const grantsResult = await listBrickGrants();
    const brickGrants = grantsResult.success ? (grantsResult.data ?? []) : [];

    // 🔄 P2+ — Historique discret : délégations + grants révoqués/expirés
    const now2 = Date.now();
    const delegateHistory: DelegateHistoryItem[] = delegates
        .filter((d) => d.revokedAt || (d.expiresAt && new Date(d.expiresAt).getTime() < now2))
        .map((d) => ({
            id: d.id,
            userName: d.userName,
            status: d.revokedAt ? "REVOKED" : "EXPIRED",
            scopes: d.scopes,
            expiresAt: d.expiresAt?.toISOString() ?? null,
            revokedAt: d.revokedAt?.toISOString() ?? null,
        }));
    const grantHistory: GrantHistoryItem[] = brickGrants
        .filter((g: any) => g.revokedAt || (g.expiresAt && new Date(g.expiresAt).getTime() < now2))
        .map((g: any) => ({
            id: g.id,
            brickId: g.brickId,
            status: g.revokedAt ? "REVOKED" : "EXPIRED",
            expiresAt: g.expiresAt ?? null,
            revokedAt: g.revokedAt ?? null,
            reason: g.reason ?? null,
        }));

    return (
        <div className="p-6 md:p-12 lg:p-16 space-y-14 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <SectionBadge icon={ShieldCheck} label="Délégation d'accès" color="bg-violet-500/10 border-violet-500/20 text-violet-400" />
                    <h1 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tighter leading-none">
                        Sous-Gods{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-200 via-violet-400 to-indigo-600">Scopes granulaires</span>
                    </h1>
                    <p className="text-lg text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Accordez des accès limités au dashboard God. Chaque action est audité et la sécurité est fail-closed.
                    </p>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                    <Users className="w-5 h-5 text-violet-400" />
                    <div className="space-y-0.5">
                        <div className="text-xs font-black text-violet-400 uppercase tracking-widest leading-none">Délégués</div>
                        <div className="text-caption text-violet-500/70 font-bold">{delegates.length} total</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 font-bold">
                    <Database className="w-4 h-4 text-violet-400" /> Scopes exploitables par un sous-god :{" "}
                    <span className="text-violet-300">{SUBGOD_USABLE_SCOPES.join(" · ")}</span>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 font-semibold">
                    {error}
                </div>
            )}

            <DelegatesManager initialDelegates={delegates} initialGrants={brickGrants as any} />

            <AccessHistory delegates={delegateHistory} grants={grantHistory} />
        </div>
    );
}