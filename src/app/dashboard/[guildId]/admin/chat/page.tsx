"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import { ChatBlocklistClient } from "./_components/chat-blocklist-client";
import { MentionRulesClient } from "./_components/mention-rules-client";

import { fetchGuildRoles } from "@/server/discord";

export default async function AdminChatPage({
    params
}: {
    params: Promise<{ guildId: string }>
}) {
    const { guildId } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect("/api/auth/signin");

    const ctx = await getUserContext(guildId);
    if (!ctx.canModerateChat) redirect(`/dashboard/${guildId}`);

    const guildData = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { chatBlocklist: true, chatMentionRules: true, rolesMapping: true, name: true } as any,
    });
    const guild = guildData as any;

    const blocklist = (guild?.chatBlocklist as string[]) ?? [];

    // Parse chat mention rules
    const rules = (guild?.chatMentionRules as Record<string, string[]>) ?? {};

    let discordRoles: any[] = [];
    try {
        discordRoles = await fetchGuildRoles(guildId);
    } catch { }

    const roleMap = Object.fromEntries(discordRoles.map((r: any) => [r.id, r.name]));

    // Pass { id, name } to the client so it can display the correct names
    const availableRoles = discordRoles.map((r: any) => ({
        id: r.id,
        name: r.name
    }));

    return (
        <div className="space-y-6 container py-6 max-w-5xl">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Modération & Mentions du Chat
                </h1>
                <p className="text-muted-foreground">
                    Gérez la liste des mots interdits et les permissions de mention pour {guild?.name}.
                </p>
            </div>

            <MentionRulesClient
                discordGuildId={guildId}
                initialRules={rules}
                availableRoles={availableRoles}
            />

            <hr className="border-white/5 my-8" />

            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Blocklist Manuelle</h2>
                <div className="mt-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-pulse" />
                    <p className="text-sm text-amber-200/70 leading-relaxed">
                        <strong className="text-amber-400 block mb-1 uppercase tracking-tight text-xs font-black">Moteur de Modération SigilOS</strong>
                        Une liste exhaustive de slurs, insultes majeures et motifs de scam (GitHub Datasets) est déjà active sur toute la plateforme.
                        Vos filtres ici s'ajoutent spécifiquement pour <span className="text-white font-bold">{guild?.name}</span>.
                    </p>
                </div>
            </div>

            <ChatBlocklistClient
                initialWords={blocklist}
                discordGuildId={guildId}
            />
        </div>
    );
}
