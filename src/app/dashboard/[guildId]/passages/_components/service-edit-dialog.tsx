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
                className="h-7 w-7 text-zinc-500 hover:text-cyan-400"
                title="Modifier l'annonce"
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-cyan-400" />
                            Modifier l&apos;annonce
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">

                        {/* Contexte en lecture seule — donjon / succès / quête */}
                        {(listing.dungeonName || listing.questName) && (
                            <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 space-y-2">
                                {listing.dungeonName && (
                                    <div className="flex items-center gap-2">
                                        {listing.dungeonImageUrl ? (
                                            <div className="relative h-8 w-8 rounded shrink-0 overflow-hidden border border-cyan-500/20">
                                                <Image src={listing.dungeonImageUrl} alt={listing.dungeonName} fill className="object-cover" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded shrink-0 bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                                                <Swords className="h-4 w-4 text-cyan-400" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-cyan-300">{listing.dungeonName}</p>
                                            <p className="text-[10px] text-zinc-500">Donjon sélectionné</p>
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
                                                <span key={name} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
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
                                {listing.questName && (
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded shrink-0 bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                            <ScrollText className="h-4 w-4 text-violet-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-violet-300">{listing.questName}</p>
                                            <p className="text-[10px] text-zinc-500">Quête sélectionnée</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Titre *</Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-white/5 border-white/10"
                                maxLength={100}
                            />
                        </div>



                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Tarif</Label>
                                <Input
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                    placeholder="Ex: 500k kamas"
                                    maxLength={100}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Disponibilité</Label>
                                <Input
                                    value={availability}
                                    onChange={(e) => setAvailability(e.target.value)}
                                    className="bg-white/5 border-white/10"
                                    placeholder="Ex: Soir / WE"
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        {/* Contact — checkboxes */}
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Contact préféré</Label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setContactDiscord(v => !v)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${contactDiscord
                                        ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                                        : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                        }`}
                                >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Ping Discord
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setContactIngame(v => !v)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${contactIngame
                                        ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-300"
                                        : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20"
                                        }`}
                                >
                                    <Gamepad2 className="h-3.5 w-3.5" />
                                    Ping en jeu
                                </button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading || !title.trim()}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
