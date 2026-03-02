"use client";
/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { MessageCircle, Send, ChevronDown, ChevronUp, Smile, HelpCircle, Command, Lock, Bell, BellOff, BarChart3, Volume2, VolumeX } from "lucide-react";
import { sendRunChatMessage, getRunChatHistory, setRunTypingIndicator, getUserChatBanStatus, voteInChatPoll } from "@/server/actions/chat-actions";
import { toast } from "sonner";
import { ChatTransparencyModal } from "./ChatTransparencyModal";
import { ChatPollModal } from "./ChatPollModal";
import type { ChatMessage } from "@/lib/chat-helpers";
import { CHAT_MAX_LENGTH } from "@/lib/chat-helpers";
import { renderTextWithLinks } from "@/lib/chat-renderer";
import { ChatAutocomplete } from "./ChatAutocomplete";

// ── Emoji ─────────────────────────────────────────────────────────────────────
const EMOJI_GROUPS = [
    {
        label: "Expressions", emojis: [
            "😀", "😂", "🥹", "😍", "🤩", "😎", "🥺", "😅",
            "😡", "🤔", "🤯", "💀", "😴", "🤗", "😏", "🫡",
        ]
    },
    {
        label: "Jeu", emojis: [
            "⚔️", "🛡️", "🏹", "🔥", "💎", "🐉", "🎮", "🧙",
            "🏆", "🌙", "✨", "⚡", "🪄", "💪", "🗡️", "🎯",
        ]
    },
    {
        label: "Réactions", emojis: [
            "👍", "👎", "❤️", "💜", "💯", "🎉", "👀", "🙏",
            "😂", "💪", "🤝", "👏", "🫶", "🔥", "💥", "✅",
        ]
    },
];

