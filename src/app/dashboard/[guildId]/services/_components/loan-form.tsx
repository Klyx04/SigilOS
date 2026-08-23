"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, X, UserSearch, Handshake, Send, AlertTriangle } from "lucide-react";
import { createLoan } from "@/server/actions/loan-actions";
import { LOAN_TYPE_LABELS } from "@/server/actions/services-constants";
import { LoanType } from "@prisma/client";
import { toast } from "sonner";
import Image from "next/image";
import { MemberSearchModal } from "./member-search-modal";
import { DofusItemSearch } from "./dofus-item-search";
import type { DofusItem } from "@/lib/dofusdude-client";

type MemberOption = { id: string; name: string; subtitle?: string; image?: string | null };

interface LoanFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    currentProfileId?: string;
    isDiscordConfigured?: boolean;
    // #71 — prévisu du salon cible (nom du canal prêts)
    channelName?: string | null;
}

const TYPES = Object.entries(LOAN_TYPE_LABELS) as [LoanType, string][];

export function LoanForm({ open, onOpenChange, guildId, currentProfileId, isDiscordConfigured = false, channelName = null }: LoanFormProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<LoanType>("KAMAS");
    const [borrower, setBorrower] = useState<MemberOption | null>(null);
    const [borrowerModalOpen, setBorrowerModalOpen] = useState(false);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [resourceQty, setResourceQty] = useState("");
    const [dueDate, setDueDate] = useState("");
    // #71 — option « pas d'échéance » (prêt ouvert indéfiniment)
    const [noDueDate, setNoDueDate] = useState(false);
    const [notes, setNotes] = useState("");
    const [linkedItem, setLinkedItem] = useState<DofusItem | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [nsfwChecking, setNsfwChecking] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [notifyDiscord, setNotifyDiscord] = useState(false);

    // Pré-charge le modèle NSFWJS dès l'ouverture → le 1er collage est instantané
    useEffect(() => {
        if (!open) return;
        import("@/lib/safety-client").then(({ warmUpSafetyModel }) => warmUpSafetyModel()).catch(() => {});
    }, [open]);

    useEffect(() => {
        if (open) {
            setNotifyDiscord(!!isDiscordConfigured);
        }
    }, [open, isDiscordConfigured]);

    const resetForm = () => {
        setType("KAMAS");
        setBorrower(null);
        setDescription("");
        setAmount("");
        setResourceQty("");
        setDueDate("");
        setNotes("");
        setLinkedItem(null);
        setProofFile(null);
        setProofPreview(null);
        setNotifyDiscord(!!isDiscordConfigured);
    };

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) { 
            toast.error("Seules les images sont acceptées."); 
            return; 
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Fichier trop volumineux (max 5MB).");
            return;
        }

        // 1. Aperçu IMMÉDIAT — pas d'attente invisible (le filtre tourne en arrière-plan)
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
        setNsfwChecking(true);

        // 2. 🛡️ NSFW Safety Check (non bloquant pour l'UX, borné 6s côté client)
        const { analyzeImageSafety, logNsfwAttempt } = await import("@/lib/safety-client");
        const safety = await analyzeImageSafety(file);
        setNsfwChecking(false);

        if (!safety.isSafe) {
            setProofFile(null);
            setProofPreview(null);
            toast.error(safety.reason || "Contenu inapproprié détecté. L'image a été bloquée.");
            // 🔐 Log tentatives NSFW côté guilde (audit) + côté God (notification)
            await logNsfwAttempt(guildId, `Upload NSFW bloqué (fichier: ${file.name}).`);
            return;
        }
        if (safety.warning) {
            toast.warning(safety.warning);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!open) return;

        const handlePaste = (e: ClipboardEvent) => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith("image/")) {
                    e.preventDefault();
                    processFile(file);
                    toast.info("Image collée depuis le presse-papier ! 📋");
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [open]);

    const handleSubmit = async () => {
        if (!borrower || !description.trim()) {
            toast.error("Emprunteur et description requis.");
            return;
        }

        setLoading(true);
        try {
            let proofFormData: FormData | undefined;
            if (proofFile) {
                proofFormData = new FormData();
                proofFormData.set("file", proofFile);
            }

            const result = await createLoan(
                guildId,
                {
                    borrowerProfileId: borrower.id,
                    type,
                    description: description.trim(),
                    amount: amount.trim() || null,
                    dueDate: dueDate || null,
                    notes: notes.trim() || null,
                    linkedItemName: linkedItem?.name || null,
                    linkedItemIconUrl: linkedItem?.iconUrl || null,
                    notifyDiscord,
                },
                proofFormData
            );

            if (result.success) {
                toast.success("Prêt enregistré !");
                resetForm();
                onOpenChange(false);
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

    if (!open) return null;

    return (
        <>
            <MemberSearchModal
                open={borrowerModalOpen}
                onOpenChange={setBorrowerModalOpen}
                guildId={guildId}
                onSelect={(m) => setBorrower(m)}
                excludeIds={currentProfileId ? [currentProfileId] : []}
                title="Sélectionner l'emprunteur"
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

                {/* Panel */}
                <div className="relative z-10 w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-warning/10 to-transparent">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl border border-warning/40 bg-warning/15 text-warning">
                                    <Handshake className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-foreground">Nouveau prêt</h2>
                                    <p className="text-xs text-muted-foreground">Enregistrer un prêt entre membres</p>
                                </div>
                            </div>
                            <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body scrollable */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                        {/* Type + Emprunteur */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Type</Label>
                                <Select value={type} onValueChange={(v) => setType(v as LoanType)}>
                                    <SelectTrigger className="bg-surface border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-border">
                                        {TYPES.map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Emprunteur *</Label>
                                <button
                                    type="button"
                                    onClick={() => setBorrowerModalOpen(true)}
                                    className="w-full h-9 px-3 rounded-md border border-border bg-surface flex items-center gap-2 text-sm hover:border-warning/30 transition-colors text-left"
                                >
                                    {borrower ? (
                                        <>
                                            <Avatar className="h-5 w-5 rounded-md">
                                                <AvatarImage src={borrower.image || undefined} />
                                                <AvatarFallback className="text-caption bg-elevated">{borrower.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-bold text-foreground truncate">{borrower.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserSearch className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">Rechercher...</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Description *</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: 2M kamas pour stuff Cra"
                                className="bg-surface border-border"
                                maxLength={200}
                            />
                        </div>

                        {/* Montant + Échéance */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Montant / Qté</Label>
                                <Input
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Ex: 2 000 000 kamas"
                                    className="bg-surface border-border"
                                    maxLength={100}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Échéance</Label>
                                <div className="space-y-2">
                                    <Input
                                        type="date"
                                        value={noDueDate ? "" : dueDate}
                                        onChange={(e) => { setNoDueDate(false); setDueDate(e.target.value); }}
                                        disabled={noDueDate}
                                        className="bg-surface border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert disabled:opacity-40"
                                    />
                                    {/* #71 — option « pas d'échéance » */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={noDueDate}
                                            onChange={(e) => { setNoDueDate(e.target.checked); if (e.target.checked) setDueDate(""); }}
                                            className="h-3.5 w-3.5 rounded border-border-strong bg-surface accent-warning"
                                        />
                                        <span className="text-caption text-muted-foreground font-medium">Pas d'échéance (prêt ouvert)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Item lié (STUFF / RESSOURCES) */}
                        {(type === "STUFF" || type === "RESSOURCES") && (
                            <div className="space-y-3 rounded-xl border border-white/8 bg-surface p-3">
                                <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                    Item lié <span className="text-muted-foreground font-normal">(optionnel)</span>
                                </Label>
                                <DofusItemSearch
                                    category={type === "RESSOURCES" ? "resources" : "equipment"}
                                    onSelect={setLinkedItem}
                                    value={linkedItem}
                                    onClear={() => setLinkedItem(null)}
                                    placeholder={type === "RESSOURCES" ? "Ex: Bois de Frêne, Fer..." : "Ex: Gelano, Turquoise de Rêve..."}
                                />
                                {linkedItem && (
                                    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                                        {linkedItem.iconUrl && (
                                            <div className="relative h-10 w-10 shrink-0">
                                                <Image src={linkedItem.iconUrl} alt={linkedItem.name} fill className="object-contain" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-black text-foreground">{linkedItem.name}</p>
                                            <p className="text-caption text-muted-foreground">Item sélectionné</p>
                                        </div>
                                    </div>
                                )}
                                {type === "RESSOURCES" && (
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                            Quantité <span className="text-muted-foreground font-normal">(1 – 100 000)</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={100000}
                                            value={resourceQty}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value);
                                                if (isNaN(v)) setResourceQty("");
                                                else setResourceQty(String(Math.min(100000, Math.max(1, v))));
                                            }}
                                            placeholder="Ex: 500"
                                            className="bg-surface border-border w-36"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Notes <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Détails supplémentaires..."
                                className="bg-surface border-border min-h-[60px] resize-none"
                                maxLength={1000}
                            />
                        </div>

                        {/* Proof Upload */}
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Screenshot preuve</Label>
                            {proofPreview ? (
                                <div className="relative h-48 rounded-xl overflow-hidden border border-border">
                                    <Image src={proofPreview} alt="Preuve" fill className="object-cover" />
                                    {nsfwChecking && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin text-warning" />
                                            <span className="text-caption font-black text-foreground uppercase tracking-widest">Analyse sécurité…</span>
                                        </div>
                                    )}
                                    <Button size="icon" variant="ghost" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute top-2 right-2 h-7 w-7 bg-muted/60 hover:bg-muted/80 text-foreground">
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-200 ${isDragging ? "border-warning/60 bg-warning/5 text-warning" : "border-border hover:border-warning/30 hover:text-warning text-muted-foreground"}`}
                                >
                                    <Upload className="h-5 w-5" />
                                    <p className="text-xs font-medium">
                                        {isDragging ? "Relâcher pour ajouter" : (
                                            <>
                                                Glisser-déposer, coller ou <button type="button" onClick={() => fileInputRef.current?.click()} className="text-warning hover:text-warning underline font-black">cliquer</button>
                                            </>
                                        )}
                                    </p>
                                    <p className="text-caption text-muted-foreground">PNG, JPEG, WebP — max 5MB</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
                        </div>

                        {/* Notif Discord */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${notifyDiscord && isDiscordConfigured ? 'bg-info/10 border-info/30' : 'bg-surface border-border'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Send className={`h-4 w-4 ${notifyDiscord && isDiscordConfigured ? 'text-info' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className={`text-xs font-bold ${notifyDiscord && isDiscordConfigured ? 'text-info' : 'text-foreground'}`}>Notifier sur Discord</p>
                                        <p className="text-caption text-muted-foreground">
                                            {channelName
                                                ? <>Envoyer un embed dans <span className="text-info font-bold">#{channelName}</span></>
                                                : "Envoyer un embed dans le salon prêts"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={!isDiscordConfigured}
                                    onClick={() => setNotifyDiscord(v => !v)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notifyDiscord && isDiscordConfigured ? "bg-info" : "bg-muted"} ${!isDiscordConfigured ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${notifyDiscord && isDiscordConfigured ? "translate-x-4" : "translate-x-1"}`} />
                                </button>
                            </div>

                            {!isDiscordConfigured && (
                                <div className="mt-3 p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                                    <p className="text-caption text-warning/70 font-bold uppercase tracking-wider">
                                        Le salon Discord n&apos;est pas configuré. Les notifications sont désactivées.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                        <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                            Annuler
                        </button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !borrower || !description.trim()}
                            className="bg-warning hover:bg-warning text-warning-foreground font-black px-6"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🤝 Enregistrer le prêt"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
