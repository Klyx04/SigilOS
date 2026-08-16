"use client";

import { useState } from "react";
import type { InterGuildMemberView } from "@/server/actions/inter-guild";
import { ChevronDown, ChevronUp, UsersRound } from "lucide-react";

/**
 * Chantier Inter-Guilde (19/08) — section « Membres des guildes inter-guilde ».
 * PII minimale : pseudo Dofus + classe + niveau + tag guilde. Aucune identité Discord.
 * Le serveur ne renvoie ces données que si l'inter-guilde est active (opt-in bilatéral).
 */
export function InterGuildMembers({
    members,
    peerCount,
}: {
    members: InterGuildMemberView[];
    peerCount: number;
}) {
    const [open, setOpen] = useState(false);

    if (peerCount === 0 && members.length === 0) return null;

    return (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-sky-500/[0.03] transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center shrink-0">
                        <UsersRound className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white">Membres des guildes inter-guilde</p>
                        <p className="text-xs text-zinc-500 truncate">
                            {peerCount > 0
                                ? `${peerCount} guilde(s) ouverte(s) · ${members.length} membre(s) visible(s)`
                                : "Aucune guilde ouverte détectée"}
                        </p>
                    </div>
                </div>
                {open ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                )}
            </button>

            {open && (
                <div className="px-5 pb-5">
                    {members.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-4">
                            Aucun membre d'autre guilde ne partage encore son profil. Les membres des guildes
                            ouvertes apparaîtront ici.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {members.map(m => (
                                <div
                                    key={`${m.guildDiscordId}:${m.pseudoDofus}`}
                                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{m.pseudoDofus}</p>
                                        <p className="text-xs text-zinc-500 truncate">
                                            {m.classe || "Classe inconnue"}
                                            {m.dofusLevel ? ` · Niveau ${m.dofusLevel}` : ""}
                                        </p>
                                    </div>
                                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-caption font-bold text-sky-400 uppercase tracking-widest">
                                        {m.guildName}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
