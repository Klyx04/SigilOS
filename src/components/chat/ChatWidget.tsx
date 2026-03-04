"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
    Send,
    MessageSquare,
    X,
    Maximize2,
    Minimize2,
    Volume2,
    VolumeX,
    Bell, BellOff, Trash2, Activity, ChevronDown, Shield, Smile, RotateCcw,
    Zap, Lock, BarChart3, Clock, UserX, GripVertical, HelpCircle, Command, Dices, UserCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ChatTransparencyModal } from "./ChatTransparencyModal";
import {
    sendChatMessage,
    getChatHistory,
    clearGuildChat,
    muteChatUser,
    getChatMentionOptions,
    voteInChatPoll,
    getUserChatBanStatus,
    setTypingIndicator,
    pushSystemChatMessage
} from "@/server/actions/chat-actions";
import {
    CHAT_MAX_LENGTH,
    type ChatMessage
} from "@/lib/chat-helpers";
import { usePresence, PresenceProvider } from "@/components/providers/PresenceProvider";
import { ChatAutocomplete } from "./ChatAutocomplete";
import { ChatPollModal } from "./ChatPollModal";
import { renderTextWithLinks } from "@/lib/chat-renderer";
import { cn } from "@/lib/utils";

interface ChatWidgetProps {
    guildId: string;
    userId: string;
    canModerate?: boolean;
    displayName?: string;
    avatarUrl?: string;
    userRoleName?: string;
    userRoleNames?: string[];
    userRoleIds?: string[];
    userPseudo?: string;
}

// â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TypingIndicator({ names }: { names: string[] }) {
    if (names.length === 0) return null;
    return (
        <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-zinc-500 italic select-none animate-in fade-in slide-in-from-bottom-1">
            <span className="flex gap-0.5 items-end">
                {[0, 1, 2].map(i => (
                    <span key={i} className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                ))}
            </span>
            {names.length === 1 ? `${names[0]} Ã©crit` : `${names.length} personnes Ã©crivent`}...
        </div>
    );
}

