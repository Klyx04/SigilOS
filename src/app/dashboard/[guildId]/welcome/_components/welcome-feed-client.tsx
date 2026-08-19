"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toggleWelcomeReaction } from "@/server/actions/onboarding-admin-actions";
import { toast } from "sonner";
import { Smile, Heart, PartyPopper, Hand, Sparkles, MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildProfileHref } from "@/lib/profile-slug";
import { motion, AnimatePresence } from "framer-motion";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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

const EMOJIS = [
    { char: "🎉", label: "Fête" },
    { char: "❤️", label: "Cœur" },
    { char: "🔥", label: "Feu" },
    { char: "👋", label: "Salut" },
];

export function WelcomeFeedClient({ initialPosts, reactorNames, currentProfileId, guildId }: WelcomeFeedClientProps) {
    const [posts, setPosts] = useState(initialPosts);
    const pendingReactions = useRef<Set<string>>(new Set());
    const [processingKeys, setProcessingKeys] = useState<Record<string, boolean>>({});

    const handleReaction = async (welcomeId: string, emoji: string) => {
        const key = `${welcomeId}:${emoji}`;
        if (pendingReactions.current.has(key)) return;

        pendingReactions.current.add(key);
        setProcessingKeys(prev => ({ ...prev, [key]: true }));

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
        }

        pendingReactions.current.delete(key);
        setProcessingKeys(prev => ({ ...prev, [key]: false }));
    };

    return (
        <TooltipProvider>
            <div className="space-y-8 relative">
                {/* Timeline vertical line */}
                <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent hidden md:block" />

                {posts.map((post, index) => (
                    <motion.div
                        key={post.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className="group relative"
                    >
                        {/* Timeline dot */}
                        <div className="absolute left-[19px] top-6 w-2 h-2 rounded-full bg-warning  border-2 border-border z-10 hidden md:block" />

                        <div className="md:pl-16">
                            <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-background/80 hover:bg-muted hover:border-warning/20 transition-all duration-300 p-6 md:p-8 shadow-xl">
                                {/* Visual Accent */}
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-warning/10 rounded-full group-hover:bg-warning/20 transition-colors duration-300 pointer-events-none" />

                                <div className="flex flex-col md:flex-row gap-6 relative z-10">
                                    <div className="shrink-0">
                                        <Link href={buildProfileHref(guildId, post.profile)}>
                                            <div className="relative group/avatar">
                                                <Avatar className="h-16 w-16 rounded-2xl ring-2 ring-white/5 group-hover/avatar:ring-warning/40 transition-all duration-300 shadow-2xl">
                                                    <AvatarImage src={post.profile.user.image || ""} className="object-cover" />
                                                    <AvatarFallback className="bg-elevated text-lg font-black text-muted-foreground">
                                                        {post.profile.user.name?.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute -bottom-1 -right-1 bg-warning rounded-lg p-1 shadow-lg shadow-amber-950/50">
                                                    <Sparkles className="w-3 h-3 text-foreground" />
                                                </div>
                                            </div>
                                        </Link>
                                    </div>

                                    <div className="flex-1 space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={buildProfileHref(guildId, post.profile)}
                                                        className="text-xl font-black text-foreground hover:text-warning transition-colors tracking-tight"
                                                    >
                                                        {post.profile.id === currentProfileId ? "Toi 🎉" : (post.profile.pseudoDofus || post.profile.user.name)}
                                                    </Link>
                                                    <div className="px-2 py-0.5 rounded-md bg-surface border border-border text-caption font-bold text-muted-foreground uppercase tracking-widest">
                                                        Nouveauté
                                                    </div>
                                                </div>
                                                <span className="text-caption text-muted-foreground font-bold uppercase tracking-[0.2em] bg-surface px-3 py-1 rounded-full border border-border">
                                                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}
                                                </span>
                                            </div>

                                            <p className="text-foreground text-base leading-relaxed font-medium">
                                                {post.content
                                                    .replace(/<p>(.*?)<\/p>/gi, "$1") // Strip <p> tags
                                                    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**") // Convert <strong> to **
                                                    .replace(/<br\s*\/?>/gi, "") // Strip <br>
                                                    .replace(/<\/?[^>]+(>|$)/g, "") // Strip all other tags
                                                    .split(/\*\*(.*?)\*\*/g)
                                                    .map((part, i) =>
                                                        i % 2 === 1
                                                            ? <strong key={i} className="text-foreground drop-shadow-sm font-black">{part}</strong>
                                                            : part
                                                    )}
                                            </p>
                                        </div>

                                        {/* Introduction Highlight */}
                                        {post.profile.introduction && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="relative group/intro"
                                            >
                                                <div className="absolute inset-0 bg-surface rounded-x3l -m-4 block" />
                                                <div className="p-5 rounded-[1.5rem] bg-background/40 border border-border space-y-3 group-hover/intro:border-border transition-all">
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
                                                    <p className="text-sm text-muted-foreground italic italic leading-relaxed line-clamp-2">
                                                        &quot;{post.profile.introduction}&quot;
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Reactions Action Bar */}
                                        <div className="flex flex-wrap items-center gap-3 pt-2">
                                            {EMOJIS.map((emoji) => {
                                                const reactorIds = post.reactions?.[emoji.char] || [];
                                                const count = reactorIds.length;
                                                const hasReacted = reactorIds.includes(currentProfileId);
                                                const names = reactorIds.map(id => id === currentProfileId ? "Toi" : (reactorNames[id] || "Quelqu'un"));

                                                return (
                                                    <Tooltip key={emoji.char} delayDuration={300}>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => handleReaction(post.id, emoji.char)}
                                                                disabled={processingKeys[`${post.id}:${emoji.char}`]}
                                                                className={cn(
                                                                    "flex items-center gap-2.5 h-10 px-4 rounded-2xl transition-all border font-bold disabled:opacity-50",
                                                                    hasReacted
                                                                        ? "bg-warning/10 border-warning/40 text-warning shadow-lg shadow-amber-900/10"
                                                                        : "bg-surface border-border text-muted-foreground hover:text-foreground hover:border-border"
                                                                )}
                                                            >
                                                                <span className={cn("text-lg", !hasReacted && "grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all")}>
                                                                    {emoji.char}
                                                                </span>
                                                                {count > 0 && <span className="text-xs tracking-tighter tabular-nums">{count}</span>}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-background border-border p-4 rounded-2xl shadow-2xl">
                                                            <div className="space-y-2">
                                                                <p className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground pb-2 border-b border-border">
                                                                    Ont réagi {emoji.char}
                                                                </p>
                                                                <div className="flex flex-col gap-1">
                                                                    {names.slice(0, 8).map((name, i) => (
                                                                        <span key={i} className="text-caption font-bold text-foreground">{name}</span>
                                                                    ))}
                                                                    {names.length > 8 && (
                                                                        <span className="text-caption text-muted-foreground italic">+{names.length - 8} autres...</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </TooltipProvider>
    );
}
