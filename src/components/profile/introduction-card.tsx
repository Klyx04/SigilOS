"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Info, MessageSquare, Sparkles, Smile } from "lucide-react";
import { toast } from "sonner";
import { saveMemberIntroduction } from "@/server/actions/onboarding-admin-actions";
import { EmojiPicker } from "../editor/emoji-picker";
import { cn } from "@/lib/utils";

interface IntroductionCardProps {
    introduction?: string;
    onSave: (text: string) => void;
    readOnly?: boolean;
    guildId: string;
    displayName: string;
    targetUserId?: string;
}

export function IntroductionCard({
    introduction = "",
    onSave,
    readOnly = false,
    guildId,
    displayName,
    targetUserId
}: IntroductionCardProps) {
    const [text, setText] = useState(introduction);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const MAX_CHARS = 5000;

    const handleEmojiSelect = (emoji: string) => {
        setText(prev => prev + emoji);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await saveMemberIntroduction(guildId, text, targetUserId);
            if (res.success) {
                onSave(text);
                setIsEditing(false);
                toast.success("Présentation enregistrée !");
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        } catch (e) {
            toast.error("Erreur de communication");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isEditing && !readOnly && !introduction) {
        return (
            <Card className="p-12 bg-zinc-900/40 border-white/5 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <Sparkles className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="space-y-2 max-w-sm">
                    <h3 className="text-xl font-black text-white">Parle-nous de toi !</h3>
                    <p className="text-sm text-zinc-500">
                        Ajoute une présentation pour que les autres membres de la guilde apprennent à te connaître.
                    </p>
                </div>
                <Button
                    onClick={() => setIsEditing(true)}
                    variant="sigil-emerald"
                    size="xl"
                >
                    Commencer ma présentation
                </Button>
            </Card>
        );
    }

    return (
        <Card className="bg-zinc-950/20 backdrop-blur-sm border-white/5 space-y-4 relative overflow-hidden group hover:border-white/10 transition-all rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

            <div className="p-5 space-y-4">
                <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white tracking-tight">Ma Présentation</h3>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black opacity-60">Bio de {displayName}</p>
                        </div>
                    </div>
                    {!readOnly && !isEditing && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white h-7 px-3 rounded-lg"
                        >
                            Modifier
                        </Button>
                    )}
                </div>

                <div className="relative">
                    {isEditing ? (
                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden focus-within:border-emerald-500/30 transition-all">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/5">
                                    <div className="flex items-center gap-1">
                                        <EmojiPicker onSelect={handleEmojiSelect} />
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase ml-2">Apparence & Bio</span>
                                    </div>
                                    <div className={cn(
                                        "text-[10px] font-black tabular-nums transition-colors px-2 py-1 rounded",
                                        text.length > MAX_CHARS ? "text-rose-500 bg-rose-500/10" : "text-zinc-500 bg-black/20"
                                    )}>
                                        {text.length} / {MAX_CHARS}
                                    </div>
                                </div>
                                <Textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Partage ton histoire, tes objectifs ou tes passions..."
                                    className="bg-transparent border-none min-h-[160px] max-h-[400px] resize-y p-4 focus-visible:ring-0 text-[13px] leading-relaxed placeholder:text-zinc-700"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <p className="text-[10px] text-zinc-500 italic flex items-center gap-1.5 opacity-60">
                                    <Info className="w-3 h-3 text-emerald-500/50" />
                                    Visible par toute la guilde. Markdown supporté.
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setText(introduction || "");
                                            setIsEditing(false);
                                        }}
                                        disabled={isSaving}
                                        className="text-[11px] font-bold text-zinc-400 hover:text-white"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || text.length > MAX_CHARS}
                                        variant="sigil-emerald"
                                        className="h-9 px-5"
                                    >
                                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Enregistrer
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 rounded-2xl bg-black/40 border border-white/5 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap min-h-[80px] group-hover:bg-black/60 transition-colors">
                            {introduction ? (
                                <div className="text-[13px] text-zinc-300/90 tracking-wide font-medium italic">
                                    "{introduction}"
                                </div>
                            ) : (
                                <span className="text-zinc-600 italic text-xs">Aucune présentation enregistrée.</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Corner Accent */}
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity">
                <Sparkles className="w-20 h-20 text-white" />
            </div>
        </Card>
    );
}
