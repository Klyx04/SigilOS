import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Send } from "lucide-react";

interface ChatPanelProps {
    socket: Socket;
    messages: any[];
    gameState: any;
    isDrawer: boolean;
    isSpectator?: boolean;
}

export default function ChatPanel({ socket, messages, gameState, isDrawer, isSpectator }: ChatPanelProps) {
    const [input, setInput] = useState("");
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSpectator) return;
        socket.emit("skribbl:chat:guess", { text: input });
        setInput("");
    };

    const getPlaceholder = () => {
        if (isSpectator) return "MODE SPECTATEUR...";
        if (isDrawer) return "VOUS DESSINEZ...";
        return "REPONSE...";
    };

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {/* Chat Header */}
            <div className="px-4 md:px-6 py-2.5 md:py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">COMMUNICATIONS</span>
                <div className="flex items-center gap-1.5 bg-[#5d3fd3]/10 px-2 py-0.5 md:py-1 rounded-lg">
                    <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-[#5d3fd3] rounded-full animate-pulse" />
                    <span className="text-[6px] md:text-[8px] font-black text-[#5d3fd3] uppercase italic">LIVE</span>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 custom-scrollbar">
                {messages.map((msg, i) => {
                    if (msg.type === "system") {
                         return (
                            <div key={i} className="flex justify-center my-1 md:my-2">
                                <div className="bg-slate-100 px-3 md:px-4 py-1 rounded-full border border-slate-200">
                                    <span className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase italic tracking-tighter">
                                        {msg.text}
                                    </span>
                                </div>
                            </div>
                         );
                    }

                    if (msg.type === "success") {
                        return (
                            <div key={i} className="flex flex-col items-center gap-1 my-2 md:my-4 animate-in zoom-in-95 duration-300">
                                <div className="bg-emerald-500 text-white px-4 md:px-6 py-1.5 md:py-2.5 rounded-xl md:rounded-[1.5rem] shadow-xl shadow-emerald-500/20 border-b-2 md:border-b-4 border-emerald-700">
                                    <span className="font-black text-[10px] md:text-xs uppercase italic tracking-tighter text-center">{msg.text}</span>
                                </div>
                            </div>
                        );
                    }

                    if (msg.type === "warning") {
                        return (
                            <div key={i} className="flex justify-center my-1 md:my-2">
                                <div className="bg-amber-100 px-3 md:px-4 py-1 rounded-full border border-amber-200">
                                    <span className="text-[8px] md:text-[10px] font-black text-amber-700 uppercase italic tracking-tighter">
                                        {msg.text}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={i} className="flex flex-col gap-0.5 md:gap-1 items-start group">
                            <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-1.5 md:ml-3">
                                {msg.sender}
                            </span>
                            <div className="bg-slate-50 border border-slate-200 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-[1.5rem] rounded-tl-none shadow-sm group-hover:bg-white group-hover:shadow-md transition-all">
                                <span className="text-xs md:text-sm font-bold text-slate-800 leading-relaxed break-words">
                                    {msg.text}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <div className="p-2 md:p-4 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 shrink-0">
                <form onSubmit={handleSubmit} className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={getPlaceholder()}
                        disabled={isDrawer || isSpectator}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl md:rounded-[1.5rem] px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black text-slate-800 uppercase italic tracking-tighter focus:outline-none focus:border-[#5d3fd3] focus:ring-4 focus:ring-[#5d3fd3]/10 disabled:opacity-50 disabled:bg-slate-100 transition-all shadow-lg placeholder:text-slate-300"
                        autoComplete="off"
                        maxLength={100}
                    />
                    {!isDrawer && !isSpectator && (
                        <button 
                            type="submit"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-[#5d3fd3] text-white rounded-lg md:rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                        >
                            <Send className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={3} />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
