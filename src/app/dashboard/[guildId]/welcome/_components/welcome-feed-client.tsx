"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Sparkles, MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildProfileHref } from "@/lib/profile-slug";

const PAGE_SIZE = 10;

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
    reactorNames: Record<string, string>;
    currentProfileId: string;
    guildId: string;
}

export function WelcomeFeedClient({ initialPosts, reactorNames, currentProfileId, guildId }: WelcomeFeedClientProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const visiblePosts = initialPosts.slice(0, visibleCount);
    const hasMore = visibleCount < initialPosts.length;

    return (
        <div className="space-y-6">
            {visiblePosts.map((post) => (
                <div
                    key={post.id}
                    className="relative overflow-hidden rounded-2xl border border-border bg-background/80 hover:bg-muted hover:border-warning/20 transition-all duration-300 p-6 shadow-lg"
                >
                    {/* Visual Accent */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-warning/5 rounded-full pointer-events-none" />

                    <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                        <div className="shrink-0">
                            <Link href={buildProfileHref(guildId, post.profile)}>
                                <div className="relative group/avatar">
                                    <Avatar className="h-12 w-12 rounded-xl ring-2 ring-white/5 group-hover/avatar:ring-warning/40 transition-all duration-300 shadow-xl">
                                        <AvatarImage src={post.profile.user.image || ""} className="object-cover" />
                                        <AvatarFallback className="bg-elevated text-sm font-black text-muted-foreground">
                                            {post.profile.user.name?.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 bg-warning rounded-lg p-0.5 shadow-lg shadow-amber-950/50">
                                        <Sparkles className="w-2.5 h-2.5 text-foreground" />
                                    </div>
                                </div>
                            </Link>
                        </div>

                        <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={buildProfileHref(guildId, post.profile)}
                                        className="text-base font-black text-foreground hover:text-warning transition-colors tracking-tight"
                                    >
                                        {post.profile.id === currentProfileId ? "Toi" : (post.profile.pseudoDofus || post.profile.user.name)}
                                    </Link>
                                    <div className="px-2 py-0.5 rounded-md bg-surface border border-border text-caption font-bold text-muted-foreground uppercase tracking-widest">
                                        Nouveauté
                                    </div>
                                </div>
                                <span className="text-caption text-muted-foreground font-bold uppercase tracking-[0.15em]">
                                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}
                                </span>
                            </div>

                            <p className="text-foreground text-sm leading-relaxed font-medium">
                                {post.content
                                    .replace(/<p>(.*?)<\/p>/gi, "$1")
                                    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
                                    .replace(/<br\s*\/?>/gi, "")
                                    .replace(/<\/?[^>]+(>|$)/g, "")
                                    .split(/\*\*(.*?)\*\*/g)
                                    .map((part, i) =>
                                        i % 2 === 1
                                            ? <strong key={i} className="text-foreground drop-shadow-sm font-black">{part}</strong>
                                            : part
                                    )}
                            </p>

                            {/* Introduction Highlight */}
                            {post.profile.introduction && (
                                <div className="p-4 rounded-xl bg-background/40 border border-border space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <MessageCircle className="w-3 h-3 text-warning/50" /> Quelques mots
                                        </p>
                                        <Link
                                            href={buildProfileHref(guildId, post.profile)}
                                            className="text-caption font-black text-muted-foreground hover:text-warning uppercase tracking-widest transition-colors flex items-center gap-1.5"
                                        >
                                            Profil complet <ArrowRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                    <p className="text-sm text-muted-foreground italic leading-relaxed line-clamp-2">
                                        &quot;{post.profile.introduction}&quot;
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* Pagination */}
            {hasMore && (
                <div className="flex justify-center pt-2">
                    <Button
                        variant="outline"
                        className="rounded-full px-8 border-border text-muted-foreground hover:text-foreground hover:border-warning/40 transition-all"
                        onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    >
                        Voir plus ({initialPosts.length - visibleCount} restants)
                    </Button>
                </div>
            )}
        </div>
    );
}
