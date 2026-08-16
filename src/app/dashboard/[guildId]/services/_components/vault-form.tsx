"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, TrendingDown, TrendingUp, Send, AlertTriangle } from "lucide-react";
import { createVaultEntry } from "@/server/actions/vault-actions";
import { VaultAction } from "@prisma/client";
import { toast } from "sonner";
import Image from "next/image";
import { DofusItemSearch } from "./dofus-item-search";
import type { DofusItem } from "@/lib/dofusdude-client";

interface VaultFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    isDiscordConfigured?: boolean;
}

export function VaultForm({ open, onOpenChange, guildId, isDiscordConfigured = false }: VaultFormProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<VaultAction>("DEPOSIT");
    const [itemName, setItemName] = useState("");
    const [selectedItem, setSelectedItem] = useState<DofusItem | null>(null);
    const [quantity, setQuantity] = useState("1");
    const [description, setDescription] = useState("");
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
        setAction("DEPOSIT");
        setItemName("");
        setSelectedItem(null);
        setQuantity("1");
        setDescription("");
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
        const resolvedName = selectedItem?.name || itemName.trim();
        if (!resolvedName) {
            toast.error("Le nom de l'objet est requis.");
            return;
        }

        setLoading(true);
        try {
            let proofFormData: FormData | undefined;
            if (proofFile) {
                proofFormData = new FormData();
                proofFormData.set("file", proofFile);
            }

            const result = await createVaultEntry(
                guildId,
                {
                    action,
                    itemName: selectedItem?.name || itemName.trim(),
                    quantity: parseInt(quantity) || 1,
                    description: description.trim() || null,
                    linkedItemIconUrl: selectedItem?.iconUrl || null,
                    notifyDiscord,
                },
                proofFormData
            );

            if (result.success) {
                toast.success(action === "DEPOSIT" ? "Dépôt enregistré !" : "Retrait enregistré !");
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

    const isDeposit = action === "DEPOSIT";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => onOpenChange(false)}
            />

            {/* Panel */}
            <div className="relative z-10 w-full max-w-lg bg-background rounded-2xl border border-border overflow-hidden">

                {/* Header coloré selon l'action */}
                <div className={`px-6 pt-6 pb-4 border-b border-border ${isDeposit ? "bg-success/10" : "bg-orange-500/10"}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl border ${isDeposit ? "border-success/40 bg-success/15 text-success" : "border-orange-500/40 bg-orange-500/15 text-orange-400"}`}>
                                {isDeposit ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-foreground">Coffre de guilde</h2>
                                <p className="text-xs text-muted-foreground">Enregistrer un mouvement</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Toggle Dépôt / Retrait */}
                    <div className="flex gap-2 mt-4">
                        {(["DEPOSIT", "WITHDRAW"] as VaultAction[]).map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => setAction(a)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${action === a
                                    ? a === "DEPOSIT"
                                        ? "border-success/60 bg-success/20 text-success"
                                        : "border-orange-500/60 bg-orange-500/20 text-orange-300"
                                    : "border-border bg-surface text-muted-foreground hover:border-border-strong"
                                    }`}
                            >
                                {a === "DEPOSIT" ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                                {a === "DEPOSIT" ? "Dépôt" : "Retrait"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 px-6 py-5">
                    {/* Objet */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                            Objet * <span className="text-muted-foreground font-normal">via Dofusdude ou saisie libre</span>
                        </Label>
                        <DofusItemSearch
                            category="all"
                            onSelect={(item) => { setSelectedItem(item); setItemName(item.name); }}
                            value={selectedItem}
                            onClear={() => { setSelectedItem(null); setItemName(""); }}
                            placeholder="Ex: Gelano, Abyssal Bouclier..."
                        />
                        <p className="text-caption text-muted-foreground">
                            Recherche : <strong className="text-muted-foreground">Dofusdude</strong> (api.dofusdu.de) — équipements, ressources et consommables.
                            Si l&apos;API est indisponible, la <strong className="text-muted-foreground">saisie libre</strong> ci-dessous reste disponible.
                        </p>
                        {!selectedItem && (
                            <Input
                                value={itemName}
                                onChange={(e) => setItemName(e.target.value)}
                                placeholder="Ou saisir le nom manuellement"
                                className="bg-surface border-border text-sm"
                                maxLength={100}
                            />
                        )}
                        {selectedItem && (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                                {selectedItem.iconUrl && (
                                    <div className="relative h-10 w-10 shrink-0">
                                        <Image src={selectedItem.iconUrl} alt={selectedItem.name} fill className="object-contain" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-black text-foreground">{selectedItem.name}</p>
                                    <p className="text-caption text-muted-foreground">Item Dofus sélectionné</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quantité */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                            Quantité <span className="text-muted-foreground font-normal">(max 200 millions)</span>
                        </Label>
                        <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            min={1}
                            max={200000000}
                            className="bg-surface border-border"
                        />
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Note <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Détail optionnel..."
                            className="bg-surface border-border"
                            maxLength={500}
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
                                <Button size="icon" variant="ghost" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute top-2 right-2 h-7 w-7 bg-black/60 hover:bg-black/80 text-foreground">
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-200 ${isDragging ? "border-success/60 bg-success/5 text-success" : "border-border hover:border-success/30 hover:text-success text-muted-foreground"}`}
                            >
                                <Upload className="h-5 w-5" />
                                <p className="text-xs font-medium">
                                    {isDragging ? "Relâcher pour ajouter" : (
                                        <>
                                            Glisser-déposer, coller ou <button type="button" onClick={() => fileInputRef.current?.click()} className="text-success hover:text-success underline font-black">cliquer</button>
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
                                    <p className="text-caption text-muted-foreground">Envoyer un embed dans le salon coffre</p>
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
                <div className="flex items-center justify-between px-6 pb-5 pt-0 border-t border-border">
                    <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                        Annuler
                    </button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || (!selectedItem && !itemName.trim())}
                        className={`font-black text-foreground px-6 ${isDeposit ? "bg-success hover:bg-success" : "bg-orange-600 hover:bg-orange-500"}`}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isDeposit ? "📥 Déposer" : "📤 Retirer")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
