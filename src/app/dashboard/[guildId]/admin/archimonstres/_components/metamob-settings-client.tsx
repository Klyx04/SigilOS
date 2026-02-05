"use client";

import { useState, useEffect } from "react";
import { getMetamobConfig, updateMetamobApiKey } from "@/server/actions/admin-actions";
import { Key, Eye, EyeOff, Save, Trash2, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface MetamobSettingsClientProps {
    guildId: string;
}

export function MetamobSettingsClient({ guildId }: MetamobSettingsClientProps) {
    const [hasApiKey, setHasApiKey] = useState(false);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);
    const [newKey, setNewKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    async function loadConfig() {
        setLoading(true);
        const res = await getMetamobConfig(guildId);
        if (res.success && res.data) {
            setHasApiKey(res.data.hasApiKey);
            setMaskedKey(res.data.maskedKey);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadConfig();
    }, [guildId]);

    async function handleSave() {
        if (!newKey.trim()) {
            setMessage({ type: "error", text: "Veuillez entrer une clé API valide" });
            return;
        }

        setSaving(true);
        setMessage(null);

        const res = await updateMetamobApiKey(guildId, newKey.trim());

        if (res.success) {
            setMessage({ type: "success", text: "Clé API sauvegardée avec succès !" });
            setNewKey("");
            await loadConfig();
        } else {
            setMessage({ type: "error", text: res.error || "Erreur lors de la sauvegarde" });
        }
        setSaving(false);
    }

    async function handleRemove() {
        if (!confirm("Êtes-vous sûr de vouloir supprimer la clé API ? La guilde utilisera la clé globale par défaut.")) {
            return;
        }

        setSaving(true);
        setMessage(null);

        const res = await updateMetamobApiKey(guildId, null);

        if (res.success) {
            setMessage({ type: "success", text: "Clé API supprimée. Utilisation de la clé globale." });
            setNewKey("");
            await loadConfig();
        } else {
            setMessage({ type: "error", text: res.error || "Erreur lors de la suppression" });
        }
        setSaving(false);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Status */}
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-white/10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${hasApiKey ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                        <Key className={`w-5 h-5 ${hasApiKey ? 'text-green-400' : 'text-amber-400'}`} />
                    </div>
                    <div>
                        <h3 className="font-medium text-white">
                            {hasApiKey ? "Clé API configurée" : "Pas de clé API"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {hasApiKey
                                ? `Clé actuelle : ${maskedKey}`
                                : "La guilde utilise la clé API globale par défaut"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === "success"
                    ? "bg-green-500/10 border border-green-500/30 text-green-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}>
                    {message.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Input */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                    {hasApiKey ? "Nouvelle clé API (remplacera l'ancienne)" : "Clé API Metamob"}
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type={showKey ? "text" : "password"}
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder="Collez votre clé API ici..."
                            className="w-full px-4 py-3 pr-12 bg-zinc-800/50 border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                            {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving || !newKey.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-medium rounded-lg transition-colors"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Sauvegarder
                </button>

                {hasApiKey && (
                    <button
                        onClick={handleRemove}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-lg transition-colors border border-red-500/30"
                    >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                    </button>
                )}
            </div>

            {/* Help Section - Step by Step */}
            <div className="mt-8 space-y-4">
                {/* Main Tutorial */}
                <div className="p-5 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
                    <h4 className="font-semibold text-blue-400 mb-4 text-lg">📖 Tutoriel : Obtenir votre clé API Metamob</h4>

                    <div className="space-y-4 text-sm">
                        <div className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">1</div>
                            <div>
                                <p className="font-medium text-white">Ouvrez le site Metamob</p>
                                <p className="text-muted-foreground">Cliquez sur ce lien : <a href="https://www.metamob.fr" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">www.metamob.fr <ExternalLink className="w-3 h-3" /></a></p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">2</div>
                            <div>
                                <p className="font-medium text-white">Connectez-vous à votre compte Metamob</p>
                                <p className="text-muted-foreground">Utilisez le bouton <strong className="text-white">"Connexion"</strong> en haut à droite du site</p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">3</div>
                            <div>
                                <p className="font-medium text-white">Allez dans les paramètres API</p>
                                <p className="text-muted-foreground">Cliquez sur votre <strong className="text-white">pseudo</strong> (en haut) → <strong className="text-white">Mon compte</strong> → Onglet <strong className="text-white">"API"</strong></p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">4</div>
                            <div>
                                <p className="font-medium text-white">Générez ou copiez votre clé</p>
                                <p className="text-muted-foreground">Si vous n'avez pas de clé, cliquez sur <strong className="text-white">"Générer une nouvelle clé"</strong>. Sinon, copiez la clé existante.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">5</div>
                            <div>
                                <p className="font-medium text-white">Collez la clé dans SigilOS</p>
                                <p className="text-muted-foreground">Revenez ici, collez la clé dans le champ ci-dessus, puis cliquez <strong className="text-white">Sauvegarder</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 90 Days Warning */}
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex gap-3">
                    <div className="flex-shrink-0 text-2xl">⏰</div>
                    <div>
                        <p className="font-semibold text-amber-400">Important : La clé expire après 90 jours</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Les clés API Metamob sont valides <strong className="text-amber-300">90 jours</strong>.
                            Passé ce délai, vous devrez en générer une nouvelle sur metamob.fr et la mettre à jour ici.
                            Si la Bourse aux Archis cesse de fonctionner, c'est probablement la clé API qui a expiré !
                        </p>
                    </div>
                </div>

                {/* Security Note */}
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-white/5">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="text-green-400">🔒</span>
                        <span>La clé API est stockée de manière sécurisée et chiffrée. Elle n'est jamais affichée en clair après la sauvegarde.</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
