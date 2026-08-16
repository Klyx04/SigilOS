"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Save, Loader2, Info, MessageSquare, Sparkles, Target, Compass, MessageCircle, Check, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { updateUserProfile } from "@/server/actions/profile-actions";
import { EmojiPicker } from "../editor/emoji-picker";
import { cn } from "@/lib/utils";
import { PREFERRED_ACTIVITIES, type PreferredActivityId } from "@/lib/profile-activities";



interface PresentationCardProps {
    introduction?: string | null;
    objectifs?: string | null;
    preferredActivities?: string[] | null;
    discordContact?: string | null;
    onSave?: (data: { introduction: string; objectifs: string; preferredActivities: string[]; discordContact: string }) => void;
    readOnly?: boolean;
    guildId: string;
    displayName: string;
    targetUserId?: string;
}

export function PresentationCard({
    introduction = "",
    objectifs = "",
    preferredActivities = [],
    discordContact = "",
    onSave,
    readOnly = false,
    guildId,
    displayName,
    targetUserId,
}: PresentationCardProps) {
    const [introText, setIntroText] = useState(introduction || "");
    const [objectifsText, setObjectifsText] = useState(objectifs || "");
    const [selectedActivities, setSelectedActivities] = useState<string[]>(preferredActivities || []);
    const [contactText, setContactText] = useState(discordContact || "");

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const MAX_CHARS = 2000;

    const toggleActivity = (id: string) => {
        setSelectedActivities(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleEmojiSelect = (emoji: string) => {
        setIntroText(prev => prev + emoji);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await updateUserProfile({
                guildId,
                introduction: introText,
                objectifs: objectifsText,
                preferredActivities: selectedActivities as PreferredActivityId[],
                discordContact: contactText,
                targetUserId,
            });

            if (res.success) {
                if (onSave) {
                    onSave({
                        introduction: introText,
                        objectifs: objectifsText,
                        preferredActivities: selectedActivities,
                        discordContact: contactText,
                    });
                }
                setIsEditing(false);
                toast.success("Présentation mise à jour !");
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setIsSaving(false);
        }
    };

    const hasAnyContent = Boolean(
        (introduction && introduction.trim().length > 0) ||
        (objectifs && objectifs.trim().length > 0) ||
        (preferredActivities && preferredActivities.length > 0) ||
        (discordContact && discordContact.trim().length > 0)
    );

    if (!isEditing && !readOnly && !hasAnyContent) {
        return (
            <Card className="p-10 bg-background/60 border border-success/20 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden group">
                <div className="w-16 h-16 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-center group- transition-transform duration-300 shadow-lg shadow-emerald-500/10">
                    <Sparkles className="w-8 h-8 text-success" />
                </div>
                <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-black text-foreground uppercase tracking-wide">Complétez votre présentation</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                        Renseignez vos activités préférées (*PvM, Succès, Songes...*), vos objectifs et votre contact Discord pour que vos camarades de guilde vous connaissent.
                    </p>
                </div>
                <Button
                    onClick={() => setIsEditing(true)}
                    variant="sigil-emerald"
                    className="h-11 px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                >
                    Remplir ma fiche de présentation
                </Button>
            </Card>
        );
    }

    return (
        <Card className="bg-background/60 backdrop-blur-md border border-border space-y-6 relative overflow-hidden rounded-3xl p-6 shadow-2xl">
            {/* Header section */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-foreground uppercase tracking-wider">Présentation & Profil Membre</h3>
                        <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Fiche de {displayName}</p>
                    </div>
                </div>
                {!readOnly && !isEditing && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="text-caption font-black uppercase tracking-widest text-muted-foreground hover:text-foreground bg-surface border border-border hover:border-border-strong h-8 px-3 rounded-xl transition-all"
                    >
                        <Pencil className="w-3 h-3 mr-1.5 text-sky-400" />
                        Modifier
                    </Button>
                )}
            </div>

            {/* Content Body */}
            {isEditing ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Badges d'activités préférées */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
                            <Compass className="w-4 h-4" />
                            Activités & Contenu préféré
                        </label>
                        <p className="text-caption text-muted-foreground">Cochez ce que vous aimez faire pour indiquer vos préférences à la guilde :</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {PREFERRED_ACTIVITIES.map(act => {
                                const active = selectedActivities.includes(act.id);
                                return (
                                    <button
                                        key={act.id}
                                        type="button"
                                        onClick={() => toggleActivity(act.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none",
                                            active
                                                ? `${act.color} ring-1 ring-white/20 shadow-md`
                                                : "bg-surface/60 border-border text-muted-foreground hover:border-border hover:text-foreground"
                                        )}
                                    >
                                        <span>{act.icon}</span>
                                        <span>{act.label}</span>
                                        {active && <Check className="w-3.5 h-3.5 ml-1 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Objectifs recherchés */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-warning flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Objectifs recherchés
                        </label>
                        <Input
                            value={objectifsText}
                            onChange={(e) => setObjectifsText(e.target.value)}
                            placeholder="Ex : Monter un groupe Songes 400, rush le Dofus Sylvestre, optimiser mon stuff..."
                            className="bg-black/40 border-border text-xs text-foreground placeholder:text-muted-foreground h-10 rounded-xl focus-visible:ring-success/30"
                        />
                    </div>

                    {/* Contact Discord / MP */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-success flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            Contact Discord / Disponibilité MP
                        </label>
                        <Input
                            value={contactText}
                            onChange={(e) => setContactText(e.target.value)}
                            placeholder="Ex : Dispo en MP le soir à partir de 20h / @MonPseudoDiscord"
                            className="bg-black/40 border-border text-xs text-foreground placeholder:text-muted-foreground h-10 rounded-xl focus-visible:ring-success/30"
                        />
                    </div>

                    {/* Bio / Présentation générale */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-sky-400" />
                                Note de Présentation
                            </label>
                            <EmojiPicker onSelect={handleEmojiSelect} />
                        </div>
                        <div className="relative rounded-2xl border border-border bg-black/40 overflow-hidden focus-within:border-sky-500/30 transition-all">
                            <Textarea
                                value={introText}
                                onChange={(e) => setIntroText(e.target.value)}
                                placeholder="Racontez votre parcours sur Dofus, votre guilde précédente, vos horaires..."
                                className="bg-transparent border-none min-h-[140px] max-h-[300px] resize-y p-4 focus-visible:ring-0 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-caption text-muted-foreground italic opacity-60">
                            Sauvegarde instantanée. Ces informations seront visibles par les membres de la guilde.
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIntroText(introduction || "");
                                    setObjectifsText(objectifs || "");
                                    setSelectedActivities(preferredActivities || []);
                                    setContactText(discordContact || "");
                                    setIsEditing(false);
                                }}
                                disabled={isSaving}
                                className="text-xs font-bold text-muted-foreground hover:text-foreground"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || introText.length > MAX_CHARS}
                                variant="sigil-emerald"
                                className="h-9 px-5 text-xs font-black uppercase tracking-wider"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Preferred activity badges */}
                    {selectedActivities.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5 text-sky-400" /> Activités appréciées
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {selectedActivities.map(actId => {
                                    const act = PREFERRED_ACTIVITIES.find(a => a.id === actId);
                                    if (!act) return null;
                                    return (
                                        <span
                                            key={actId}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm",
                                                act.color
                                            )}
                                        >
                                            <span>{act.icon}</span>
                                            <span>{act.label}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Objectifs recherchés */}
                    {objectifsText && (
                        <div className="p-4 rounded-2xl bg-warning/[0.06] border border-warning/20 space-y-1">
                            <h4 className="text-caption font-black uppercase tracking-widest text-warning flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5" /> Objectifs actuels
                            </h4>
                            <p className="text-xs text-warning/90 font-medium leading-relaxed">
                                {objectifsText}
                            </p>
                        </div>
                    )}

                    {/* Discord / MP Contact */}
                    {contactText && (
                        <div className="p-4 rounded-2xl bg-success/[0.06] border border-success/20 space-y-1">
                            <h4 className="text-caption font-black uppercase tracking-widest text-success flex items-center gap-1.5">
                                <MessageCircle className="w-3.5 h-3.5" /> Contact MP & Discord
                            </h4>
                            <p className="text-xs text-success/90 font-medium leading-relaxed">
                                {contactText}
                            </p>
                        </div>
                    )}

                    {/* Note de Présentation */}
                    {introText ? (
                        <div className="p-5 rounded-2xl bg-black/40 border border-border space-y-2">
                            <h4 className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-sky-400" /> Bio / À propos
                            </h4>
                            <p className="text-xs text-foreground leading-relaxed font-medium italic whitespace-pre-wrap">
                                &ldquo;{introText}&rdquo;
                            </p>
                        </div>
                    ) : !selectedActivities.length && !objectifsText && !contactText && (
                        <p className="text-xs text-muted-foreground italic">Aucune présentation enregistrée.</p>
                    )}
                </div>
            )}
        </Card>
    );
}
