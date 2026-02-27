"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Info, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { saveMemberIntroduction } from "@/server/actions/onboarding-admin-actions";

interface IntroductionCardProps {
    introduction?: string;
    onSave: (text: string) => void;
    readOnly?: boolean;
    guildId: string;
    displayName: string;
}

export function IntroductionCard({
    introduction = "",
    onSave,
    readOnly = false,
    guildId,
    displayName
}: IntroductionCardProps) {
    const [text, setText] = useState(introduction);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await saveMemberIntroduction(guildId, text);
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
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-6 h-auto rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                    Commencer ma présentation
                </Button>
            </Card>
        );
    }

    return (
        <Card className="p-6 bg-zinc-900/40 border-white/5 space-y-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

            <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Présentation</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Bio & Intro de {displayName}</p>
                    </div>
                </div>
                {!readOnly && !isEditing && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="border-white/10 hover:bg-white/5 h-8 text-xs font-bold"
                    >
                        Éditer
                    </Button>
                )}
            </div>

            <div className="relative">
                {isEditing ? (
                    <div className="space-y-4">
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Écris quelque chose sur toi, tes objectifs dans Dofus, tes passions..."
                            className="bg-zinc-950 border-white/10 min-h-[200px] resize-none focus:ring-emerald-500/50 transition-all text-sm leading-relaxed"
                        />
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-zinc-600 flex items-center gap-1">
                                <Info className="w-3 h-3" /> Ta présentation sera visible par tous les membres.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setText(introduction);
                                        setIsEditing(false);
                                    }}
                                    disabled={isSaving}
                                    className="text-zinc-500 hover:text-white"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Enregistrer
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 rounded-2xl bg-black/40 border border-white/5 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
                        {introduction || <span className="text-zinc-600 italic">Aucune présentation pour le moment.</span>}
                    </div>
                )}
            </div>

            {/* Decoration */}
            <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <Sparkles className="w-24 h-24 text-white" />
            </div>
        </Card>
    );
}
