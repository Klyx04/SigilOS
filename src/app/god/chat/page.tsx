"use server";

import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { redirect } from "next/navigation";
import { getGlobalBlocklist, getBaseBlocklist } from "@/server/actions/chat-actions";
import { GlobalBlocklistClient } from "./_components/global-blocklist-client";
import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function GodChatPage() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    const res = await getGlobalBlocklist();
    const chatData = res.data ?? { words: [], baseWords: [], allowedDomains: [] };

    return (
        <div className="space-y-12 py-8 container max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-6">
                <Link
                    href="/god"
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors w-fit group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au Panneau Maître
                </Link>

                <div className="flex flex-col gap-4">
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-black text-rose-400 uppercase tracking-[0.3em] w-fit">
                        <Shield className="w-4 h-4" />
                        <span>Platform Security</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-gradient-to-r from-white via-zinc-400 to-zinc-600 bg-clip-text text-transparent leading-none">
                        Chat Firewall <br />
                        <span className="text-3xl md:text-4xl text-zinc-600">Platform-wide Blocklist</span>
                    </h1>
                    <p className="text-zinc-500 text-lg max-w-2xl font-medium">
                        Gérez ici les termes et motifs (Regex) qui seront bloqués sur **l'ensemble des chats de la plateforme** (Guildes & Songes).
                        Ces règles s'ajoutent à la liste de base codée en dur.
                    </p>
                </div>
            </div>

            <GlobalBlocklistClient initialData={chatData} />
        </div>
    );
}
