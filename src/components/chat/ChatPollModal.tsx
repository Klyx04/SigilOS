"use client";

import { useState } from "react";
import { Plus, Trash2, BarChart3, Send } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ChatPollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunch: (question: string, options: string[]) => void;
}

export function ChatPollModal({ isOpen, onClose, onLaunch }: ChatPollModalProps) {
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);

    const addOption = () => {
        if (options.length >= 8) return;
        setOptions([...options, ""]);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) return;
        setOptions(options.filter((_, i) => i !== index));
    };

    const updateOption = (index: number, val: string) => {
        const next = [...options];
        next[index] = val;
        setOptions(next);
    };

    const handleSubmit = () => {
        const cleanOptions = options.map(o => o.trim()).filter(Boolean);
        if (!question.trim() || cleanOptions.length < 2) return;
        onLaunch(question.trim(), cleanOptions);
        setQuestion("");
        setOptions(["", ""]);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md bg-zinc-900 border-white/10 p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="p-4 border-b border-white/5 bg-zinc-950/20">
                    <DialogTitle className="flex items-center gap-2 text-zinc-100 italic">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        CRÉER UN SONDAGE
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Question</label>
                        <textarea
                            autoFocus
                            placeholder="Que voulez-vous demander ?"
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/5 rounded-2xl p-4 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all resize-none"
                            rows={2}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Réponses (max 8)</label>
                        <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {options.map((opt, i) => (
                                <div key={i} className="flex gap-2 animate-in slide-in-from-left-2 duration-150" style={{ animationDelay: `${i * 50}ms` }}>
                                    <input
                                        type="text"
                                        placeholder={`Option ${i + 1}`}
                                        value={opt}
                                        onChange={e => updateOption(i, e.target.value)}
                                        className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all"
                                    />
                                    {options.length > 2 && (
                                        <button
                                            onClick={() => removeOption(i)}
                                            className="p-3 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {options.length < 8 && (
                            <button
                                onClick={addOption}
                                className="w-full py-3 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Plus className="w-3 h-3 transition-transform group-hover:rotate-90" /> Ajouter une option
                            </button>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-4 bg-zinc-950/40 border-t border-white/5 flex flex-row gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                        className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed active:scale-95"
                    >
                        <Send className="w-4 h-4" /> Lancer le sondage
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
