"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Trophy, X, Loader2, Star, ShieldCheck, UserPlus, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeDjPostWithContributions, closeDjPost, getDjGuildMembersForClose } from "@/server/actions/dungeon-finder-actions";
import { toast } from "sonner";
import type { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";

interface DjCloseModalProps {
    isOpen: boolean;
    post: DjPostWithDetails;
    guildId: string;
    onClose: () => void;
    onClosed: () => void;
    /** #138 — vrai pour une clôture admin (pas de points de contribution, mais succès possibles). */
    adminMode?: boolean;
}

type GuildMember = { id: string; name: string; image: string | null };

/** Mirror of server-side getContributionPoints */
function getPointsFromLevel(level?: number | null): number {
    if (!level) return 1;
    if (level >= 200) return 4;
    if (level >= 150) return 3;
    if (level >= 100) return 2;
    return 1;
}

export function DjCloseModal({ isOpen, post, guildId, onClose, onClosed, adminMode = false }: DjCloseModalProps) {
    const [isPending, startTransition] = useTransition();

    // ── Participants qui se sont inscrits formellement ──────────────────────
    const acceptedParticipants = post.participants.filter(
        (p) => p.status === "ACCEPTED" && p.profile.id !== post.profileId
    );

    // IDs validés (cochés) : tous les inscrits par défaut
    const [validated, setValidated] = useState<Set<string>>(
        new Set(acceptedParticipants.map((p) => p.profile.id))
    );

    // ── #138 Succès concernés par ce post (simple OU multi-donjons) ──────────
    const successItems = useMemo(() => {
        const items: { dungeonId: string; achievementId: string; dungeonName: string; label: string }[] = [];
        if (Array.isArray(post.dungeonsJson) && post.dungeonsJson.length > 0) {
            for (const d of post.dungeonsJson) {
                const names = new Map((d.achievements ?? []).map((a: any) => [a.id, a.name]));
                for (const aid of d.wantedAchievementIds ?? []) {
                    items.push({ dungeonId: d.dungeonId, achievementId: aid, dungeonName: d.name, label: names.get(aid) ?? "Succès" });
                }
            }
        } else if ((post.wantedAchievementIds?.length ?? 0) > 0 && post.dungeon) {
            const names = new Map((post.dungeon.achievements ?? []).map((a: any) => [a.id, a.challenge.name]));
            for (const aid of post.wantedAchievementIds) {
                items.push({ dungeonId: post.dungeon.id, achievementId: aid, dungeonName: post.dungeon.name, label: names.get(aid) ?? "Succès" });
            }
        }
        return items;
    }, [post]);

    // Succès validés « Oui » par le créateur/admin (défaut : Non — fail-closed, on n'écrit rien sans confirmation).
    const [validatedSuccesses, setValidatedSuccesses] = useState<Set<string>>(new Set());

    function toggleSuccess(achievementId: string) {
        setValidatedSuccesses((prev) => {
            const next = new Set(prev);
            if (next.has(achievementId)) next.delete(achievementId);
            else next.add(achievementId);
            return next;
        });
    }

    // ── Membres supplémentaires (hors-post) ─────────────────────────────────
    const [allMembers, setAllMembers] = useState<GuildMember[]>([]);
    const [extraMembers, setExtraMembers] = useState<GuildMember[]>([]);
    const [search, setSearch] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Ferme la dropdown si on clique en dehors
    useEffect(() => {
        if (!dropdownOpen) return;
        function handler(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
                setSearch("");
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [dropdownOpen]);

    // Charge la liste des membres quand la modale s'ouvre
    useEffect(() => {
        if (!isOpen || allMembers.length > 0) return;
        setLoadingMembers(true);
        getDjGuildMembersForClose(guildId).then((res) => {
            if (res.success && res.data) setAllMembers(res.data);
            setLoadingMembers(false);
        });
    }, [isOpen, guildId, allMembers.length]);

    function toggle(profileId: string) {
        setValidated((prev) => {
            const next = new Set(prev);
            if (next.has(profileId)) next.delete(profileId);
            else next.add(profileId);
            return next;
        });
    }

    // IDs déjà dans la liste (formels + extra) pour éviter les doublons dans la dropdown
    const alreadyListedIds = new Set([
        post.profileId,
        ...acceptedParticipants.map((p) => p.profile.id),
        ...extraMembers.map((m) => m.id),
    ]);

    const filteredSuggestions = allMembers.filter(
        (m) => !alreadyListedIds.has(m.id) && m.name.toLowerCase().includes(search.toLowerCase())
    );

    function addExtra(member: GuildMember) {
        setExtraMembers((prev) => [...prev, member]);
        setValidated((prev) => new Set([...prev, member.id]));
        setSearch("");
        setDropdownOpen(false);
    }

    function removeExtra(id: string) {
        setExtraMembers((prev) => prev.filter((m) => m.id !== id));
        setValidated((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }

    // ── Points & clôture ────────────────────────────────────────────────────
    const dungeonLevel = post.dungeon?.level ?? null;
    const pts = getPointsFromLevel(dungeonLevel);

    function handleConfirm() {
        startTransition(async () => {
            // #138 — Succès cochés « Oui » uniquement (fail-closed par défaut).
            const successValidations = successItems
                .filter((s) => validatedSuccesses.has(s.achievementId))
                .map((s) => ({ dungeonId: s.dungeonId, achievementId: s.achievementId }));

            const res = adminMode
                ? await closeDjPost(guildId, post.id, successValidations, Array.from(validated))
                : await closeDjPostWithContributions(guildId, post.id, Array.from(validated), successValidations);

            if (res.success) {
                const count = validated.size;
                const successCount = successValidations.length;
                const successMsg = successCount > 0
                    ? ` 🏆 ${successCount} succès validé${successCount > 1 ? "s" : ""} pour le groupe.`
                    : "";
                if (adminMode) {
                    toast.success(`Post fermé.${successMsg}`);
                } else {
                    const awarded = (res as any).data?.pointsAwarded ?? pts;
                    toast.success(
                        `Groupe clôturé ! ${count} membre${count > 1 ? "s ont" : " a"} reçu +${awarded} point${awarded > 1 ? "s" : ""} de contribution.${successMsg}`
                    );
                }
                onClosed();
                onClose();
            } else {
                toast.error(res.error);
            }
        });
    }

    const title = post.mode === "DONJON" ? post.dungeon?.name : post.questName;
    const validatedCount = validated.size;
    const totalListCount = acceptedParticipants.length + extraMembers.length;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header glow */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

                        {/* Header */}
                        <div className="p-6 pb-4 border-b border-border bg-surface/30">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 shadow-inner flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-foreground">Clôturer le groupe</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">{title}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                            {/* Info banner */}
                            <div className="flex items-start gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3.5 py-3">
                                <Trophy className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-foreground leading-relaxed">
                                    Valide les membres qui ont <strong className="text-foreground">réellement participé</strong> pour leur attribuer{" "}
                                    <strong className="text-violet-300">+{pts} point{pts > 1 ? "s" : ""} de contribution</strong>.
                                    {post.dungeon && (
                                        <span className="ml-1 text-muted-foreground">(Donjon niveau {post.dungeon.level})</span>
                                    )}
                                    {" "}<span className="text-muted-foreground">Tu ne reçois pas de point en tant que créateur.</span>
                                </p>
                            </div>

                            {/* Participants inscrits */}
                            {totalListCount > 0 && (
                                <div className="space-y-2">
                                    <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">
                                        Participants ({acceptedParticipants.length} inscrit{acceptedParticipants.length > 1 ? "s" : ""}{extraMembers.length > 0 ? ` + ${extraMembers.length} ajouté${extraMembers.length > 1 ? "s" : ""}` : ""})
                                    </p>

                                    {/* Inscrits formels */}
                                    {acceptedParticipants.map((p) => {
                                        const isVal = validated.has(p.profile.id);
                                        return (
                                            <button
                                                key={p.profile.id}
                                                onClick={() => toggle(p.profile.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${isVal
                                                    ? "bg-success/10 border-success/30 shadow-inner"
                                                    : "bg-surface/40 border-border hover:bg-surface/60"
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                                                    {p.profile.user.image && (
                                                        <img src={p.profile.user.image} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-foreground truncate">
                                                        {p.profile.discordNickname || p.profile.pseudoDofus || (p.profile as any).dofusPseudo || "Membre"}
                                                    </p>
                                                    {p.classe && <p className="text-caption text-muted-foreground">{p.classe}</p>}
                                                </div>
                                                {isVal && (
                                                    <span className="flex items-center gap-1 text-caption font-black text-success bg-success/20 px-2 py-0.5 rounded-md border border-success/30">
                                                        <Star className="w-2.5 h-2.5" /> +{pts} pt{pts > 1 ? "s" : ""}
                                                    </span>
                                                )}
                                                {isVal
                                                    ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                                                    : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                                                }
                                            </button>
                                        );
                                    })}

                                    {/* Membres ajoutés manuellement */}
                                    {extraMembers.map((m) => {
                                        const isVal = validated.has(m.id);
                                        return (
                                            <div
                                                key={m.id}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border bg-warning/10 border-warning/30"
                                            >
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                                                    {m.image && <img src={m.image} alt="" className="w-full h-full object-cover" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-foreground truncate">{m.name}</p>
                                                    <p className="text-caption text-warning/70">Ajouté manuellement</p>
                                                </div>
                                                <button
                                                    onClick={() => toggle(m.id)}
                                                    className="shrink-0"
                                                >
                                                    {isVal
                                                        ? <CheckCircle2 className="w-5 h-5 text-success" />
                                                        : <Circle className="w-5 h-5 text-muted-foreground" />
                                                    }
                                                </button>
                                                <button
                                                    onClick={() => removeExtra(m.id)}
                                                    className="text-muted-foreground hover:text-danger transition-colors shrink-0"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Empty state quand aucun inscrit */}
                            {totalListCount === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                    <Circle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Aucun participant inscrit.</p>
                                    <p className="text-xs text-muted-foreground mt-1">Tu peux en ajouter ci-dessous.</p>
                                </div>
                            )}

                            {/* ── Ajouter un membre hors-liste ─────────────────────────────── */}
                            <div className="pt-2 border-t border-border" ref={dropdownRef}>
                                <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <UserPlus className="w-3 h-3" />
                                    Ajouter un participant hors-liste
                                </p>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDropdownOpen((v) => !v);
                                            setTimeout(() => searchRef.current?.focus(), 50);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface/60 border border-border rounded-xl text-sm text-muted-foreground hover:border-violet-500/40 hover:text-foreground transition-all"
                                    >
                                        <Search className="w-4 h-4 shrink-0" />
                                        <span className="flex-1 text-left truncate">
                                            {loadingMembers ? "Chargement…" : "Rechercher un membre de la guilde…"}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    <AnimatePresence>
                                        {dropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute z-10 top-full mt-1 w-full bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
                                            >
                                                <div className="p-2 border-b border-border">
                                                    <div className="flex items-center gap-2 px-2">
                                                        <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                                                        <input
                                                            ref={searchRef}
                                                            type="text"
                                                            value={search}
                                                            onChange={(e) => setSearch(e.target.value)}
                                                            placeholder="Nom du membre…"
                                                            className="flex-1 bg-transparent text-sm text-foreground placeholder-slate-600 outline-none py-1"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto">
                                                    {filteredSuggestions.length === 0 ? (
                                                        <p className="text-center text-xs text-muted-foreground py-4 italic">
                                                            {search ? "Aucun résultat" : "Tous les membres sont déjà listés"}
                                                        </p>
                                                    ) : (
                                                        filteredSuggestions.map((m) => (
                                                            <button
                                                                key={m.id}
                                                                type="button"
                                                                onClick={() => addExtra(m)}
                                                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors text-left"
                                                            >
                                                                <div className="w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0">
                                                                    {m.image && <img src={m.image} alt="" className="w-full h-full object-cover" />}
                                                                </div>
                                                                <span className="text-sm text-foreground font-medium truncate">{m.name}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* #138 — Validation des succès (obligatoire si le post porte des succès) */}
                            {successItems.length > 0 && (
                                <div className="pt-4 border-t border-border">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5">
                                            <Trophy className="w-3.5 h-3.5 text-warning" />
                                            Succès concernés — avez-vous validé ?
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setValidatedSuccesses(new Set())}
                                                className="text-caption font-bold text-muted-foreground hover:text-foreground underline underline-offset-2"
                                            >
                                                Tout Non
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setValidatedSuccesses(new Set(successItems.map((s) => s.achievementId)))}
                                                className="text-caption font-black text-warning hover:opacity-80"
                                            >
                                                Tout Oui
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                        {successItems.map((s) => {
                                            const isOk = validatedSuccesses.has(s.achievementId);
                                            return (
                                                <div key={s.achievementId} className="flex items-center justify-between gap-3 bg-surface/50 border border-border rounded-xl px-3 py-2.5">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{s.label}</p>
                                                        <p className="text-caption text-muted-foreground truncate">{s.dungeonName}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSuccess(s.achievementId)}
                                                            className={`px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wide transition-colors ${!isOk ? "bg-danger/10 border-danger/30 text-danger" : "border-border text-muted-foreground"}`}
                                                        >
                                                            Non
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSuccess(s.achievementId)}
                                                            className={`px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wide transition-colors ${isOk ? "bg-success/15 border-success/40 text-success" : "border-border text-muted-foreground"}`}
                                                        >
                                                            Oui
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-caption text-muted-foreground mt-2">
                                        Les succès cochés « Oui » seront écrits pour tous les présents (participants + toi). Les succès déjà validés ne sont pas ré-écrits.
                                    </p>
                                </div>
                            )}

                            {/* Summary */}
                            {!adminMode && validatedCount > 0 && (
                                <p className="text-caption text-muted-foreground text-center">
                                    <strong className="text-foreground">{validatedCount}</strong> membre{validatedCount > 1 ? "s" : ""} recevra{validatedCount > 1 ? "ont" : ""}{" "}
                                    <strong className="text-violet-300">+{pts} point{pts > 1 ? "s" : ""} de contribution</strong>
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 pt-4 flex gap-3 border-t border-border">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                disabled={isPending}
                                className="flex-1 border border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold max-h-12 h-12 transition-all"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={isPending}
                                className="flex-1 bg-violet-600 hover:bg-violet-500 text-foreground font-black max-h-12 h-12 shadow-md shadow-violet-900/20"
                            >
                                {isPending ? (
                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Clôture…</>
                                ) : (
                                    <><ShieldCheck className="w-5 h-5 mr-2" /> Confirmer</>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
