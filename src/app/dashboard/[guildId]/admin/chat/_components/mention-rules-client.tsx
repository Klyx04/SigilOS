"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Plus, X, Users, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { updateChatMentionRules } from "@/server/actions/chat-actions";

type RoleOption = { id: string; name: string };

interface MentionRulesClientProps {
    discordGuildId: string;
    initialRules: Record<string, string[]>;
    availableRoles: RoleOption[]; // List of roles in the guild
}

export function MentionRulesClient({ discordGuildId, initialRules, availableRoles }: MentionRulesClientProps) {
    const [rules, setRules] = useState<Record<string, string[]>>(initialRules);
    const [saving, setSaving] = useState(false);
    const [roleSearch, setRoleSearch] = useState("");

    // Sort roles for consistent display
    const sortedRoles = [...availableRoles].sort((a, b) => a.name.localeCompare(b.name));
    const roleIdMap = Object.fromEntries(availableRoles.map(r => [r.id, r.name]));

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateChatMentionRules(discordGuildId, rules);
            if (res.success) {
                toast.success("Règles de mention enregistrées");
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement");
            }
        } catch (error) {
            toast.error("Erreur inattendue");
        } finally {
            setSaving(false);
        }
    };

    const addSourceRole = (roleId: string) => {
        if (!roleId || rules[roleId]) return;
        setRules(prev => ({ ...prev, [roleId]: [] }));
    };

    const removeSourceRole = (sourceRoleId: string) => {
        setRules(prev => {
            const next = { ...prev };
            delete next[sourceRoleId];
            return next;
        });
    };

    const toggleTargetRole = (sourceRoleId: string, targetRoleId: string) => {
        setRules(prev => {
            const targets = prev[sourceRoleId] || [];
            const newTargets = targets.includes(targetRoleId)
                ? targets.filter(t => t !== targetRoleId)
                : [...targets, targetRoleId];

            return {
                ...prev,
                [sourceRoleId]: newTargets
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-400" />
                        Permissions de Mentions
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Définissez quels rôles peuvent mentionner (ping) d'autres rôles dans le chat.
                        Si un rôle n'est pas dans cette liste, il ne peut mentionner personne.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <span className="animate-spin text-lg">⏳</span> : <Save className="w-4 h-4" />}
                    {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
            </div>

            <div className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden p-6 space-y-6">

                {/* Add new source role */}
                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-5 border-dashed border-indigo-500/20">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-zinc-100">Créer une nouvelle règle</h3>
                            <p className="text-[11px] text-zinc-500">Sélectionnez un rôle pour définir ses permissions de mention</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1 group">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Rechercher le rôle à configurer (ex: @Membres)..."
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-zinc-950 transition-all"
                            />
                            {roleSearch && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                    {sortedRoles
                                        .filter(r => !Object.keys(rules).includes(r.id))
                                        .filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()))
                                        .map(role => (
                                            <button
                                                key={role.id}
                                                onClick={() => {
                                                    addSourceRole(role.id);
                                                    setRoleSearch("");
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors flex items-center justify-between group"
                                            >
                                                <span>{role.name}</span>
                                                <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    {sortedRoles
                                        .filter(r => !Object.keys(rules).includes(r.id))
                                        .filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-4 text-center text-xs text-zinc-500 italic">Aucun rôle disponible trouvé</div>
                                        )}
                                </div>
                            )}
                        </div>
                        {roleSearch && (
                            <button
                                onClick={() => setRoleSearch("")}
                                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors border border-white/5"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    {Object.entries(rules).length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-white/10 rounded-lg">
                            Aucune règle configurée. Personne ne peut mentionner de rôles.
                        </div>
                    ) : (
                        Object.entries(rules).map(([sourceRoleId, targetRoles]) => (
                            <MentionRuleItem
                                key={sourceRoleId}
                                sourceRoleId={sourceRoleId}
                                targetRoles={targetRoles}
                                sortedRoles={sortedRoles}
                                roleIdMap={roleIdMap}
                                onRemove={() => removeSourceRole(sourceRoleId)}
                                onToggleTarget={(tid) => toggleTargetRole(sourceRoleId, tid)}
                            />
                        ))
                    )}
                </div>

                <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-200/70 leading-relaxed">
                        Le rôle <strong className="text-indigo-400">Admin</strong> du dashboard peut toujours mentionner n'importe qui par défaut ("God Mode").
                        Les mentions d'utilisateurs spécifiques (@Pseudo) sont autorisées pour tout le monde. Ces règles ne s'appliquent qu'aux mentions de <strong>rôles complets</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
}

function MentionRuleItem({
    sourceRoleId,
    targetRoles,
    sortedRoles,
    roleIdMap,
    onRemove,
    onToggleTarget
}: {
    sourceRoleId: string;
    targetRoles: string[];
    sortedRoles: RoleOption[];
    roleIdMap: Record<string, string>;
    onRemove: () => void;
    onToggleTarget: (roleId: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [isCollapsed, setIsCollapsed] = useState(true);

    const activeTargets = targetRoles.map(tid => ({ id: tid, name: roleIdMap[tid] || "Inconnu" }));
    const filteredResults = search.trim()
        ? sortedRoles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
        : [];

    return (
        <div className={`bg-zinc-950/50 border border-white/5 rounded-xl transition-all hover:border-white/10 ${isCollapsed ? "p-3" : "p-4"}`}>
            <div className={`flex items-center justify-between ${isCollapsed ? "" : "mb-4 pb-3 border-b border-white/5"}`}>
                <div
                    className="flex items-center gap-3 cursor-pointer flex-1 group/header"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover/header:bg-indigo-500/20 transition-colors">
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div className="flex items-center gap-3">
                        <div>
                            <span className="text-sm font-bold text-zinc-100 block">
                                {roleIdMap[sourceRoleId]?.startsWith("@") ? roleIdMap[sourceRoleId] : `@${roleIdMap[sourceRoleId] || sourceRoleId}`}
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest leading-none">
                                {isCollapsed ? "Permissions masquées" : "Peut mentionner"}
                            </span>
                        </div>

                        {isCollapsed && activeTargets.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1.5 ml-4">
                                {activeTargets.slice(0, 3).map(t => (
                                    <span key={t.id} className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-white/5">
                                        {t.name.startsWith("@") ? t.name : `@${t.name}`}
                                    </span>
                                ))}
                                {activeTargets.length > 3 && (
                                    <span className="text-[10px] text-zinc-600 font-bold">+{activeTargets.length - 3} de plus</span>
                                )}
                            </div>
                        )}
                        {isCollapsed && activeTargets.length === 0 && (
                            <span className="text-[10px] text-zinc-600 italic ml-4">Aucune permission</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={onRemove}
                    className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                    title="Supprimer la règle"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {!isCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Active Tags */}
                    <div className="flex flex-wrap gap-2">
                        {activeTargets.length === 0 ? (
                            <span className="text-xs text-zinc-500 italic">Personne autorisé pour le moment</span>
                        ) : (
                            activeTargets.map(t => (
                                <div key={t.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-lg text-xs font-medium group">
                                    {t.name.startsWith("@") ? t.name : `@${t.name}`}
                                    <button
                                        onClick={() => onToggleTarget(t.id)}
                                        className="p-0.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add Target Search */}
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-indigo-400 transition-colors">
                            <Plus className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Ajouter un rôle autorisé..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:bg-zinc-900 transition-all"
                        />

                        {search && (
                            <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-20 p-1">
                                {filteredResults.length > 0 ? (
                                    filteredResults.map(role => {
                                        const isAdded = targetRoles.includes(role.id);
                                        return (
                                            <button
                                                key={role.id}
                                                onClick={() => {
                                                    if (!isAdded) onToggleTarget(role.id);
                                                    setSearch("");
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between group/item ${isAdded
                                                    ? "opacity-40 cursor-not-allowed bg-zinc-950"
                                                    : "text-zinc-400 hover:bg-indigo-600/20 hover:text-indigo-200"
                                                    }`}
                                            >
                                                <span>{role.name.startsWith("@") ? role.name : `@${role.name}`}</span>
                                                {!isAdded ? <Plus className="w-3 h-3 opacity-0 group-hover/item:opacity-100" /> : <span className="text-[9px] font-bold text-indigo-500">DÉJÀ AJOUTÉ</span>}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="px-3 py-4 text-center text-xs text-zinc-500">Aucun rôle trouvé</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
