"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
    Send, X, Minimize2, Maximize2, ChevronDown, MessageSquare, 
    Zap, Volume2, VolumeX, Bell, BellOff, RotateCcw, HelpCircle,
    UserX, ShieldBan, Lock, GripVertical, Command, Dices, Smile, BarChart3
} from "lucide-react";
import { motion, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { usePresence } from "@/components/providers/PresenceProvider";
import { PresenceProvider } from "@/components/providers/PresenceProvider";
import { 
    getChatHistory, 
    sendChatMessage, 
    clearGuildChat, 
    getChatMentionOptions,
    getUserChatBanStatus,
    muteChatUser,
    unmuteChatUser,
    getMuteTTL,
    setTypingIndicator,
    voteInChatPoll
} from "@/server/actions/chat-actions";
import { type ChatMessage } from "@/lib/chat-helpers";
import { ChatAutocomplete } from "./ChatAutocomplete";
import { ChatPollModal } from "./ChatPollModal";
import { ChatTransparencyModal } from "./ChatTransparencyModal";

interface ChatWidgetProps {
    guildId: string;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    userRoleName: string;
    userRoleNames: string[];
    userRoleIds: string[];
    userPseudo?: string;
    canModerate?: boolean;
    hideFloatingBubble?: boolean;
}

// ——————————————————————————————————————————————————————————————————————————————
// Helper: Parsing links and mentions in chat text
function renderTextWithLinks(text: string, mentions?: string[]) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 underline break-all inline-flex items-center gap-1">
                {part.length > 30 ? part.substring(0, 30) + "..." : part}
            </a>;
        }
        
        // Handle @mentions
        if (part.includes("@")) {
            const subParts = part.split(/(@[a-zA-Z0-9_\-À-ÿ]+)/g);
            return subParts.map((sub, j) => {
                if (sub.startsWith("@")) {
                    return <span key={`${i}-${j}`} className="text-indigo-300 font-bold bg-indigo-500/20 px-1 rounded-sm">{sub}</span>;
                }
                return sub;
            });
        }
        
        return part;
    });
}

// ——————————————————————————————————————————————————————————————————————————————
function TypingIndicator({ names }: { names: string[] }) {
    if (names.length === 0) return null;
    return (
        <div className="flex items-center gap-2 px-1 py-1 animate-in fade-in slide-in-from-bottom-1">
            <div className="flex gap-1">
                <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 italic">
                {names.length === 1 ? `${names[0]} écrit...` : `${names.length} personnes écrivent...`}
            </span>
        </div>
    );
}

