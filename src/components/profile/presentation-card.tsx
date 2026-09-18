"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Save, Loader2, Check, Pencil } from "lucide-react";
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
            <Card className="p-8 border-border rounded-xl flex flex-col items-center text-center space-y-4">
                <div className="flex items-center gap-4 w-full text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/dofus/modules/character.png"
                        alt=""
                        width={48}
                        height={48}
                        draggable={false}
                        className="w-12 h-12 shrink-0 object-contain"
                    />
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">Complétez votre présentation</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Activités préférées, objectifs et contact Discord pour que vos camarades de guilde vous connaissent.
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => setIsEditing(true)}
                    className="h-10 px-5 text-sm font-medium rounded-lg"
                >
                    Remplir ma fiche de présentation
                </Button>
            </Card>
        );
    }

    return (
        <Card className="border-border rounded-xl p-6 space-y-6">
            {/* Header section */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/dofus/modules/character.png"
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        draggable={false}
                        className="w-8 h-8 shrink-0 object-contain"
                    />
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Présentation et profil membre</h3>
                        <p className="text-xs text-muted-foreground">Fiche de {displayName}</p>
                    </div>
                </div>
                {!readOnly && !isEditing && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg"
                    >
                        <Pencil className="w-3 h-3 mr-1.5" />
                        Modifier
                    </Button>
                )}
            </div>

            {/* Content Body */}
            {isEditing ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Badges d'activités préférées */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Activités et contenu préféré
                        </label>
                        <p className="text-xs text-muted-foreground">Cochez ce que vous aimez faire pour indiquer vos préférences à la guilde :</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {PREFERRED_ACTIVITIES.map(act => {
                                const active = selectedActivities.includes(act.id);
                                return (
                                    <button
                                        key={act.id}
                                        type="button"
                                        onClick={() => toggleActivity(act.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            "flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer select-none",
                                            active
                                                ? "border-success bg-success/5 text-foreground"
                                                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                                        )}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={act.image}
                                            alt=""
                                            width={28}
                                            height={28}
                                            loading="lazy"
                                            draggable={false}
                                            className="w-7 h-7 shrink-0 object-contain"
                                        />
                                        <span>{act.label}</span>
                                        {active && <Check className="w-3.5 h-3.5 text-success shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Objectifs recherchés */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Objectifs recherchés
                        </label>
                        <Input
                            value={objectifsText}
                            onChange={(e) => setObjectifsText(e.target.value)}
                            placeholder="Ex : Monter un groupe Songes 400, rush le Dofus Sylvestre, optimiser mon stuff..."
                            className="bg-elevated border-border text-xs text-foreground placeholder:text-muted-foreground h-10 rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                        />
                    </div>

                    {/* Contact Discord / MP */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Contact Discord / Disponibilité MP
                        </label>
                        <Input
                            value={contactText}
                            onChange={(e) => setContactText(e.target.value)}
                            placeholder="Ex : Dispo en MP le soir à partir de 20h / @MonPseudoDiscord"
                            className="bg-elevated border-border text-xs text-foreground placeholder:text-muted-foreground h-10 rounded-lg focus-visible:ring-0 focus-visible:border-border-strong"
                        />
                    </div>

                    {/* Bio / Présentation générale */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">
                                Note de présentation
                            </label>
                            <EmojiPicker onSelect={handleEmojiSelect} />
                        </div>
                        <div className="rounded-lg border border-border bg-elevated overflow-hidden focus-within:border-border-strong transition-colors">
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
                        <p className="text-xs text-muted-foreground">
                            Ces informations seront visibles par les membres de la guilde.
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
                                className="text-xs text-muted-foreground hover:text-foreground rounded-lg"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || introText.length > MAX_CHARS}
                                className="h-9 px-5 text-sm font-medium rounded-lg"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Preferred activity badges */}
                    {selectedActivities.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground">
                                Activités appréciées
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {selectedActivities.map(actId => {
                                    const act = PREFERRED_ACTIVITIES.find(a => a.id === actId);
                                    if (!act) return null;
                                    return (
                                        <span
                                            key={actId}
                                            className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg text-xs text-foreground border border-border"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={act.image}
                                                alt=""
                                                width={24}
                                                height={24}
                                                loading="lazy"
                                                draggable={false}
                                                className="w-6 h-6 shrink-0 object-contain"
                                            />
                                            <span>{act.label}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Objectifs recherchés */}
                    {objectifsText && (
                        <div className="rounded-lg border border-border p-4 space-y-1">
                            <h4 className="text-xs font-medium text-muted-foreground">
                                Objectifs actuels
                            </h4>
                            <p className="text-xs text-foreground leading-relaxed">
                                {objectifsText}
                            </p>
                        </div>
                    )}

                    {/* Discord / MP Contact */}
                    {contactText && (
                        <div className="rounded-lg border border-border p-4 space-y-1">
                            <h4 className="text-xs font-medium text-muted-foreground">
                                Contact MP et Discord
                            </h4>
                            <p className="text-xs text-foreground leading-relaxed">
                                {contactText}
                            </p>
                        </div>
                    )}

                    {/* Note de Présentation */}
                    {introText ? (
                        <div className="rounded-lg border border-border p-4 space-y-1">
                            <h4 className="text-xs font-medium text-muted-foreground">
                                Bio / À propos
                            </h4>
                            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                &ldquo;{introText}&rdquo;
                            </p>
                        </div>
                    ) : !selectedActivities.length && !objectifsText && !contactText && (
                        <p className="text-xs text-muted-foreground">Aucune présentation enregistrée.</p>
                    )}
                </div>
            )}
        </Card>
    );
}
