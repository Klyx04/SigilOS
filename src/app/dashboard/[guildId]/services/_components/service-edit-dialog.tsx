"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Swords, ScrollText, CheckSquare, MessageSquare, Gamepad2 } from "lucide-react";
import { updateServiceListing } from "@/server/actions/service-actions";
import { type ServiceListingWithProfile } from "@/server/actions/service-actions";
import { toast } from "sonner";
import Image from "next/image";
import { getAchievementIconUrl } from "@/lib/achievement-icon";

interface ServiceEditDialogProps {
    listing: ServiceListingWithProfile;
    guildId: string;
}

export function ServiceEditDialog({ listing, guildId }: ServiceEditDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [title, setTitle] = useState(listing.title);
    const [description, setDescription] = useState(listing.description || "");
    const [price, setPrice] = useState(listing.price || "");
    const [availability, setAvailability] = useState(listing.availability || "");
    // Parse existing contactMethod to checkboxes
    const existingContact = listing.contactMethod || "";
    const [contactDiscord, setContactDiscord] = useState(
        existingContact.includes("Discord") || (!existingContact.includes("En jeu") && existingContact !== "")
    );
    const [contactIngame, setContactIngame] = useState(existingContact.includes("En jeu"));

    const handleOpen = () => {
        // Reset to current values
        setTitle(listing.title);
        setDescription(listing.description || "");
        setPrice(listing.price || "");
        setAvailability(listing.availability || "");
        const c = listing.contactMethod || "";
        setContactDiscord(c.includes("Discord") || (!c.includes("En jeu") && c !== ""));
        setContactIngame(c.includes("En jeu"));
        setOpen(true);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Le titre est requis.");
            return;
        }
        setLoading(true);
        try {
            const result = await updateServiceListing(guildId, listing.id, {
                title: title.trim(),
                description: description.trim() || undefined,
                price: price.trim() || undefined,
                availability: availability.trim() || undefined,
                contactMethod: [contactDiscord && "Discord", contactIngame && "En jeu"].filter(Boolean).join(" + ") || undefined,
            });
            if (result.success) {
                toast.success("Annonce mise à jour !");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Erreur.");
            }
        } catch {
            toast.error("Erreur inattendue.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                size="icon"
                variant="ghost"
                onClick={handleOpen}
                className="h-7 w-7 text-muted-foreground hover:text-info"
                title="Modifier l'annonce"
            >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg bg-background border border-border shadow-2xl rounded-2xl text-foreground p-0 gap-0">
                    <div className="p-5 pb-4 border-b border-border bg-surface/30">
                        <DialogTitle className="text-base font-black flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-info/20 border border-info/30 flex items-center justify-center shrink-0 shadow-inner">
                                <Pencil className="w-4 h-4 text-info" strokeWidth={2.5} />
                            </div>
                            Modifier l'annonce
                        </DialogTitle>
                    </div>

                    <div className="p-6 space-y-5">

                        {/* Contexte en lecture seule — donjon / succès / quête (uniquement pour les catégories concernées) */}
                        {((listing.category === "PASSAGE_DONJON" && listing.dungeonName) || (listing.category === "QUETE" && listing.questName)) && (
                            <div className="rounded-lg border border-white/8 bg-surface p-3 space-y-2">
                                {listing.dungeonName && (
                                    <div className="flex items-center gap-2">
                                        {listing.dungeonImageUrl ? (
                                            <div className="relative h-8 w-8 rounded-lg shrink-0 overflow-hidden border border-info/20 shadow-inner">
                                                <Image src={listing.dungeonImageUrl} alt={listing.dungeonName} fill className="object-cover" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-lg shrink-0 bg-info/10 flex items-center justify-center border border-info/20 shadow-inner">
                                                <Swords className="h-4 w-4 text-info" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-info">{listing.dungeonName}</p>
                                            <p className="text-caption text-muted-foreground">Donjon sélectionné</p>
                                        </div>
                                    </div>
                                )}
                                {listing.selectedAchievementNames && (listing.selectedAchievementNames as string[]).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-2">
                                        {(listing.selectedAchievementNames as string[]).map((name) => {
                                            const slug = name.toLowerCase()
                                                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                                .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                                            const iconUrl = getAchievementIconUrl(slug);
                                            return (
                                                <span key={name} className="flex items-center gap-1.5 text-caption px-2 py-1 rounded-lg bg-info/10 border border-info/20 text-info font-bold">
                                                    {iconUrl && (
                                                        <div className="relative h-4 w-4 shrink-0">
                                                            <Image
                                                                src={iconUrl}
                                                                alt={name}
                                                                fill
                                                                className="object-contain"
                                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                                            />
                                                        </div>
                                                    )}
                                                    {name}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                {listing.category === "QUETE" && listing.questName && (
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded shrink-0 bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                            <ScrollText className="h-4 w-4 text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-violet-300">{listing.questName}</p>
                                            <p className="text-caption text-muted-foreground">Quête sélectionnée</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {listing.category !== "PASSAGE_DONJON" && (
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Titre *</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-surface border-border"
                                    maxLength={100}
                                />
                            </div>
                        )}



                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Tarif</Label>
                                <Input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="bg-surface border-border"
                                    placeholder="Ex: 500k kamas"
                                    maxLength={100}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Disponibilité</Label>
                                <Input
                                    value={availability}
                                    onChange={(e) => setAvailability(e.target.value)}
                                    className="bg-surface border-border"
                                    placeholder="Ex: Soir / WE"
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Remarque / Détails</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: dispo en soirée, contactez-moi avant, etc."
                                className="bg-surface border-border text-sm resize-none h-20"
                                maxLength={2000}
                            />
                        </div>

                        {/* Contact — checkboxes */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Contact préféré</Label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setContactDiscord(v => !v)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${contactDiscord
                                        ? "border-info/60 bg-info/15 text-info"
                                        : "border-border bg-surface text-muted-foreground hover:border-border-strong"
                                        }`}
                                >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Ping Discord
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setContactIngame(v => !v)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${contactIngame
                                        ? "border-info/60 bg-info/15 text-info"
                                        : "border-border bg-surface text-muted-foreground hover:border-border-strong"
                                        }`}
                                >
                                    <Gamepad2 className="h-3.5 w-3.5" />
                                    Ping en jeu
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-6 flex gap-3 border-t border-border pt-5 bg-surface/30">
                        <Button
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="flex-1 border border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold h-12 transition-all"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading || !title.trim()}
                            className="flex-1 bg-info hover:bg-info text-info-foreground font-black h-12 shadow-md shadow-cyan-900/20"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
