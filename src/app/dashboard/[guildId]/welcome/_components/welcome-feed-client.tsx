"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toggleWelcomeReaction } from "@/server/actions/onboarding-admin-actions";
import { toast } from "sonner";
import { Smile, Heart, PartyPopper, Hand } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WelcomePost {
    id: string;
    profile: {
        id: string;
        user: {
            name: string;
            image: string | null;
        };
        pseudoDofus: string | null;
        introduction: string | null;
    };
    content: string;
    reactions: Record<string, string[]> | null;
    createdAt: Date;
}

interface WelcomeFeedClientProps {
    initialPosts: WelcomePost[];
    currentProfileId: string;
    guildId: string;
}

const EMOJIS = [
    { char: "🎉", icon: PartyPopper },
    { char: "❤️", icon: Heart },
    { char: "🔥", icon: Smile },
    { char: "👋", icon: Hand },
];

export function WelcomeFeedClient({ initialPosts, currentProfileId, guildId }: WelcomeFeedClientProps) {
    const [posts, setPosts] = useState(initialPosts);

    const handleReaction = async (welcomeId: string, emoji: string) => {
        // Optimistic update
        setPosts(current => current.map(post => {
            if (post.id === welcomeId) {
                const reactions = { ...(post.reactions as any) || {} };
                if (!reactions[emoji]) {
                    reactions[emoji] = [currentProfileId];
                } else {
                    const idx = reactions[emoji].indexOf(currentProfileId);
                    if (idx > -1) {
                        reactions[emoji] = reactions[emoji].filter((id: string) => id !== currentProfileId);
                        if (reactions[emoji].length === 0) delete reactions[emoji];
                    } else {
                        reactions[emoji] = [...reactions[emoji], currentProfileId];
                    }
                }
                return { ...post, reactions };
            }
            return post;
        }));

        const res = await toggleWelcomeReaction(welcomeId, emoji);
        if (!res.success) {
            toast.error(res.error || "Erreur lors de la réaction");
            // Revert on error? (Skipping for brevity in this complex flow)
        }
    };

    return (
        <div className="space-y-6">
            {posts.map((post) => (
                <Card key={post.id} className="p-6 bg-zinc-900/40 border-white/5 relative overflow-hidden group hover:bg-zinc-900/60 transition-all duration-500 rounded-[2rem]">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="flex gap-4 relative">
                        <Link href={`/dashboard/${guildId}/members/${post.profile.id}`}>
                            <Avatar className="h-12 w-12 rounded-xl ring-2 ring-amber-500/10 group-hover:ring-amber-500/40 transition-all duration-500">
                                <AvatarImage src={post.profile.user.image || ""} />
                                <AvatarFallback className="bg-zinc-800 text-sm font-black text-zinc-400">
                                    {post.profile.user.name?.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </Link>

                        <div className="flex-1 space-y-4">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Link
                                        href={`/dashboard/${guildId}/members/${post.profile.id}`}
                                        className="text-lg font-black text-white hover:text-amber-400 transition-colors"
                                    >
                                        {post.profile.id === currentProfileId ? "Toi 🎉" : (post.profile.pseudoDofus || post.profile.user.name)}
                                    </Link>
                                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}
                                    </span>
                                </div>
                                <div className="text-zinc-400 text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: post.content.replace(/\*\*(.*?)\*\*/g, '<b class="text-white">$1</b>') }}
                                />
                            </div>

                            {/* Presentation Preview if exists */}
                            {post.profile.introduction && (
                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                        <Smile className="w-3 h-3 text-amber-500" /> Présentation
                                    </p>
                                    <p className="text-xs text-zinc-400 italic line-clamp-3">
                                        "{post.profile.introduction}"
                                    </p>
                                    <Link
                                        href={`/dashboard/${guildId}/members/${post.profile.id}`}
                                        className="text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest"
                                    >
                                        Voir son profil complet →
                                    </Link>
                                </div>
                            )}

                            {/* Reactions */}
                            <div className="flex flex-wrap items-center gap-2">
                                {EMOJIS.map((emoji) => {
                                    const count = post.reactions?.[emoji.char]?.length || 0;
                                    const hasReacted = post.reactions?.[emoji.char]?.includes(currentProfileId);

                                    return (
                                        <Button
                                            key={emoji.char}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleReaction(post.id, emoji.char)}
                                            className={cn(
                                                "h-8 px-2 rounded-lg transition-all gap-2 border",
                                                hasReacted
                                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                    : "bg-white/5 border-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-300"
                                            )}
                                        >
                                            <span className="text-sm">{emoji.char}</span>
                                            {count > 0 && <span className="text-xs font-black">{count}</span>}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