// ——————————————————————————————————————————————————————————————————————————————
const MessageItem = React.memo(({ msg, isOwn, currentUserId, currentUserRole, currentUserPseudo, canModerate, onMute, onVote }: { 
    msg: ChatMessage, 
    isOwn: boolean,
    currentUserId?: string,
    currentUserRole?: string,
    currentUserPseudo?: string,
    canModerate?: boolean,
    onMute?: (id: string, name: string) => void,
    onVote?: (optId: string, msgId: string) => void
}) => {
    // 1. Poll specialized rendering
    if (msg.type === "poll" && msg.pollData) {
        const totalVotes = msg.pollData.options.reduce((acc, opt) => acc + opt.votes, 0);
        const voters = msg.pollData.voters || {};
        const hasVoted = !!voters[currentUserId || ""];

        return (
            <div className="flex flex-col gap-2 mb-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-2 px-1">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <BarChart3 className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Sondage • {msg.authorName}</span>
                </div>
                <div className="bg-zinc-800/40 border border-indigo-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
                    <h4 className="text-sm font-bold text-white mb-4 leading-tight">{msg.text}</h4>
                    <div className="space-y-2.5">
                        {msg.pollData.options.map((opt, idx: number) => {
                            const votes = opt.votes;
                            const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                            const isMyVote = voters[currentUserId || ""] === opt.id;

                            return (
                                <button
                                    key={opt.id || idx}
                                    disabled={hasVoted}
                                    onClick={() => onVote?.(opt.id, msg.id!)}
                                    className={cn(
                                        "relative w-full flex items-center justify-between p-3 rounded-xl border border-white/5 transition-all group/opt overflow-hidden",
                                        hasVoted ? "cursor-default" : "hover:border-indigo-500/40 hover:bg-white/5 active:scale-[0.98]",
                                        isMyVote && "border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20"
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
                                        {isMyVote && <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white animate-in zoom-in">✓</span>}
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
                            className="absolute -top-2 -left-2 hidden group-hover/avatar:flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-2 py-1 shadow-xl border border-rose-400/30 transition-all active:scale-95 whitespace-nowrap z-20"
                        >
                            <UserX className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-wide">Muter</span>
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

// ——————————————————————————————————————————————————————————————————————————————
const EMOJI_GROUPS = [
    { label: "Visages", emojis: ["😀", "😂", "🤣", "😊", "😍", "🤩", "🤔", "🤨", "🙄", "😏", "🥺", "😎", "😜", "😱", "😴"] },
    { label: "Gestes", emojis: ["👋", "👌", "✌️", "🤞", "🤟", "🤝", "👍", "👎", "👏", "🙌", "🙏", "💪", "🧠", "👀", "✨"] },
    { label: "Combat", emojis: ["⚔️", "🛡️", "🏹", "🗡️", "🪓", "💣", "🔥", "❄️", "⚡", "🧪", "💀", "⚰️", "🆘", "🚩", "🏆"] },
    { label: "Objets", emojis: ["💰", "💎", "🎒", "🏺", "📜", "🗺️", "🔑", "🎲", "🎯", "🕯️", "🛠️", "🩹", "🎁", "🎈", "🎉"] },
    { label: "Divers", emojis: ["🐷", "🐉", "🍀", "🍄", "⭐", "🌕", "🥪", "🍻", "🍕", "🍔", "📱", "💻", "💡", "❤️", "🔥"] },
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
        <div ref={ref} className="absolute bottom-[calc(100%+12px)] right-0 w-[calc(100vw-32px)] sm:w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
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

// ——————————————————————————————————————————————————————————————————————————————
function formatMuteTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
    if (m > 0) return `${m}min${s > 0 ? ` ${s}s` : ""}`;
    return `${s}s`;
}

interface ChatWidgetPropsCommon {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    isMinimized: boolean;
    setIsMinimized: (v: boolean) => void;
}

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
    setIsMinimized,
    hideFloatingBubble
}: ChatWidgetProps & ChatWidgetPropsCommon) {
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

    const [hasMention, setHasMention] = useState(false);
    const [banStatus, setBanStatus] = useState({ isBanned: false, remainingSeconds: 0 });
    const [muteSeconds, setMuteSeconds] = useState(0);
    const [muteModal, setMuteModal] = useState<{ userId: string; name: string } | null>(null);
    const [muteDuration, setMuteDuration] = useState(300);
    const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; expireAt: number }>>({});
    const [mentionOptions, setMentionOptions] = useState<any[]>([]);
    const [showPollModal, setShowPollModal] = useState(false);
    const [showTransparency, setShowTransparency] = useState(false);

    const [bubblePos, setBubblePos] = useState(() => {
        if (typeof window === "undefined") return { x: 0, y: 0 };
        const saved = localStorage.getItem(`chat-bubble-pos-${guildId}`);
        return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    });

    const dragControls = useDragControls();
    const [isDragging, setIsDragging] = useState(false);

    const isMuted = muteSeconds > 0;
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [size, setSize] = useState({ w: 420, h: 600 });
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

    useEffect(() => {
        if (!isOpen) return;
        getChatHistory(guildId).then(res => {
            if (res.success && res.data) setMessages(res.data.filter(m => m.type !== "presence"));
        });
        getChatMentionOptions(guildId).then(res => { if (res.success && res.data) setMentionOptions(res.data); });
        getUserChatBanStatus(userId).then(setBanStatus);
        getMuteTTL(guildId, userId).then(ttl => { if (ttl > 0) setMuteSeconds(ttl); });
    }, [isOpen, guildId, userId]);

    // Handle Scroll
    useEffect(() => {
        if (isOpen && !isMinimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen, isMinimized, typingUsers]);

    const handleSend = useCallback(async (over?: string) => {
        const t = over !== undefined ? over : input;
        if (!t.trim() || sending || banStatus.isBanned) return;

        if (t.trim().toLowerCase() === "/vote" || t.trim().toLowerCase() === "/poll") {
            setShowPollModal(true);
            setInput("");
            return;
        }

        setSending(true);
        setError(null);
        const res = await sendChatMessage(guildId, t.trim());
        if (res.success) setInput("");
        else { setError(res.error || "Erreur"); setTimeout(() => setError(null), 5000); }
        setSending(false);
    }, [input, sending, guildId, banStatus.isBanned]);

    const handleMuteConfirm = async () => {
        if (!muteModal) return;
        const res = await muteChatUser(guildId, muteModal.userId, muteDuration);
        if (res.success) toast.success(`${muteModal.name} muté`);
        setMuteModal(null);
    };

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
                        bottom: pos ? undefined : "10px",
                        right: pos ? undefined : "10px",
                        width: pos ? `${size.w}px` : "calc(100vw - 32px)",
                        maxWidth: pos ? "none" : "420px",
                        height: pos ? `${size.h}px` : "600px",
                        maxHeight: "calc(100vh - 120px)",
                        zIndex: 60
                    }}
                    className={cn(
                        "pointer-events-auto flex flex-col bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 transition-all ring-1 ring-white/5",
                        isMaximized && "rounded-3xl"
                    )}>

                    {!isMaximized && (
                        <div onMouseDown={handleResizeStart} className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize z-[70] hover:bg-indigo-500/10 rounded-br-xl" />
                    )}

                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-zinc-950/60 backdrop-blur-md shrink-0">
                        <div className="flex items-center gap-3">
                            {!isMaximized && (
                                <div onMouseDown={handleDragStart} className="p-1 -ml-2 hover:bg-white/5 rounded-lg cursor-move text-zinc-600 hover:text-white transition-all">
                                    <GripVertical className="w-4 h-4" />
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-zinc-100 flex items-center gap-2 italic"><Zap className="w-2.5 h-2.5 text-yellow-400" />Live Chat</span>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{onlineUsers.length} en ligne</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setShowTransparency(true)} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500"><HelpCircle className="w-4 h-4" /></button>
                            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl text-zinc-500">{soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>
                            <button onClick={() => setNotifEnabled(!notifEnabled)} className="p-2 rounded-xl text-zinc-500">{notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}</button>
                            <button onClick={() => setIsMinimized(true)} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => setIsMaximized(!isMaximized)} className="hidden md:block p-2 hover:bg-white/5 rounded-xl text-zinc-500">{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-rose-500/10 rounded-xl text-zinc-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-white/10">
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
                                    if (!res.success) toast.error(res.error || "Erreur");
                                }}
                                canModerate={canModerate}
                                onMute={(id, name) => setMuteModal({ userId: id, name })}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <div className="p-4 bg-zinc-950/60 border-t border-white/5 relative backdrop-blur-2xl">
                        {error && <div className="absolute -top-12 left-4 right-4 bg-rose-500 text-white text-[10px] font-black px-4 py-2 rounded-xl border border-white/20">{error}</div>}
                        
                        <div className={cn(
                            "relative flex items-end gap-3 border rounded-2xl px-4 py-3 transition-all",
                            isMuted ? "opacity-50 cursor-not-allowed" : "bg-white/[0.03] border-white/10 focus-within:border-indigo-500/30"
                        )}>
                            <textarea
                                ref={inputRef}
                                value={isMuted ? "" : input}
                                onChange={e => { if (!isMuted) setInput(e.target.value); }}
                                onKeyDown={e => { if (!isMuted && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={isMuted ? "🔇 Muet..." : "Message..."}
                                disabled={isMuted}
                                className="flex-1 bg-transparent text-sm placeholder-zinc-600 resize-none outline-none max-h-24 min-h-[20px]"
                                rows={1}
                            />
                            <div className="flex items-center gap-1.5 pb-0.5">
                                <button onClick={() => setShowEmoji(!showEmoji)} disabled={isMuted} className="p-1.5 rounded-lg text-zinc-500 hover:text-yellow-400"><Smile className="w-5 h-5" /></button>
                                <button onClick={() => handleSend()} disabled={!input.trim() || sending || isMuted} className="p-1.5 bg-indigo-600 text-white rounded-lg active:scale-90"><Send className="w-4 h-4" /></button>
                            </div>
                        </div>
                        {showEmoji && !isMuted && <EmojiPicker onSelect={e => setInput(p => p + e)} onClose={() => setShowEmoji(false)} />}
                    </div>
                </div>
            )}

            {!hideFloatingBubble && (!isOpen || isMinimized) ? (
                <motion.div 
                    drag
                    dragControls={dragControls}
                    dragMomentum={false}
                    initial={bubblePos}
                    className="fixed bottom-10 right-10 z-[100] flex flex-col items-end gap-3 pointer-events-auto"
                >
                    <button
                        onClick={() => { setIsOpen(true); setIsMinimized(false); setUnread(0); }}
                        className={cn(
                            "relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 text-white shadow-xl transition-all hover:scale-110 active:scale-95 group",
                            unread > 0 && "h-16 w-16"
                        )}
                    >
                        <MessageSquare className="h-6 w-6" />
                        {unread > 0 && (
                            <div className="absolute -top-2 -right-2 h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-black border-2 border-zinc-950">
                                {unread}
                            </div>
                        )}
                    </button>
                </motion.div>
            ) : null}

            <ChatPollModal isOpen={showPollModal} onClose={() => setShowPollModal(false)} onLaunch={(q, opts) => handleSend(`/vote ${q} | ${opts.join(" | ")}`)} />
            <ChatTransparencyModal open={showTransparency} onClose={() => setShowTransparency(false)} />

            {muteModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setMuteModal(null)}>
                    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                        <div className="font-black text-white">Muter {muteModal.name} ?</div>
                        <div className="grid grid-cols-4 gap-2">
                            {[300, 3600, 86400].map(s => (
                                <button key={s} onClick={() => { setMuteDuration(s); }} className={cn("py-2 rounded-xl text-[10px] font-black border", muteDuration === s ? "bg-rose-500 border-rose-400 text-white" : "bg-zinc-800 border-white/5 text-zinc-500")}>
                                    {formatMuteTime(s)}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleMuteConfirm} className="w-full py-3 bg-rose-600 text-white rounded-2xl font-black">Confirmer le mute</button>
                    </div>
                </div>
            )}
        </div>
    );
}