interface RunChatPanelProps {
    runId: string;
    guildId: string;
    userId: string;
    userRoleName?: string;
    userRoleNames?: string[];
    userPseudo?: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, image }: { name: string; image?: string }) {
    return (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex-shrink-0 overflow-hidden ring-1 ring-white/5">
            {image
                ? <img src={image} alt={name} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-300">{name[0]?.toUpperCase() ?? "?"}</span>
            }
        </div>
    );
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingIndicator({ names }: { names: string[] }) {
    if (names.length === 0) return null;
    const label = names.length === 1
        ? `${names[0]} est en train d'écrire`
        : names.length === 2
            ? `${names[0]} et ${names[1]} écrivent`
            : `${names.length} personnes écrivent`;
    return (
        <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-zinc-500 italic select-none">
            <span className="flex gap-0.5 items-end">
                {[0, 1, 2].map(i => (
                    <span key={i} className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                ))}
            </span>
            {label}...
        </div>
    );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg, isOwn, currentUserId, currentUserRole, currentUserPseudo, onVote }: {
    msg: ChatMessage;
    isOwn: boolean;
    currentUserId?: string;
    currentUserRole?: string;
    currentUserPseudo?: string;
    onVote: (optId: string, msgId: string) => void;
}) {
    if (msg.type === "system" || msg.type === "presence") {
        return (
            <div className="flex items-center justify-center my-3 pb-1">
                <span className="text-[10px] text-zinc-300 font-semibold tracking-wide bg-zinc-800/60 px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm">
                    {msg.text}
                </span>
            </div>
        );
    }

    if (msg.type === "poll" && msg.pollData) {
        const totalVotes = Object.keys(msg.pollData.voters || {}).length;
        const myVote = currentUserId ? msg.pollData.voters?.[currentUserId] : null;

        return (
            <div className={`flex gap-2 items-end group ${isOwn ? "flex-row-reverse" : ""}`}>
                {!isOwn && <Avatar name={msg.authorName} image={msg.authorImage} />}
                <div className={`flex flex-col gap-0.5 max-w-[85%] w-full ${isOwn ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-zinc-500 px-1 font-medium truncate max-w-full">
                        {isOwn ? "Vous" : msg.authorName} a lancé un sondage
                    </span>
                    <div className={`p-4 rounded-xl text-sm leading-relaxed break-words border w-full
                        ${isOwn ? "bg-indigo-900/40 border-indigo-500/30 rounded-br-sm" : "bg-zinc-800 border-white/10 rounded-bl-sm"}
                    `}>
                        <div className="font-semibold mb-3">{msg.pollData.question}</div>
                        <div className="flex flex-col gap-2 w-full">
                            {msg.pollData.options.map((opt) => {
                                const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                const isMyVote = myVote === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => onVote(opt.id, msg.id)}
                                        className={`relative w-full text-left p-2.5 rounded-lg text-sm transition-all overflow-hidden border ${isMyVote ? "border-indigo-400 bg-indigo-400/20 text-indigo-200" : "border-white/5 bg-white/5 hover:bg-white/10 text-zinc-200"}`}
                                    >
                                        <div
                                            className={`absolute left-0 top-0 bottom-0 opacity-10 ${isMyVote ? "bg-indigo-400" : "bg-zinc-500"}`}
                                            style={{ width: `${percent}%`, transition: "width 0.3s ease" }}
                                        />
                                        <div className="relative flex justify-between items-center z-10 font-medium">
                                            <span>{opt.text} {isMyVote && <span className="ml-1 text-indigo-400">✓</span>}</span>
                                            <span className="text-[10px] opacity-60">{percent}% ({opt.votes})</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-3 flex justify-between">
                            <span>{totalVotes} vote{totalVotes > 1 ? "s" : ""}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const cleanPseudo = currentUserPseudo?.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
    const cleanRole = currentUserRole?.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();

    const isMentioned = msg.mentions && (
        (currentUserId && msg.mentions.includes(currentUserId)) ||
        (cleanRole && msg.mentions.includes(cleanRole)) ||
        (cleanPseudo && msg.mentions.includes(cleanPseudo)) ||
        msg.mentions.includes("everyone") ||
        msg.mentions.includes("here")
    );

    return (
        <div className={`flex gap-2 items-end group ${isOwn ? "flex-row-reverse" : ""} ${isMentioned && !isOwn ? "bg-red-500/10 -mx-3 px-3 py-1 rounded-lg border-l-2 border-red-500" : ""}`}>
            {!isOwn && <Avatar name={msg.authorName} image={msg.authorImage} />}
            <div className={`flex flex-col gap-0.5 max-w-[76%] ${isOwn ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-zinc-500 px-1 font-medium truncate max-w-full">
                    {isOwn ? "Vous" : msg.authorName}
                </span>
                <div className={`px-3 py-1.5 rounded-2xl text-sm leading-relaxed break-words ${isOwn
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : isMentioned
                        ? "bg-red-500/20 text-red-100 rounded-bl-sm border border-red-500/30"
                        : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                    }`}>
                    {renderTextWithLinks(msg.text, msg.mentions)}
                </div>
                <span className="text-[10px] text-zinc-600 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
            </div>
        </div>
    );
}

// ── Emoji Picker ──────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
    const [activeGroup, setActiveGroup] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} className="absolute bottom-14 right-0 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-20 animate-in slide-in-from-bottom-2 fade-in duration-150">
            <div className="flex border-b border-white/5">
                {EMOJI_GROUPS.map((g, i) => (
                    <button key={g.label} onClick={() => setActiveGroup(i)}
                        className={`flex-1 py-2 text-[10px] font-semibold transition-colors ${activeGroup === i ? "text-indigo-400 border-b-2 border-indigo-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                        {g.label}
                    </button>
                ))}
            </div>
            <div className="p-2 grid grid-cols-8 gap-0.5">
                {EMOJI_GROUPS[activeGroup].emojis.map(emoji => (
                    <button key={emoji} onClick={() => onSelect(emoji)}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-white/10 rounded-lg transition-colors active:scale-90">
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function RunChatPanel({ runId, guildId, userId, userRoleName, userRoleNames = [], userPseudo }: RunChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [unread, setUnread] = useState(0);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showTransparency, setShowTransparency] = useState(false);
    const [banStatus, setBanStatus] = useState({ isBanned: false, remainingSeconds: 0 });
    const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; expireAt: number }>>({});
    const [hasMention, setHasMention] = useState(false);
    const [showPollModal, setShowPollModal] = useState(false);
    const [notifEnabled, setNotifEnabled] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem(`runchat:notif:${runId}`) !== "false";
    });

    const [soundEnabled, setSoundEnabled] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem(`runchat:sound:${runId}`) !== "false";
    });

    const [inputHistory, setInputHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [onlineUsers, setOnlineUsers] = useState<{ id: string, name: string, image?: string }[]>([]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const esRef = useRef<EventSource | null>(null);
    const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [, startTransition] = useTransition();

    const notifRef = useRef(notifEnabled);
    const soundRef = useRef(soundEnabled);
    const userIdRef = useRef(userId);
    const pseudoRef = useRef(userPseudo);
    const rolesRef = useRef(userRoleNames);

    useEffect(() => { notifRef.current = notifEnabled; }, [notifEnabled]);
    useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { pseudoRef.current = userPseudo; }, [userPseudo]);
    useEffect(() => { rolesRef.current = userRoleNames; }, [userRoleNames]);

    // Ban check & countdown
    useEffect(() => {
        const check = async () => {
            getUserChatBanStatus(userId).then(setBanStatus);
        };
        check();
        const timer = setInterval(() => {
            setBanStatus(prev => {
                if (prev.remainingSeconds <= 1) {
                    if (prev.isBanned) check();
                    return { isBanned: false, remainingSeconds: 0 };
                }
                return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [userId]);

    // Load history
    useEffect(() => {
        getRunChatHistory(runId).then(res => {
            if (res.success && res.data) setMessages(res.data.filter(m => m.type !== "typing"));
        });
    }, [runId]);

    // SSE stream
    useEffect(() => {
        const es = new EventSource(`/api/chat/run/${runId}/stream`);
        esRef.current = es;

        es.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data) as ChatMessage;

                if (msg.type === "typing") {
                    if (msg.authorId === userId) return;
                    setTypingUsers(prev => ({ ...prev, [msg.authorId]: { name: msg.authorName, expireAt: Date.now() + 4000 } }));
                    clearTimeout(typingTimeouts.current[msg.authorId]);
                    typingTimeouts.current[msg.authorId] = setTimeout(() => {
                        setTypingUsers(prev => { const n = { ...prev }; delete n[msg.authorId]; return n; });
                    }, 4000);
                    return;
                }

                if (msg.type === "presence") {
                    if (msg.onlineUsers) setOnlineUsers(msg.onlineUsers);
                    // If it has text, it's a join/leave event, show it in chat
                    if (!msg.text || msg.text === "Initial presence") return;
                }

                setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
                setTypingUsers(prev => { const n = { ...prev }; delete n[msg.authorId]; return n; });
                if (collapsed) setUnread(n => n + 1);

                // Notifications
                if (notifRef.current && msg.authorId !== userId && msg.type === "user") {
                    const cleanPseudo = userPseudo?.replace(/[^a-zA-Z0-9_-]/g, "");
                    const cleanRoles = (userRoleNames && userRoleNames.length > 0 ? userRoleNames : (userRoleName ? [userRoleName] : [])).filter(Boolean).map(r => r!.replace(/[^a-zA-Z0-9_-]/g, ""));

                    const lowUserId = userId.toLowerCase();
                    const lowCleanRoles = cleanRoles.map(r => r.toLowerCase());
                    const lowCleanPseudo = cleanPseudo?.toLowerCase();
                    const lowMentions = msg.mentions?.map(m => m.toLowerCase()) || [];

                    const isMentioned = lowMentions.length > 0 && (
                        lowMentions.includes(lowUserId) ||
                        lowCleanRoles.some(r => lowMentions.includes(r)) ||
                        (lowCleanPseudo && lowMentions.includes(lowCleanPseudo)) ||
                        lowMentions.includes("everyone") ||
                        lowMentions.includes("here")
                    );

                    if (isMentioned && collapsed) {
                        setHasMention(true);
                    }

                    if (document.hidden) {
                        if (Notification.permission === "granted" && notifRef.current) {
                            new Notification(isMentioned ? `🔔 RUN MENTION : ${msg.authorName}` : `Run 💬 ${msg.authorName}`, {
                                body: msg.text,
                                icon: msg.authorImage,
                                tag: "chat-run"
                            });
                        }
                    }

                    if (notifRef.current && (collapsed || isMentioned)) {
                        // Play sound
                        if (soundRef.current) {
                            const audio = new Audio("/sounds/pop.mp3");
                            audio.volume = isMentioned ? 0.8 : 0.4;
                            audio.play().catch(() => { });
                        }

                        if (isMentioned && collapsed) {
                            toast(`Run: Mention de ${msg.authorName}`, {
                                description: msg.text.slice(0, 60) + (msg.text.length > 60 ? "..." : ""),
                                action: { label: "Voir", onClick: () => setCollapsed(false) },
                                duration: 8000,
                            });
                        }
                    }
                }
            } catch { }
        };

        return () => { es.close(); esRef.current = null; };
    }, [runId, collapsed]); // Minimal dependencies, using refs for the rest

    // Auto-scroll
    useEffect(() => {
        if (!collapsed) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, collapsed, typingUsers]);

    // Reset unread on expand
    useEffect(() => {
        if (!collapsed) {
            setUnread(0);
            setHasMention(false);
        }
    }, [collapsed]);

    // Typing broadcast
    const handleInputChange = (value: string) => {
        setInput(value);
        if (!value.trim()) return;
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            startTransition(() => { setRunTypingIndicator(guildId, runId).catch(() => { }); });
        }, 300);
    };

    // ── Send ──────────────────────────────────────────────────────────────────
    const handleSend = useCallback(async (e?: React.MouseEvent | string) => {
        const textToSearch = typeof e === "string" ? e : input;
        if (!textToSearch.trim() || sending) return;

        setSending(true);
        setError(null);
        setShowEmoji(false);

        try {
            const cleanInput = textToSearch.trim();

            // Interception des commandes incompletes pour ouvrir le modal
            const isVote = cleanInput === "/vote" || cleanInput === "/votes";
            if (isVote) {
                setShowPollModal(true);
                setSending(false);
                setInput("");
                return;
            }

            const res = await sendRunChatMessage(guildId, runId, cleanInput);
            if (res.success && res.data) {
                setMessages(prev => {
                    if (prev.find(m => m.id === res.data!.id)) return prev;
                    return [...prev, res.data!];
                });
                setInput("");
                setHistoryIndex(-1);
                setInputHistory(prev => [cleanInput, ...prev.filter(x => x !== cleanInput)].slice(0, 50));
            } else if (!res.success) {
                setError(res.error || "Erreur");
                setTimeout(() => setError(null), 5000);
            }
        } catch (e) {
            console.error("[RunChat] handleSend error:", e);
            setError("Erreur de connexion");
            setTimeout(() => setError(null), 5000);
        } finally {
            setSending(false);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [input, sending, guildId, runId]);

    const handleVote = useCallback(async (optId: string, msgId: string) => {
        const res = await voteInChatPoll(guildId, msgId, optId, runId);
        if (!res.success && res.error) {
            setError(res.error);
            setTimeout(() => setError(null), 3000);
        }
    }, [guildId, runId]);

    const handleLaunchPoll = async (question: string, options: string[]) => {
        const fullCmd = `/vote ${question} | ${options.join(" | ")}`;
        await handleSend(fullCmd);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // ChatAutocomplete will prevent default if it handles Enter/Tab/Arrows
        if (e.defaultPrevented) return;

        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
        if (e.key === "Escape") { if (showEmoji) setShowEmoji(false); }

        // History navigation
        if (e.key === "ArrowUp" && inputHistory.length > 0) {
            if (!input || historyIndex >= 0) {
                e.preventDefault();
                const nextIdx = Math.min(historyIndex + 1, inputHistory.length - 1);
                setHistoryIndex(nextIdx);
                setInput(inputHistory[nextIdx]);
            }
        } else if (e.key === "ArrowDown" && historyIndex >= 0) {
            e.preventDefault();
            const prevIdx = historyIndex - 1;
            setHistoryIndex(prevIdx);
            if (prevIdx >= 0) {
                setInput(inputHistory[prevIdx]);
            } else {
                setInput("");
            }
        }
    };

    const typingNames = Object.values(typingUsers)
        .filter(t => t.expireAt > Date.now())
        .map(t => t.name)
        .slice(0, 3);

    const toggleNotif = () => {
        const next = !notifEnabled;
        setNotifEnabled(next);
        localStorage.setItem(`runchat:notif:${runId}`, next ? "true" : "false");
        if (next && Notification.permission === "default") Notification.requestPermission();
    };

    const toggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        localStorage.setItem(`runchat:sound:${runId}`, next ? "true" : "false");
    };

    return (
        <div className={`rounded-xl border border-white/10 bg-zinc-900/70 overflow-hidden flex flex-col transition-all duration-300 ${collapsed ? "h-auto" : "h-full max-h-[600px]"}`}>
            {/* Header */}
            <div className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-zinc-950/40 flex-shrink-0 select-none">
                <div onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors truncate max-w-[70px]">Chat Run</span>
                    </div>

                    {/* Online users */}
                    <div className="flex -space-x-1.5 items-center ml-2 hidden md:flex shrink-0">
                        {onlineUsers.slice(0, 2).map((u) => (
                            <div key={u.id} title={u.name} className="relative first:ml-0 rounded-full ring-2 ring-zinc-950 z-0">
                                <Avatar name={u.name} image={u.image} />
                            </div>
                        ))}
                        {onlineUsers.length > 2 && (
                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 ring-2 ring-zinc-950 z-10">
                                +{onlineUsers.length - 2}
                            </div>
                        )}
                    </div>

                    {collapsed && unread > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm transition-all
                            ${hasMention ? "bg-red-600 animate-bounce ring-2 ring-red-500/50" : "bg-indigo-600 animate-bounce"}
                        `}>
                            {unread}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-0.5">
                    <button onClick={() => setShowTransparency(true)} title="Transparence" className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-indigo-400 transition-colors">
                        <HelpCircle className="w-4 h-4" />
                    </button>
                    <button onClick={toggleSound} title={soundEnabled ? "Couper le son" : "Activer le son"}
                        className={`p-1.5 rounded-lg transition-colors ${soundEnabled ? "text-indigo-400 hover:bg-indigo-400/10" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"}`}>
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={toggleNotif}
                        title={notifEnabled ? "Désactiver notifs" : "Activer notifs"}
                        className={`p-1.5 rounded-lg transition-colors ${notifEnabled ? "text-indigo-400 hover:bg-indigo-400/10" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"}`}>
                        {notifEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 transition-colors">
                        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {!collapsed && (
                <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[250px] p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center gap-1 text-zinc-600">
                                <MessageCircle className="w-8 h-8 opacity-30" />
                                <span className="text-xs">Coordonnez-vous ici !</span>
                            </div>
                        )}
                        {messages.map(msg => (
                            <MsgBubble
                                key={msg.id}
                                msg={msg}
                                isOwn={msg.authorId === userId}
                                currentUserId={userId}
                                currentUserRole={userRoleName}
                                currentUserPseudo={userPseudo}
                                onVote={handleVote}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <TypingIndicator names={typingNames} />

                    {error && <div className="px-3 py-1 text-xs text-red-400 bg-red-500/10 flex-shrink-0">{error}</div>}

                    {/* Input */}
                    <div className="p-3 border-t border-white/5 flex-shrink-0 relative">
                        {input.startsWith("/") && (
                            <ChatAutocomplete
                                input={input}
                                onSelect={(val, autoSend) => {
                                    if (autoSend) {
                                        setInput("");
                                        handleSend(val);
                                    } else {
                                        setInput(val);
                                    }
                                    inputRef.current?.focus();
                                }}
                                bottomOffset="calc(100% - 4px)"
                            />
                        )}

                        {banStatus.isBanned && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center p-2 animate-in fade-in duration-300">
                                <Lock className="w-5 h-5 text-red-500 mb-1 animate-pulse" />
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-none">Accès Restreint</span>
                                <div className="mt-1.5 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-mono text-red-400">
                                    {Math.floor(banStatus.remainingSeconds / 60)}:{(banStatus.remainingSeconds % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        )}
                        <div className={`flex items-end gap-2 bg-zinc-800 rounded-xl px-3 py-2 ${banStatus.isBanned ? "opacity-20 pointer-events-none select-none" : ""}`}>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => handleInputChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message ou /commandes... (Entrée)"
                                rows={1}
                                maxLength={CHAT_MAX_LENGTH}
                                disabled={banStatus.isBanned}
                                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none leading-relaxed max-h-24 scrollbar-thin overflow-y-auto"
                            />
                            {!banStatus.isBanned && (
                                <div className="flex items-center gap-1">
                                    <div className="relative group flex items-center">
                                        <button type="button" className="flex-shrink-0 w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all flex items-center justify-center">
                                            <Command className="w-4 h-4" />
                                        </button>
                                        <div className="absolute bottom-full right-0 mb-3 w-56 p-3 bg-zinc-900 border border-white/10 rounded-xl flex flex-col shadow-2xl shadow-black/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-xs text-zinc-300 pointer-events-none z-50">
                                            <div className="font-bold text-white mb-2 px-1 text-[13px] border-b border-white/10 pb-1.5 flex items-center justify-between">
                                                Commandes ( / )
                                            </div>
                                            <ul className="space-y-1.5 font-medium">
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/objet</span> Chercher un objet</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/pano</span> Chercher une pano</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/donjon</span> Chercher un donjon</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/monstre</span> Chercher un monstre</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/quete</span> Chercher une quête</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/classe</span> Chercher une classe</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/vote</span> Créer un sondage</li>
                                                <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/roll</span> Lancer un dé</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowPollModal(true)}
                                        className="flex-shrink-0 w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all flex items-center justify-center"
                                        title="Créer un sondage">
                                        <BarChart3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowEmoji(v => !v)}
                                        className={`flex-shrink-0 w-7 h-7 rounded-lg transition-all flex items-center justify-center ${showEmoji ? "bg-indigo-600/30 text-indigo-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}>
                                        <Smile className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || sending || banStatus.isBanned}
                                className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                            >
                                <Send className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>

                        {showEmoji && (
                            <EmojiPicker
                                onSelect={emoji => { setInput(prev => prev + emoji); inputRef.current?.focus(); }}
                                onClose={() => setShowEmoji(false)}
                            />
                        )}

                        <div className="flex justify-end mt-1">
                            <span className={`text-[10px] ${input.length > CHAT_MAX_LENGTH * 0.8 ? "text-amber-400" : "text-zinc-700"}`}>
                                {input.length}/{CHAT_MAX_LENGTH}
                            </span>
                        </div>
                    </div>
                </>
            )}

            <ChatTransparencyModal
                open={showTransparency}
                onClose={() => setShowTransparency(false)}
            />
            <ChatPollModal
                isOpen={showPollModal}
                onClose={() => setShowPollModal(false)}
                onLaunch={handleLaunchPoll}
            />
        </div>
    );
}