const MessageItem = memo(({ msg, isOwn, currentUserId, currentUserRole, currentUserPseudo, onVote, canModerate, onMute }: {
    msg: ChatMessage;
    isOwn: boolean;
    currentUserId: string;
    currentUserRole?: string;
    currentUserPseudo?: string;
    onVote: (optId: string, msgId: string) => void;
    canModerate?: boolean;
    onMute?: (userId: string, name: string) => void;
}) => {
    if (msg.type === "system") {
        return (
            <div className="flex justify-center my-2 animate-in fade-in duration-300">
                <div className="flex items-center gap-1.5 opacity-60">
                    <Activity className="w-3 h-3 text-white" />
                    <span className="text-[11px] font-light text-white tracking-wide">{msg.text}</span>
                </div>
            </div>
        );
    }

    if (msg.type === "presence") {
        const isJoin = msg.text?.includes("rejoint");
        return (
            <div className="flex justify-center my-1 animate-in fade-in duration-300">
                <span className={cn(
                    "text-[10px] font-light tracking-wide",
                    isJoin ? "text-white/30" : "text-zinc-600/70"
                )}>{msg.text}</span>
            </div>
        );
    }

    if (msg.type === "poll" && msg.pollData) {
        const totalVotes = Object.keys(msg.pollData.voters || {}).length;
        const myVote = msg.pollData.voters?.[currentUserId];

        return (
            <div className={cn("flex gap-3 items-end group mb-4", isOwn ? "flex-row-reverse" : "flex-row")}>
                {!isOwn && (
                    <Avatar className="h-6 w-6 border border-white/10 mb-1">
                        <AvatarImage src={msg.authorImage || ""} />
                        <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400">{msg.authorName[0]}</AvatarFallback>
                    </Avatar>
                )}
                <div className={cn("flex flex-col gap-1 w-full max-w-[85%]", isOwn ? "items-end" : "items-start")}>
                    <span className="text-[10px] font-black uppercase text-zinc-500 px-1">{msg.authorName} a lancÃ© un sondage</span>
                    <div className={cn(
                        "p-4 rounded-2xl text-[13px] border w-full backdrop-blur-sm",
                        isOwn ? "bg-indigo-900/40 border-indigo-500/30 rounded-br-sm" : "bg-zinc-800/80 border-white/10 rounded-bl-sm"
                    )}>
                        <div className="font-bold text-white mb-3 text-sm">{msg.pollData.question}</div>
                        <div className="flex flex-col gap-2 relative z-10">
                            {msg.pollData.options.map((opt) => {
                                const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                const isMyVote = myVote === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            if (!msg.id) return;
                                            onVote(opt.id, msg.id);
                                        }}
                                        className={cn(
                                            "group/opt relative w-full text-left p-3 rounded-xl text-[13px] transition-all flex justify-between items-center border overflow-hidden cursor-pointer hover:shadow-md active:scale-[0.98] z-20",
                                            isMyVote
                                                ? "border-indigo-400 bg-indigo-500/10 text-indigo-100 ring-2 ring-indigo-500/20"
                                                : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 text-zinc-300"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out z-0 pointer-events-none",
                                                isMyVote ? "bg-indigo-500/20" : "bg-zinc-500/10"
                                            )}
                                            style={{ width: `${percent}%` }}
                                        />
                                        <span className="relative z-10 font-bold flex items-center gap-2 pointer-events-none">
                                            {opt.text}
                                            {isMyVote && <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white animate-in zoom-in">âœ“</span>}
                                        </span>
                                        <span className={cn(
                                            "relative z-10 text-[10px] font-black tracking-tighter transition-all pointer-events-none",
                                            isMyVote ? "text-indigo-400" : "text-zinc-500 group-hover/opt:text-zinc-400"
                                        )}>
                                            {percent}%
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">
                            <span>{totalVotes} vote{totalVotes > 1 ? 's' : ''}</span>
                            <span className="flex items-center gap-1.5"><BarChart3 className="w-2.5 h-2.5" /> Sondage actif</span>
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
        <div className={cn(
            "flex gap-3 items-end group mb-4",
            isOwn ? "flex-row-reverse" : "flex-row",
            isMentioned && !isOwn ? "bg-indigo-500/5 -mx-4 px-4 py-3 border-l-2 border-indigo-500" : ""
        )}>
            {!isOwn && (
                <div className="shrink-0 mb-1 relative group/avatar">
                    <Avatar className="h-6 w-6 border border-white/10">
                        <AvatarImage src={msg.authorImage || ""} />
                        <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400">{msg.authorName[0]}</AvatarFallback>
                    </Avatar>
                    {canModerate && !isOwn && (
                        <button
                            onClick={() => onMute?.(msg.authorId, msg.authorName)}
                            className="absolute -top-1 -left-1 hidden group-hover/avatar:flex bg-rose-500 text-white rounded-full p-0.5 shadow-lg active:scale-90"
                            title={`Muter ${msg.authorName}`}
                        >
                            <UserX className="w-2.5 h-2.5" />
                        </button>
                    )}
                </div>
            )}
            <div className={cn("flex flex-col gap-1 max-w-[82%]", isOwn ? "items-end" : "items-start")}>
                <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        {isOwn ? "Vous" : msg.authorName}
                    </span>
                    <span className="text-[8px] font-bold text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
                <div className={cn(
                    "px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-lg backdrop-blur-sm transition-all duration-300",
                    isOwn
                        ? "bg-indigo-600 text-white rounded-br-sm shadow-indigo-600/10"
                        : isMentioned
                            ? "bg-indigo-900/40 text-indigo-100 rounded-bl-sm border border-indigo-500/30"
                            : "bg-zinc-800/80 text-zinc-100 rounded-bl-sm border border-white/5"
                )}>
                    {renderTextWithLinks(msg.text, msg.mentions)}
                </div>
            </div>
        </div>
    );
});
MessageItem.displayName = "MessageItem";

// â”€â”€ Emoji Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EMOJI_GROUPS = [
    { label: "Pop", emojis: ["ðŸ˜‚", "ðŸ”¥", "ðŸ‘", "â¤ï¸", "ðŸ˜®", "ðŸ™Œ", "ðŸ’€", "ðŸŽ‰", "ðŸ™„", "ðŸ¤”"] },
    { label: "Gestes", emojis: ["ðŸ‘‹", "âœŒï¸", "ðŸ‘Œ", "ðŸ’ª", "ðŸ™", "ðŸ‘€", "ðŸ§ ", "âœ¨", "ðŸ’¯", "âœ…"] },
    { label: "Jeu", emojis: ["ðŸ‰", "âš”ï¸", "ðŸ›¡ï¸", "ðŸ§™", "ðŸ’°", "ðŸ—ºï¸", "ðŸ§ª", "ðŸ¥š", "ðŸ°", "ðŸ”¨"] },
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [activeGroup, setActiveGroup] = useState(0);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    return (
        <div ref={ref} className="absolute bottom-[calc(100%+12px)] right-0 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex border-b border-white/5 bg-zinc-950/60">
                {EMOJI_GROUPS.map((g, i) => (
                    <button key={g.label} onClick={() => setActiveGroup(i)} className={cn("flex-1 py-3 text-[10px] font-black uppercase transition-all", activeGroup === i ? "text-indigo-400 bg-white/5" : "text-zinc-500 hover:text-zinc-300")}>{g.label}</button>
                ))}
            </div>
            <div className="p-3 grid grid-cols-5 gap-2">
                {EMOJI_GROUPS[activeGroup].emojis.map(e => (
                    <button key={e} onClick={() => { onSelect(e); onClose(); }} className="w-full h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-xl transition-all hover:scale-110 active:scale-90">{e}</button>
                ))}
            </div>
        </div>
    );
}

// â”€â”€ Main ChatWidget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ChatWidget(props: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    return (
        <PresenceProvider guildId={props.guildId} isActive={isOpen && !isMinimized}>
            <ChatInner
                {...props}
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />
        </PresenceProvider>
    );
}

