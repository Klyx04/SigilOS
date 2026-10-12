"use client";

import { useState } from "react";
import { 
    Terminal, 
    Search, 
    Copy, 
    Check, 
    Sparkles, 
    ShieldAlert, 
    Hash, 
    Users, 
    Lock, 
    CheckCircle2, 
    ExternalLink,
    HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type SlashCommandDefinition } from "@/lib/slash-commands-catalog";

export interface CommandPermissionInfo {
    command: SlashCommandDefinition;
    isEnabled: boolean;
    roleIds: string[];
    channelIds: string[];
}

interface CommandsVisualGuideProps {
    matrix: CommandPermissionInfo[];
    discordRoles: { id: string; name: string; color?: number }[];
    discordChannels: { id: string; name: string }[];
    userRoleIds: string[];
    isAdmin: boolean;
    guildName: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    UTILITAIRE: { label: "Utilitaires", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: "⚡" },
    DONJONS_QUETES: { label: "Donjons & Quêtes", color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20", icon: "⚔️" },
    PROFIL: { label: "Profil & Badges", color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: "👤" },
    COMMUNAUTE: { label: "Communauté", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: "🤝" }
};

// Simulation des embeds Discord réalistes par commande
const EMBED_PREVIEWS: Record<string, {
    color: string;
    title: string;
    description: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer: string;
}> = {
    almanax: {
        color: "#F4A261",
        title: "📅 Almanax du Jour",
        description: "Offrande : 3x Plumes de Piou Bleu\nBonus : +50% d'XP sur les créatures des Plaines de Cania.\n\n👉 Consulte les prévisions de la semaine sur le Dashboard !",
        footer: "SigilOS • Almanax • Aujourd'hui à 12:00"
    },
    dofus: {
        color: "#7B5EA7",
        title: "🥚 Dofus Ocre",
        description: "Ce précieux œuf de dragon confère 1 PA supplémentaire à son porteur légendaire.",
        fields: [
            { name: "Niveau Requis", value: "160", inline: true },
            { name: "Rareté", value: "Primordial", inline: true },
            { name: "Étapes de Quête", value: "34 étapes (Archimonstres)", inline: true }
        ],
        footer: "SigilOS • Guide des Dofus • Quêtes"
    },
    profil: {
        color: "#5865F2",
        title: "🎖️ Fiche Aventurier — @Klyx",
        description: "Consulte les succès, statistiques et distinctions de ce membre au sein de la guilde.",
        fields: [
            { name: "Rang Guilde", value: "Bras Droit", inline: true },
            { name: "Classe & Niveau", value: "Iop 200 (Oméga 45)", inline: true },
            { name: "Points Guilde", value: "1 450 pts", inline: true }
        ],
        footer: "SigilOS • Profil Joueur • Aujourd'hui"
    },
    sorties: {
        color: "#57F287",
        title: "🚪 Sorties Donjons & Activités Ouvertes",
        description: "Voici les rassemblements créés par les membres en attente de combattants :",
        fields: [
            { name: "👑 Donjon Vortex (3/4)", value: "Proposé par @Beyzagul — Départ 21h00", inline: false },
            { name: "🌀 Songes Infinis Étage 280 (2/4)", value: "Proposé par @Aventurier — En cours", inline: false }
        ],
        footer: "SigilOS • Donjons & Quêtes • 2 sorties actives"
    },
    defi: {
        color: "#ED4245",
        title: "⚔️ Défi Double Boss de la Semaine",
        description: "Terrassez les boss désignés en guilde pour remporter un bonus exceptionnel de 250 points !",
        fields: [
            { name: "Boss 1", value: "Comte Harebourg", inline: true },
            { name: "Boss 2", value: "Klime", inline: true },
            { name: "Fin du Défi", value: "Dimanche 23h59", inline: true }
        ],
        footer: "SigilOS • Événements & Défis"
    },
    boss: {
        color: "#ED4245",
        title: "💀 Comte Harebourg (Niv. 200)",
        description: "Maître de la Tour de la Clepsydre. Manipulateur temporel infligeant Confusion élémentaire.",
        fields: [
            { name: "❤️ PV", value: "28 000", inline: true },
            { name: "⚡ PA / PM", value: "16 / 6", inline: true },
            { name: "📍 Position", value: "[-68, -76]", inline: true },
            { name: "🛡️ Résistances", value: "⚪ 25% • 🟤 20% • 🔴 30%\n🔵 15% • 🟢 25%", inline: false },
            { name: "⚔️ Sorts majeurs", value: "• **Paradoxe Temporel** (4 PA • 1-8 PO)\n• **Crépuscule d'Hiver** (3 PA • CàC)\n• **Heure de Gloire** (2 PA • 0 PO)", inline: false }
        ],
        footer: "SigilOS • Bestiaire & Boss"
    },
    monstre: {
        color: "#3498DB",
        title: "👾 Mansot Royal (Niv. 140)",
        description: "Chef incontesté de la colonie de Mansots. Gare à sa glissade étourdissante !",
        fields: [
            { name: "❤️ PV", value: "8 400", inline: true },
            { name: "⚡ PA / PM", value: "12 / 5", inline: true },
            { name: "📍 Position", value: "[-61, -83]", inline: true },
            { name: "🛡️ Résistances", value: "⚪ 15% • 🟤 10% • 🔴 35%\n🔵 0% • 🟢 20%", inline: false },
            { name: "💎 Drops notables", value: "• Plume de Mansot Royal (14.5%)\n• Bec de Mansot (28%)", inline: false }
        ],
        footer: "SigilOS • Bestiaire & Monstres"
    },
    stats: {
        color: "#FEE75C",
        title: "📊 Statistiques de Guilde",
        description: "Vue d'ensemble de l'activité récente et des succès débloqués collectivement.",
        fields: [
            { name: "Membres Actifs", value: "48 / 55", inline: true },
            { name: "Missions Réussies", value: "142 cette semaine", inline: true },
            { name: "Niveau Moyen", value: "198", inline: true }
        ],
        footer: "SigilOS • Statistiques • Données en direct"
    }
};

export function CommandsVisualGuide({
    matrix,
    discordRoles,
    discordChannels,
    userRoleIds,
    isAdmin,
    guildName
}: CommandsVisualGuideProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

    const rolesMap = new Map(discordRoles.map(r => [r.id, r]));
    const channelsMap = new Map(discordChannels.map(c => [c.id, c.name]));

    const filtered = matrix.filter(item => {
        const matchesCategory = selectedCategory === "ALL" || item.command.category === selectedCategory;
        const matchesSearch = item.command.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.command.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.command.usage.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleCopy = (text: string, name: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCmd(name);
        toast.success(`Commande ${text} copiée dans le presse-papier !`);
        setTimeout(() => setCopiedCmd(null), 2000);
    };

    return (
        <div className="space-y-8">
            {/* HÉRO BANNER */}
            <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-surface via-surface to-accent/10 border border-border/80 shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-bold uppercase tracking-wider">
                            <Terminal className="w-3.5 h-3.5" />
                            Guide Officiel des Slash Commands
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                            Commandes Discord de la guilde {guildName}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Retrouvez la syntaxe complète, les aperçus en direct et les autorisations par salon et par rôle configurées par le staff. Tapez simplement <code className="text-accent font-mono font-bold bg-accent/10 px-1.5 py-0.5 rounded">/</code> dans Discord pour démarrer.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="p-4 rounded-2xl bg-surface-raised border border-border flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                            <div className="text-left">
                                <div className="text-xs font-bold text-foreground">Bot SigilOS Actif</div>
                                <div className="text-[11px] text-muted-foreground font-mono">{matrix.filter(m => m.isEnabled).length} commandes en ligne</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute right-0 top-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* FILTRES & RECHERCHE */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Catégories */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedCategory("ALL")}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                            selectedCategory === "ALL"
                                ? "bg-accent text-accent-foreground shadow-md"
                                : "bg-surface text-muted-foreground hover:text-foreground border border-border"
                        )}
                    >
                        Toutes ({matrix.length})
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([catKey, config]) => {
                        const count = matrix.filter(m => m.command.category === catKey).length;
                        return (
                            <button
                                key={catKey}
                                type="button"
                                onClick={() => setSelectedCategory(catKey)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                                    selectedCategory === catKey
                                        ? "bg-accent text-accent-foreground shadow-md"
                                        : "bg-surface text-muted-foreground hover:text-foreground border border-border"
                                )}
                            >
                                <span>{config.icon}</span>
                                <span>{config.label}</span>
                                <span className="opacity-60 text-[10px]">({count})</span>
                            </button>
                        );
                    })}
                </div>

                {/* Champ de recherche */}
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Rechercher une commande..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-surface border border-border rounded-xl focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                </div>
            </div>

            {/* LISTE DES COMMANDES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filtered.map(item => {
                    const preview = EMBED_PREVIEWS[item.command.name] || {
                        color: "#5865F2",
                        title: `/${item.command.name}`,
                        description: item.command.description,
                        footer: "SigilOS • Discord"
                    };

                    const isUserRoleAllowed = isAdmin || item.roleIds.length === 0 || item.roleIds.some(r => userRoleIds.includes(r));
                    const canExecute = item.isEnabled && isUserRoleAllowed;
                    const catInfo = CATEGORY_CONFIG[item.command.category] || { label: item.command.category, color: "text-accent bg-accent/10", icon: "⚡" };

                    return (
                        <div
                            key={item.command.name}
                            className={cn(
                                "group relative rounded-3xl border transition-all flex flex-col justify-between overflow-hidden",
                                item.isEnabled 
                                    ? "bg-surface border-border hover:border-accent/40 shadow-sm hover:shadow-xl" 
                                    : "bg-elevated/30 border-border/40 opacity-70"
                            )}
                        >
                            {/* Card Content */}
                            <div className="p-6 space-y-5">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-base sm:text-lg font-black font-mono text-accent bg-accent/10 px-2.5 py-1 rounded-xl">
                                                /{item.command.name}
                                            </span>
                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg border", catInfo.color)}>
                                                {catInfo.icon} {catInfo.label}
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                                            {item.command.description}
                                        </p>
                                    </div>

                                    {/* Statut Éligibilité */}
                                    <div className="shrink-0">
                                        {!item.isEnabled ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                                <Lock className="w-3 h-3" /> Désactivée
                                            </span>
                                        ) : canExecute ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                <CheckCircle2 className="w-3 h-3" /> Accessible
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Tu ne possèdes pas le rôle requis">
                                                <Lock className="w-3 h-3" /> Rôle requis
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Usage & Copy */}
                                <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Syntaxe d'utilisation
                                    </div>
                                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/80 border border-border font-mono text-xs text-foreground group/copy">
                                        <span className="text-accent font-bold truncate select-all">{item.command.usage}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(item.command.usage, item.command.name)}
                                            className="p-1.5 rounded-lg bg-surface border border-border hover:border-accent hover:text-accent text-muted-foreground transition-all shrink-0"
                                            title="Copier la commande"
                                        >
                                            {copiedCmd === item.command.name ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Restriction Salons & Rôles */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                                    {/* Salons */}
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                            <Hash className="w-3 h-3 text-muted-foreground" />
                                            Salons Discord
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {item.channelIds.length === 0 ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                    Partout (Tous les salons)
                                                </span>
                                            ) : (
                                                item.channelIds.map(cId => {
                                                    const name = channelsMap.get(cId) || cId;
                                                    return (
                                                        <span
                                                            key={cId}
                                                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-raised border border-border text-foreground flex items-center gap-0.5"
                                                        >
                                                            <span className="opacity-50">#</span>
                                                            <span>{name}</span>
                                                        </span>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Rôles */}
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                            <Users className="w-3 h-3 text-muted-foreground" />
                                            Rôles Discord
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {item.roleIds.length === 0 ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                                                    Tous les membres
                                                </span>
                                            ) : (
                                                item.roleIds.map(rId => {
                                                    const role = rolesMap.get(rId);
                                                    const isPossessed = userRoleIds.includes(rId);
                                                    return (
                                                        <span
                                                            key={rId}
                                                            className={cn(
                                                                "text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1",
                                                                isPossessed
                                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                                    : "bg-surface-raised text-muted-foreground border-border"
                                                            )}
                                                        >
                                                            <span>{role?.name || "Rôle Discord"}</span>
                                                            {isPossessed && <span className="text-[9px]">✓</span>}
                                                        </span>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* PRÉVISUALISATION DISCORD EMBED */}
                                <div className="space-y-1.5 pt-2 border-t border-border/50">
                                    <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                                        <span>Prévisualisation du Message Discord</span>
                                        <span className="text-[10px] font-mono text-muted-foreground/60">Simulateur Live</span>
                                    </div>

                                    {/* Conteneur Discord Theme */}
                                    <div className="rounded-2xl bg-[#2b2d31] p-3 text-[#dbdee1] font-sans text-xs border border-white/5 shadow-inner">
                                        {/* Bot User Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white">
                                                S
                                            </div>
                                            <span className="font-bold text-white text-xs">SigilOS</span>
                                            <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 rounded uppercase tracking-wider">
                                                BOT
                                            </span>
                                            <span className="text-[#949ba4] text-[10px]">Aujourd'hui à 12:00</span>
                                        </div>

                                        {/* Discord Embed Box */}
                                        <div 
                                            className="rounded-lg bg-[#232428] p-3 border-l-4 space-y-2"
                                            style={{ borderLeftColor: preview.color }}
                                        >
                                            <div className="font-bold text-sm text-white">{preview.title}</div>
                                            <div className="text-[#dbdee1] whitespace-pre-line text-xs leading-relaxed">
                                                {preview.description}
                                            </div>

                                            {preview.fields && preview.fields.length > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                                    {preview.fields.map((f, i) => (
                                                        <div key={i} className="space-y-0.5">
                                                            <div className="text-[10px] font-bold text-[#949ba4] uppercase">{f.name}</div>
                                                            <div className="text-white text-xs font-medium">{f.value}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="text-[10px] text-[#949ba4] pt-1 border-t border-white/5">
                                                {preview.footer}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="p-12 text-center rounded-3xl bg-surface border border-border space-y-3">
                    <Terminal className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                    <h3 className="text-base font-bold text-foreground">Aucune commande trouvée</h3>
                    <p className="text-xs text-muted-foreground">
                        Essayez de modifier vos filtres ou votre recherche pour afficher les commandes Discord disponibles.
                    </p>
                </div>
            )}
        </div>
    );
}
