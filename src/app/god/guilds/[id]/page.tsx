import { redirect, notFound } from "next/navigation";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getGuildMembersForGod } from "@/server/actions/god-lifecycle-actions";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { Shield, ChevronLeft, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/prisma";

interface GodGuildDetailsPageProps {
    params: { id: string };
}

export default async function GodGuildDetailsPage({ params }: GodGuildDetailsPageProps) {
    const isAdmin = await isSuperAdmin();

    if (!isAdmin) {
        redirect("/");
    }

    const { id: guildId } = await params;

    // Fetch individual guild config for the header
    const guild = await db.guildConfig.findUnique({
        where: { id: guildId },
        select: { name: true, discordGuildId: true, iconUrl: true }
    });

    if (!guild) {
        return notFound();
    }

    const members = await getGuildMembersForGod(guildId);

    return (
        <div className="space-y-8 py-8">
            {/* Header */}
            <div className="flex flex-col gap-6">
                <Link
                    href="/god"
                    className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest group"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au Panneau de Contrôle
                </Link>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="relative group/icon">
                            <div className="absolute -inset-4 bg-violet-500/20 blur-2xl rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity" />
                            {guild.iconUrl && guild.iconUrl.length > 5 ? (
                                <div className="relative w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10 bg-zinc-900 shadow-2xl">
                                    <img
                                        src={`https://cdn.discordapp.com/icons/${guild.discordGuildId}/${guild.iconUrl}.png?size=256`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                            ) : (
                                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-4xl font-black text-white border-2 border-white/10 shadow-2xl relative z-10 uppercase">
                                    {guild.name[0]}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                <Shield className="w-3 h-3" />
                                Inspection God Mode
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tighter">
                                {guild.name}
                            </h1>
                            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
                                {guild.discordGuildId}
                            </p>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl text-center min-w-[140px]">
                        <div className="text-2xl font-black text-white tracking-tighter">{members.length}</div>
                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Membres Totaux</div>
                    </div>
                </div>
            </div>

            {/* Roster Table - Reusing the Admin component for consistency */}
            <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                        <Users className="w-4 h-4 text-violet-500" />
                        Registre des Citoyens
                    </h3>
                </div>
                <div className="p-6">
                    <MemberManagementTable initialMembers={members as any} guildId={guildId} />
                </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
                <p className="text-xs text-amber-500/80 font-medium leading-relaxed">
                    <span className="font-black uppercase tracking-widest mr-2">Note :</span>
                    En tant que Super-Admin, vous pouvez modifier les statuts des membres directement.
                    Toute action effectuée ici sera enregistrée dans le journal d'audit de la guilde avec votre identité.
                </p>
            </div>
        </div>
    );
}
