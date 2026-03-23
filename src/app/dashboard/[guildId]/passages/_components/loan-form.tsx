"use client";

import { useState, useRef, useCallback } from "react";
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
import { Loader2, Upload, X, UserSearch, Handshake, Send } from "lucide-react";
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
}

const TYPES = Object.entries(LOAN_TYPE_LABELS) as [LoanType, string][];

export function LoanForm({ open, onOpenChange, guildId, currentProfileId }: LoanFormProps) {
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
    const [notes, setNotes] = useState("");
    const [linkedItem, setLinkedItem] = useState<DofusItem | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [notifyDiscord, setNotifyDiscord] = useState(false);

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
        setNotifyDiscord(false);
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

        // 🛡️ NSFW Safety Check
        const { analyzeImageSafety } = await import("@/lib/safety-client");
        const safety = await analyzeImageSafety(file);
        if (!safety.isSafe) {
            toast.error(safety.reason || "Contenu inapproprié détecté. L'image a été bloquée.");
            return;
        }

        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
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
                <div className="relative z-10 w-full max-w-lg bg-zinc-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-white/5 bg-gradient-to-r from-amber-500/10 to-transparent">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400">
                                    <Handshake className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white">Nouveau prêt</h2>
                                    <p className="text-xs text-zinc-500">Enregistrer un prêt entre membres</p>
                                </div>
                            </div>
                            <button onClick={() => onOpenChange(false)} className="text-zinc-500 hover:text-white transition-colors p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body scrollable */}
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                        {/* Type + Emprunteur */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Type</Label>
                                <Select value={type} onValueChange={(v) => setType(v as LoanType)}>
                                    <SelectTrigger className="bg-white/5 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-white/10">
                                        {TYPES.map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Emprunteur *</Label>
                                <button
                                    type="button"
                                    onClick={() => setBorrowerModalOpen(true)}
                                    className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 flex items-center gap-2 text-sm hover:border-amber-500/30 transition-colors text-left"
                                >
                                    {borrower ? (
                                        <>
                                            <Avatar className="h-5 w-5 rounded-md">
                                                <AvatarImage src={borrower.image || undefined} />
                                                <AvatarFallback className="text-[8px] bg-zinc-800">{borrower.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-bold text-white truncate">{borrower.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserSearch className="h-3.5 w-3.5 text-zinc-500" />
                                            <span className="text-zinc-500">Rechercher...</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Description *</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: 2M kamas pour stuff Cra"
                                className="bg-white/5 border-white/10"
                                maxLength={200}
                            />
                        </div>

                        {/* Montant + Échéance */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Montant / Qté</Label>
                                <Input
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Ex: 2 000 000 kamas"
                                    className="bg-white/5 border-white/10"
                                    maxLength={100}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Échéance</Label>
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white [&::-webkit-calendar-picker-indicator]:invert"
                                />
                            </div>
                        </div>

                        {/* Item lié (STUFF / RESSOURCES) */}
                        {(type === "STUFF" || type === "RESSOURCES") && (
                            <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                    Item lié <span className="text-zinc-600 font-normal">(optionnel)</span>
                                </Label>
                                <DofusItemSearch
                                    category={type === "RESSOURCES" ? "resources" : "equipment"}
                                    onSelect={setLinkedItem}
                                    value={linkedItem}
                                    onClear={() => setLinkedItem(null)}
                                    placeholder={type === "RESSOURCES" ? "Ex: Bois de Frêne, Fer..." : "Ex: Gelano, Turquoise de Rêve..."}
                                />
                                {linkedItem && (
                                    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                        {linkedItem.iconUrl && (
                                            <div className="relative h-10 w-10 shrink-0">
                                                <Image src={linkedItem.iconUrl} alt={linkedItem.name} fill className="object-contain" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-black text-white">{linkedItem.name}</p>
                                            <p className="text-[10px] text-zinc-500">Item sélectionné</p>
                                        </div>
                                    </div>
                                )}
                                {type === "RESSOURCES" && (
                                    <div className="space-y-2">
                                        <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                            Quantité <span className="text-zinc-600 font-normal">(1 – 100 000)</span>
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
                                            className="bg-white/5 border-white/10 w-36"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Notes <span className="text-zinc-600 font-normal">(optionnel)</span></Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Détails supplémentaires..."
                                className="bg-white/5 border-white/10 min-h-[60px] resize-none"
                                maxLength={1000}
                            />
                        </div>

                        {/* Proof Upload */}
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Screenshot preuve</Label>
                            {proofPreview ? (
                                <div className="relative h-48 rounded-xl overflow-hidden border border-white/10">
                                    <Image src={proofPreview} alt="Preuve" fill className="object-cover" />
                                    <Button size="icon" variant="ghost" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute top-2 right-2 h-7 w-7 bg-black/60 hover:bg-black/80 text-white">
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${isDragging ? "border-amber-500/60 bg-amber-500/5 text-amber-400" : "border-white/10 hover:border-amber-500/30 hover:text-amber-400 text-zinc-500"}`}
                                >
                                    <Upload className="h-5 w-5" />
                                    <p className="text-xs font-medium">{isDragging ? "Relâcher pour ajouter" : "Glisser-déposer ou cliquer"}</p>
                                    <p className="text-[10px] text-zinc-600">PNG, JPEG, WebP — max 5MB</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
                        </div>

                        {/* Notif Discord */}
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex items-center gap-2.5">
                                <Send className="h-4 w-4 text-indigo-400" />
                                <div>
                                    <p className="text-xs font-bold text-zinc-300">Notifier sur Discord</p>
                                    <p className="text-[10px] text-zinc-600">Envoyer un embed dans le salon prêts</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNotifyDiscord(v => !v)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${notifyDiscord ? "bg-indigo-500" : "bg-zinc-700"}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${notifyDiscord ? "translate-x-4" : "translate-x-1"}`} />
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                        <button onClick={() => onOpenChange(false)} className="text-sm text-zinc-500 hover:text-white transition-colors font-medium">
                            Annuler
                        </button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !borrower || !description.trim()}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black px-6"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🤝 Enregistrer le prêt"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