function ChatInner({
    guildId,
    userId,
    displayName,
    userRoleName,
    userRoleNames,
    userRoleIds,
    userPseudo,
    canModerate,
    isOpen,
    setIsOpen,
    isMinimized,
    setIsMinimized
}: ChatWidgetProps & {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
}) {
    const { onlineUsers, isConnected, lastMessage } = usePresence();
    const [isMaximized, setIsMaximized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unread, setUnread] = useState(0);
    const [showEmoji, setShowEmoji] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(() => typeof window !== "undefined" ? localStorage.getItem("chat-sound") !== "false" : true);
    const [notifEnabled, setNotifEnabled] = useState(() => typeof window !== "undefined" ? localStorage.getItem("chat-notif") !== "false" : true);

    useEffect(() => { localStorage.setItem("chat-sound", soundEnabled.toString()); }, [soundEnabled]);
    useEffect(() => { localStorage.setItem("chat-notif", notifEnabled.toString()); }, [notifEnabled]);
    const [hasMention, setHasMention] = useState(false);
    const [banStatus, setBanStatus] = useState({ isBanned: false, remainingSeconds: 0 });
    const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; expireAt: number }>>({});
    const [mentionOptions, setMentionOptions] = useState<any[]>([]);
    const [showPollModal, setShowPollModal] = useState(false);

    const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    // Timestamp de connexion : on filtre les messages "presence" antÃ©rieurs (historique)
    // joinedAt: initialized in mount effect (Date.now() is impure for inline useRef init)

    // -- Drag & Resize Logic --
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [size, setSize] = useState({ w: 420, h: 600 });
    const panelRef = useRef<HTMLDivElement>(null);
    const dragData = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
    const resizeData = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

    const onMove = useCallback((e: MouseEvent) => {
        if (resizeData.current) {
            const dx = resizeData.current.startX - e.clientX;
            const dy = resizeData.current.startY - e.clientY;
            setSize({
                w: Math.min(Math.max(350, resizeData.current.startW + dx), 1200),
                h: Math.min(Math.max(400, resizeData.current.startH + dy), 1000)
            });
            return;
        }
        if (!dragData.current) return;
        setPos({
            x: dragData.current.startPosX + (e.clientX - dragData.current.startX),
            y: dragData.current.startPosY + (e.clientY - dragData.current.startY)
        });
    }, []);

    const onUp = useCallback(() => {
        dragData.current = null;
        resizeData.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
    }, [onMove]);

    const handleDragStart = (e: React.MouseEvent) => {
        if (!panelRef.current || isMaximized) return;
        const rect = panelRef.current.getBoundingClientRect();
        dragData.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pos?.x ?? rect.left,
            startPosY: pos?.y ?? rect.top
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!panelRef.current || isMaximized) return;
        resizeData.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: size.w,
            startH: size.h
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    };

    // -- Refs for SSE Stability --
    const notifRef = useRef(notifEnabled);
    const soundRef = useRef(soundEnabled);
    const isOpenRef = useRef(isOpen);
    const isMinRef = useRef(isMinimized);
    useEffect(() => { notifRef.current = notifEnabled; }, [notifEnabled]);
    useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
    useEffect(() => { isMinRef.current = isMinimized; }, [isMinimized]);

    // joinedAt: timestamp de connexion — filtre les messages presence historiques (CHAT-1)
    const joinedAt = useRef<number>(0);
    useEffect(() => { joinedAt.current = Date.now(); }, []);

    const [showTransparency, setShowTransparency] = useState(false);

    // Initial Fetch — exclut les messages "presence" de l'historique (CHAT-1)
    useEffect(() => {
        if (!isOpen) return;
        getChatHistory(guildId).then(res => {
            if (res.success && res.data) {
                setMessages(res.data.filter(m => m.type !== "presence"));
            }
        });
        getChatMentionOptions(guildId).then(res => { if (res.success && res.data) setMentionOptions(res.data); });
        getUserChatBanStatus(userId).then(setBanStatus);
    }, [isOpen, guildId, userId]);

    // Ban Countdown
    useEffect(() => {
        if (banStatus.remainingSeconds <= 0) return;
        const t = setInterval(() => setBanStatus(p => ({ ...p, remainingSeconds: Math.max(0, p.remainingSeconds - 1) })), 1000);
        return () => clearInterval(t);
    }, [banStatus.remainingSeconds]);


    // Global Message Handler (via PresenceProvider)
    useEffect(() => {
        if (!lastMessage) return;
        const msg = lastMessage;

        // 1. Typing Management
        if (msg.type === "typing") {
            if (msg.authorId === userId) return;
            setTypingUsers(prev => ({ ...prev, [msg.authorId]: { name: msg.authorName, expireAt: Date.now() + 4000 } }));
            clearTimeout(typingTimeouts.current[msg.authorId]);
            typingTimeouts.current[msg.authorId] = setTimeout(() => {
                setTypingUsers(prev => { const n = { ...prev }; delete n[msg.authorId]; return n; });
            }, 4000);
            return;
        }

        // 2. State Sync (Messages & Poll Updates)
        if (msg.id === "presence-init") return; // Ignore initial sync in UI list

        // CHAT-1 FIX: Ne pas afficher les messages "presence" historiques
        // (antÃ©rieurs au moment de connexion du client -- Ã©vite le pavÃ© de notifs)
        if (msg.type === "presence") {
            const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
            if (msgTime < joinedAt.current) return; // PrÃ©sence historique â†’ skip
        }

        setMessages(prev => {
            if (!msg.id) return prev;
            const exists = prev.find(m => m.id === msg.id);
            if (exists) return prev.map(m => (m.id === msg.id) ? msg : m);
            return [...prev, msg].slice(-200);
        });

        // 3. Notification & Sound Logic
        if (msg.authorId !== userId && (msg.type === "user" || msg.type === "poll")) {
            const isMent = msg.mentions?.some(m =>
                m === userId ||
                (userPseudo && m === userPseudo.toLowerCase()) ||
                (userRoleIds && userRoleIds.some(rid => rid.toLowerCase() === m)) ||
                m === "everyone" ||
                m === "here"
            );

            // Always play sound on mention (if not from self)
            if (isMent && soundRef.current) {
                const audio = new Audio("/sounds/notif.mp3");
                audio.volume = 1.0;
                audio.play().catch(() => { });
            }

            // Only show toaster/badge if chat is closed or minimized
            if (!isOpenRef.current || isMinRef.current) {
                setUnread(p => p + 1);
                if (isMent) {
                    setHasMention(true);
                    if (notifRef.current) {
                        toast(`Mention de ${msg.authorName}`, {
                            description: msg.text,
                            action: { label: "Voir", onClick: () => { setIsOpen(true); setIsMinimized(false); } }
                        });
                    }
                }
            }
        }
    }, [lastMessage, userId, userPseudo, userRoleIds]);

    useEffect(() => {
        if (isOpen && !isMinimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen, isMinimized, typingUsers]);

    const handleSend = useCallback(async (over?: string) => {
        const t = over !== undefined ? over : input;
        if (!t.trim() || sending || banStatus.isBanned) return;

        // Force modal if /vote is partial or just keywords
        const lowerT = t.trim().toLowerCase();
        if (lowerT === "/vote" || lowerT === "/poll") {
            setShowPollModal(true);
            setInput("");
            return;
        }

        // If someone types /vote help or /vote something without enough pipes, open modal too
        if (lowerT.startsWith("/vote ") || lowerT.startsWith("/poll ")) {
            const pipes = t.split("|").length - 1;
            if (pipes < 2) {
                const questionPart = t.slice(6).trim();
                setShowPollModal(true);
                // We could pass questionPart to setQuestion if we had access to it, 
                // but let's just open the modal to prevent broken messages.
                setInput("");
                return;
            }
        }

        setSending(true);
        setError(null);
        setShowEmoji(false);

        const res = await sendChatMessage(guildId, t.trim());
        if (res.success) setInput("");
        else { setError(res.error || "Erreur"); setTimeout(() => setError(null), 5000); }
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [input, sending, guildId, banStatus.isBanned]);

    const handleMute = async (targetId: string, name: string) => {
        if (!canModerate) return;
        const res = await muteChatUser(guildId, targetId);
        if (res.success) {
            toast.success(`${name} est muté pour 5 minutes`);
            // Notify everyone in the chat via system message
            await pushSystemChatMessage(guildId, `🔇 ${name} a été rendu muet par un modérateur.`);
        }
        else toast.error("Impossible de muter");
    };

    const handleClear = async () => {
        if (!canModerate || !confirm("Nettoyer tout le chat ?")) return;
        const res = await clearGuildChat(guildId);
        if (res.success) toast.success("Chat nettoyÃ©");
    };

    const typingNames = Object.values(typingUsers).map(u => u.name);

    return (
        <div className="fixed bottom-10 right-10 z-50 flex flex-col items-end gap-3 pointer-events-none">
            {isOpen && !isMinimized && (
                <div
                    ref={panelRef}
                    style={isMaximized ? {
                        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                        width: "calc(100vw - 32px)", maxWidth: "1200px", height: "calc(100vh - 120px)",
                        maxHeight: "950px", zIndex: 60
                    } : {
                        position: "fixed",
                        left: pos ? `${pos.x}px` : undefined,
                        top: pos ? `${pos.y}px` : undefined,
                        bottom: pos ? undefined : "40px",
                        right: pos ? undefined : "40px",
                        width: `${size.w}px`,
                        height: `${size.h}px`,
                        zIndex: 60
                    }}
                    className={cn(
                        "pointer-events-auto flex flex-col bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 transition-all ring-1 ring-white/5"
                    )}>

                    {/* Resize Handle (Top-Left corner) */}
                    {!isMaximized && (
                        <div
                            onMouseDown={handleResizeStart}
                            className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize z-[70] hover:bg-indigo-500/10 rounded-br-xl flex items-center justify-center transition-colors group/resize"
                        >
                            <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full group-hover/resize:bg-indigo-400" />
                        </div>
                    )}

                    {/* Header - Custom Drag Handle logic */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-zinc-950/60 backdrop-blur-md shrink-0">
                        <div className="flex items-center gap-3">
                            {!isMaximized && (
                                <div
                                    onMouseDown={handleDragStart}
                                    className="p-1 -ml-2 hover:bg-white/5 rounded-lg cursor-move text-zinc-600 hover:text-white transition-all"
                                    title="DÃ©placer"
                                >
                                    <GripVertical className="w-4 h-4" />
                                </div>
                            )}
                            <div className="flex gap-1.5 ml-1">
                                {onlineUsers.slice(0, 3).map(u => (
                                    <Avatar key={u.id} className="w-6 h-6 ring-2 ring-zinc-950 shadow-md">
                                        <AvatarImage src={u.image} />
                                        <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400">{u.name[0]}</AvatarFallback>
                                    </Avatar>
                                ))}
                                {onlineUsers.length > 3 && <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[8px] font-black text-zinc-400">+{onlineUsers.length - 3}</div>}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-zinc-100 flex items-center gap-2 italic"><Zap className="w-2.5 h-2.5 text-yellow-400" />Live Stream</span>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{onlineUsers.length} en ligne</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setShowTransparency(true)} title="Transparence & RÃ¨gles" className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-indigo-400 transition-all">
                                <HelpCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Couper le son" : "Activer le son"} className={cn("p-2 rounded-xl transition-all", soundEnabled ? "text-indigo-400 hover:bg-indigo-400/10" : "text-zinc-600 hover:text-zinc-400")}>
                                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setNotifEnabled(!notifEnabled)} title={notifEnabled ? "DÃ©sactiver les pop-ups" : "Activer les pop-ups"} className={cn("p-2 rounded-xl transition-all", notifEnabled ? "text-indigo-400 hover:bg-indigo-400/10" : "text-zinc-600 hover:text-zinc-400")}>
                                {notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                            </button>

                            <div className="w-[1px] h-4 bg-white/5 mx-1" />

                            <button onClick={() => setIsMinimized(true)} title="RÃ©duire" className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-all"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => setIsMaximized(!isMaximized)} className="hidden md:block p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-all">{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                            <button onClick={() => setIsOpen(false)} title="Fermer" className="p-2 hover:bg-rose-500/10 rounded-xl text-zinc-500 hover:text-rose-400 transition-all"><X className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-white/10">
                        {!isConnected && <div className="h-full flex flex-col items-center justify-center opacity-50"><RotateCcw className="w-8 h-8 animate-spin" /></div>}
                        {isConnected && messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-20"><MessageSquare className="w-16 h-16 animate-pulse" /><p className="text-xs font-black uppercase tracking-[0.3em] mt-4">Nouveau Chat</p></div>
                        )}
                        {messages.map((m, i) => (
                            <MessageItem
                                key={m.id || i}
                                msg={m}
                                isOwn={m.authorId === userId}
                                currentUserId={userId}
                                currentUserRole={userRoleName}
                                currentUserPseudo={userPseudo}
                                onVote={async (o, mId) => {
                                    const res = await voteInChatPoll(guildId, mId, o);
                                    if (!res.success) toast.error(res.error || "Erreur de vote");
                                }}
                                canModerate={canModerate}
                                onMute={handleMute}
                            />
                        ))}
                        <TypingIndicator names={typingNames} />
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-zinc-950/60 border-t border-white/5 relative backdrop-blur-2xl">
                        {error && <div className="absolute -top-12 left-4 right-4 bg-rose-500 text-white text-[10px] font-black px-4 py-2 rounded-xl border border-white/20 animate-in fade-in slide-in-from-bottom-2">{error}</div>}
                        {(input.startsWith("/") || input.includes("@")) && <ChatAutocomplete input={input} onSelect={(v, a) => { if (a) { setInput(""); handleSend(v); } else setInput(v); inputRef.current?.focus(); }} bottomOffset="calc(100% + 12px)" mentions={mentionOptions} userDisplayName={displayName} />}

                        {banStatus.isBanned && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center animate-in fade-in">
                                <Lock className="w-6 h-6 text-rose-500 mb-2 animate-pulse" />
                                <span className="text-[11px] font-black text-rose-400 uppercase tracking-widest leading-none">AccÃ¨s Interdit</span>
                                <div className="mt-2 text-xs font-mono text-zinc-500">{Math.floor(banStatus.remainingSeconds / 60)}:{(banStatus.remainingSeconds % 60).toString().padStart(2, "0")}</div>
                            </div>
                        )}

                        <div className="relative flex items-end gap-3 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 transition-all focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/30">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => { setInput(e.target.value); setTypingIndicator(guildId); }}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder="Message ou /commandes..."
                                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none max-h-24 min-h-[20px]"
                                rows={1}
                            />
                            <div className="flex items-center gap-1.5 pb-0.5">
                                <div className="relative group flex items-center">
                                    <button type="button" className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all flex items-center justify-center">
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
                                            <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/monstre</span> Chercher un mob</li>
                                            <li className="flex items-center gap-2 px-1"><span className="text-indigo-400 font-mono w-[60px] text-right bg-indigo-500/10 px-1 py-0.5 rounded">/classe</span> Sorts & Spells</li>
                                            <li className="flex items-center gap-2 px-1 text-yellow-400/90"><Dices className="w-3 h-3 text-yellow-400" /><span className="text-yellow-400 font-mono w-[60px] text-right bg-yellow-400/10 px-1 py-0.5 rounded">/roll</span> Lancer un dÃ©</li>
                                        </ul>
                                    </div>
                                </div>
                                <button onClick={() => setShowPollModal(true)} className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-indigo-400/5 transition-all"><BarChart3 className="w-5 h-5" /></button>
                                <button onClick={() => setShowEmoji(!showEmoji)} className={cn("p-1.5 rounded-lg transition-all", showEmoji ? "text-yellow-400 bg-yellow-400/10" : "text-zinc-500 hover:text-yellow-400")}><Smile className="w-5 h-5" /></button>
                                <button onClick={() => handleSend()} disabled={!input.trim() || sending} className="p-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-20 shadow-lg active:scale-90"><Send className="w-4 h-4" /></button>
                            </div>
                        </div>
                        {showEmoji && <EmojiPicker onSelect={e => setInput(p => p + e)} onClose={() => setShowEmoji(false)} />}
                    </div>
                </div>
            )}

            {!isOpen || isMinimized ? (
                <div className="flex flex-col items-end gap-3 group/bubble">
                    {/* Hover Label */}
                    <div className="opacity-0 group-hover/bubble:opacity-100 translate-y-2 group-hover/bubble:translate-y-0 transition-all duration-300 pointer-events-none">
                        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl shadow-2xl ring-1 ring-white/5">
                            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-400 whitespace-nowrap drop-shadow-sm flex items-center gap-2 italic">
                                <MessageSquare className="w-3 h-3" /> Chat de Guilde
                            </span>
                        </div>
                    </div>

                    <div className="relative pointer-events-auto">
                        {/* Status Glow */}
                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse pointer-events-none" />

                        <button
                            onClick={() => { setIsOpen(true); setIsMinimized(false); setUnread(0); setHasMention(false); }}
                            className={cn(
                                "relative flex items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 text-white shadow-[0_12px_48px_rgba(79,70,229,0.5)] transition-all duration-500 hover:scale-110 active:scale-95 ring-2 ring-white/20 ring-inset group",
                                unread > 0 ? "h-16 w-16" : "h-14 w-14"
                            )}
                        >
                            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Context Label Badge */}
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-950 border border-white/20 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest text-indigo-300 uppercase shadow-lg">
                                Guilde
                            </div>

                            <MessageSquare className={cn("transition-all duration-500 group-hover:rotate-12", unread > 0 ? "h-7 w-7" : "h-6 w-6")} />

                            {!hasMention && unread === 0 && (
                                <div className="absolute top-1 right-1 flex h-4 w-4">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-zinc-950"></span>
                                </div>
                            )}

                            {unread > 0 && (
                                <div className={cn(
                                    "absolute -bottom-2 -right-2 h-8 min-w-[32px] px-2 flex items-center justify-center rounded-2xl border-[3px] border-zinc-950 text-[11px] font-black shadow-xl",
                                    hasMention ? "bg-rose-500 animate-bounce" : "bg-indigo-400"
                                )}>
                                    {unread > 99 ? "99+" : unread}
                                </div>
                            )}

                            {/* Online Count (Small) */}
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950/80 backdrop-blur-sm border border-white/5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tighter text-zinc-400 opacity-0 group-hover/bubble:opacity-100 transition-all flex items-center gap-1">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> {onlineUsers.length}
                            </div>
                        </button>
                    </div>
                </div>
            ) : null}

            <ChatPollModal
                isOpen={showPollModal}
                onClose={() => setShowPollModal(false)}
                onLaunch={(q, opts) => handleSend(`/vote ${q} | ${opts.join(" | ")}`)}
            />
            <ChatTransparencyModal open={showTransparency} onClose={() => setShowTransparency(false)} />
        </div>
    );
}
