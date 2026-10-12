"use client";

import { useState } from "react";
import { 
    Key, 
    Plus, 
    Copy, 
    Check, 
    Trash2, 
    ShieldAlert, 
    Clock, 
    Lock, 
    Layers, 
    ExternalLink 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
    createGuildApiKeyAction, 
    revokeGuildApiKeyAction
} from "@/server/actions/api-key-actions";
import { API_SCOPES } from "@/lib/api-scopes";
import type { ApiScope } from "@/lib/api-scopes";

interface ApiKeyItem {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    rateLimitPerMin: number;
    lastUsedAt: Date | string | null;
    expiresAt: Date | string | null;
    revokedAt: Date | string | null;
    createdAt: Date | string;
}

export function GuildApiKeysManager({
    guildId,
    initialKeys
}: {
    guildId: string;
    initialKeys: ApiKeyItem[];
}) {
    const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
    const [isCreating, setIsCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:members"]);
    const [rateLimit, setRateLimit] = useState(60);
    const [expiresInDays, setExpiresInDays] = useState<number | undefined>(90);
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [hasCopied, setHasCopied] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleToggleScope = (scopeId: string) => {
        setSelectedScopes(prev => 
            prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]
        );
    };

    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) {
            toast.error("Veuillez saisir un nom pour la clé");
            return;
        }
        if (selectedScopes.length === 0) {
            toast.error("Veuillez sélectionner au moins un scope");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createGuildApiKeyAction({
                guildId,
                name: newKeyName.trim(),
                scopes: selectedScopes,
                rateLimitPerMin: rateLimit,
                expiresInDays: expiresInDays || null
            });

            if (res.success && res.data) {
                setRevealedKey(res.data.rawApiKey);
                setKeys(prev => [
                    {
                        id: res.data.id,
                        name: res.data.name,
                        prefix: res.data.prefix,
                        scopes: res.data.scopes,
                        rateLimitPerMin: rateLimit,
                        lastUsedAt: null,
                        expiresAt: res.data.expiresAt,
                        revokedAt: null,
                        createdAt: new Date()
                    },
                    ...prev
                ]);
                setIsCreating(false);
                setNewKeyName("");
                toast.success("Clé d'API générée avec succès !");
            } else {
                toast.error(res.error || "Échec de la création de la clé");
            }
        } catch {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevokeKey = async (apiKeyId: string) => {
        if (!confirm("Êtes-vous sûr de vouloir révoquer cette clé d'API ? Tout accès externe sera immédiatement coupé.")) {
            return;
        }

        try {
            const res = await revokeGuildApiKeyAction(guildId, apiKeyId);
            if (res.success) {
                setKeys(prev => prev.map(k => k.id === apiKeyId ? { ...k, revokedAt: new Date() } : k));
                toast.success("Clé d'API révoquée avec succès");
            } else {
                toast.error(res.error || "Échec de la révocation");
            }
        } catch {
            toast.error("Erreur serveur");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setHasCopied(true);
        toast.success("Clé copiée dans le presse-papier !");
        setTimeout(() => setHasCopied(false), 2500);
    };

    return (
        <div className="space-y-6">
            {/* Header Box */}
            <div className="p-6 rounded-3xl bg-surface border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                        <Key className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Clés d'API & Intégrations Externes</h3>
                        <p className="text-xs text-muted-foreground">
                            Créez des jetons d'accès programmatiques sécurisés (Bearer Token) pour brancher des bots ou sites tiers.
                        </p>
                    </div>
                </div>

                {!isCreating && (
                    <Button
                        onClick={() => setIsCreating(true)}
                        className="h-9 px-4 rounded-xl text-xs font-black gap-1.5 shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Générer une Clé
                    </Button>
                )}
            </div>

            {/* Revealed Key Banner (Shown only once upon generation) */}
            {revealedKey && (
                <div className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 space-y-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-foreground">Copiez votre nouvelle clé d'API maintenant</h4>
                            <p className="text-xs text-muted-foreground">
                                Pour des raisons de sécurité, cette clé secrète ne sera plus jamais réaffichée. Conservez-la dans vos variables d'environnement.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 rounded-2xl bg-black/60 border border-border font-mono text-xs font-bold text-amber-300 break-all select-all">
                            {revealedKey}
                        </code>
                        <Button
                            onClick={() => copyToClipboard(revealedKey)}
                            variant="secondary"
                            className="h-11 px-4 rounded-2xl text-xs font-bold gap-2 shrink-0"
                        >
                            {hasCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            {hasCopied ? "Copié !" : "Copier"}
                        </Button>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRevealedKey(null)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            J'ai bien enregistré ma clé
                        </Button>
                    </div>
                </div>
            )}

            {/* Creation Form */}
            {isCreating && (
                <form onSubmit={handleCreateKey} className="p-6 rounded-3xl bg-surface border border-accent/30 space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center pb-4 border-b border-border">
                        <h4 className="text-sm font-black text-foreground">Nouvelle Clé d'API</h4>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsCreating(false)}
                            className="h-7 text-xs"
                        >
                            Annuler
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Nom de l'application / Bot</label>
                            <Input
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="Ex: Bot Discord Événements, Site Guilde"
                                required
                                className="h-10 rounded-xl"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Expiration</label>
                            <select
                                value={expiresInDays || ""}
                                onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)}
                                className="w-full h-10 px-3 rounded-xl bg-surface border border-border text-xs font-bold text-foreground focus:outline-none"
                            >
                                <option value="30">30 jours</option>
                                <option value="90">90 jours (Recommandé)</option>
                                <option value="180">180 jours</option>
                                <option value="365">1 an</option>
                                <option value="">Sans expiration</option>
                            </select>
                        </div>
                    </div>

                    {/* Scopes Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Permissions & Scopes (Lecture Seule)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {API_SCOPES.map((scope) => {
                                const isChecked = selectedScopes.includes(scope.id);
                                return (
                                    <div
                                        key={scope.id}
                                        onClick={() => handleToggleScope(scope.id)}
                                        className={cn(
                                            "p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3",
                                            isChecked 
                                                ? "bg-accent-soft border-accent/50" 
                                                : "bg-elevated/40 border-border hover:border-border/80"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0",
                                            isChecked ? "bg-accent border-accent text-accent-foreground" : "border-muted-foreground/40"
                                        )}>
                                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="text-xs font-bold text-foreground">{scope.label}</div>
                                            <div className="text-[10px] text-muted-foreground leading-tight">{scope.description}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-border">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsCreating(false)}
                            className="rounded-xl text-xs"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-xl text-xs font-black px-5 shadow-sm"
                        >
                            {isSubmitting ? "Génération..." : "Générer la Clé"}
                        </Button>
                    </div>
                </form>
            )}

            {/* Keys Table */}
            <div className="p-6 rounded-3xl bg-surface border border-border space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Clés d'API Existantes ({keys.length}/5)
                </h4>

                {keys.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground italic">
                        Aucune clé d'API active pour le moment.
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {keys.map((k) => {
                            const isRevoked = !!k.revokedAt;
                            const isExpired = k.expiresAt ? new Date() > new Date(k.expiresAt) : false;

                            return (
                                <div key={k.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-sm font-bold text-foreground">{k.name}</span>
                                            <code className="text-[11px] font-mono text-muted-foreground bg-elevated px-2 py-0.5 rounded-md border border-border">
                                                {k.prefix}...
                                            </code>
                                            {isRevoked ? (
                                                <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                                    Révoquée
                                                </span>
                                            ) : isExpired ? (
                                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                    Expirée
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                    Active
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                            <span>Scopes: {k.scopes.join(", ")}</span>
                                            <span>•</span>
                                            <span>Limite: {k.rateLimitPerMin} req/min</span>
                                            <span>•</span>
                                            <span>
                                                Créée le {new Date(k.createdAt).toLocaleDateString("fr-FR")}
                                            </span>
                                        </div>
                                    </div>

                                    {!isRevoked && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRevokeKey(k.id)}
                                            className="h-8 px-3 rounded-xl text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0 gap-1.5"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Révoquer
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
