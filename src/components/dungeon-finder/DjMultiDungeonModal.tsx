"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import { Plus, Search, X, CheckCircle2, Trophy, CalendarClock, Swords } from "lucide-react";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";

type Dungeon = {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    isExpedition: boolean;
    achievements: {
        id: string;
        points: number;
        challenge: { id: string; name: string; iconUrl?: string | null };
    }[];
};

export type MultiDungeonSelection = {
    dungeon: Dungeon;
    achievements: string[];
    message: string;
    /** ISO string ou "" si non définie. */
    targetDate: string;
};

interface DjMultiDungeonModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Sélection initiale (retour de la modale) pour édition. */
    initial?: MultiDungeonSelection[];
    onConfirm: (selections: MultiDungeonSelection[]) => void;
}

const MAX_DUNGEONS = 5;
const MIN_DUNGEONS = 2;

export function DjMultiDungeonModal({ isOpen, onClose, initial, onConfirm }: DjMultiDungeonModalProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selections, setSelections] = useState<MultiDungeonSelection[]>(initial ?? []);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Charger le bestiaire à l'ouverture
    useEffect(() => {
        if (isOpen && dungeons.length === 0) {
            setLoading(true);
            getDungeonsWithAchievements()
                .then(res => { if (res.success && res.data) setDungeons(res.data as Dungeon[]); })
                .catch(() => toast.error("Impossible de charger les donjons"))
                .finally(() => setLoading(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Réinitialiser quand on rouvre sans sélection initiale
    useEffect(() => {
        if (isOpen && !initial) setSelections([]);
    }, [isOpen, initial]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return dungeons;
        return dungeons.filter(d => d.name.toLowerCase().includes(q) || d.bossName.toLowerCase().includes(q));
    }, [dungeons, search]);

    const selectedIds = useMemo(() => new Set(selections.map(s => s.dungeon.id)), [selections]);

    function toggleDungeon(d: Dungeon) {
        if (selectedIds.has(d.id)) {
            setSelections(prev => prev.filter(s => s.dungeon.id !== d.id));
            if (expandedId === d.id) setExpandedId(null);
            return;
        }
        if (selections.length >= MAX_DUNGEONS) {
            toast.error(`Maximum ${MAX_DUNGEONS} donjons par publication.`);
            return;
        }
        setSelections(prev => [...prev, { dungeon: d, achievements: [], message: "", targetDate: "" }]);
        setExpandedId(d.id);
    }

    function updateSelection(id: string, patch: Partial<Pick<MultiDungeonSelection, "achievements" | "message" | "targetDate">>) {
        setSelections(prev => prev.map(s => s.dungeon.id === id ? { ...s, ...patch } : s));
    }

    function toggleAchievement(id: string, achId: string) {
        setSelections(prev => prev.map(s => {
            if (s.dungeon.id !== id) return s;
            const has = s.achievements.includes(achId);
            return { ...s, achievements: has ? s.achievements.filter(a => a !== achId) : [...s.achievements, achId] };
        }));
    }

    function handleConfirm() {
        if (selections.length < MIN_DUNGEONS) {
            toast.error(`Sélectionne au moins ${MIN_DUNGEONS} donjons.`);
            return;
        }
        onConfirm(selections);
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="!z-[140] w-[min(95vw,42rem)] max-w-[42rem] sm:min-w-[34rem] bg-background border border-border rounded-2xl text-foreground max-h-[90vh] overflow-y-auto premium-scrollbar">
                <DialogHeader className="border-b border-border p-5">
                    <DialogTitle className="flex items-center gap-3 text-lg font-black">
                        <div className="w-9 h-9 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                            <span className="block">Multi-donjons</span>
                            <span className="block text-caption text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                                {MIN_DUNGEONS} à {MAX_DUNGEONS} donjons — un seul message Discord, un seul ping
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <div className="p-5 space-y-5">
                    {/* Recherche */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher un donjon ou un boss…"
                            className="w-full h-11 bg-surface/60 border border-border rounded-xl pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/40"
                        />
                    </div>

                    {/* Grille des donjons (multi-sélection) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">Choisis tes donjons</p>
                            <span className="text-caption font-black text-muted-foreground tabular-nums">{selections.length}/{MAX_DUNGEONS}</span>
                        </div>
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground bg-surface/30 rounded-2xl border border-border">Consultation du bestiaire…</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                                {filtered.map((d) => {
                                    const isSelected = selectedIds.has(d.id);
                                    const atLimit = selections.length >= MAX_DUNGEONS && !isSelected;
                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            disabled={atLimit}
                                            onClick={() => toggleDungeon(d)}
                                            className={`w-full text-left flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                                                isSelected
                                                    ? "bg-warning/10 border-warning/40"
                                                    : "bg-surface/40 border-border hover:border-border-strong " + (atLimit ? "opacity-40 cursor-not-allowed" : "")
                                            }`}
                                        >
                                            <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? "bg-warning border-warning" : "border-border"}`}>
                                                {isSelected && <CheckCircle2 className="w-3 h-3 text-foreground" />}
                                            </span>
                                            {d.imageUrl ? (
                                                <span className="w-9 h-9 rounded-lg overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
                                                    <img src={d.imageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                                                </span>
                                            ) : (
                                                <span className="w-9 h-9 rounded-lg bg-background border border-border shrink-0 flex items-center justify-center text-muted-foreground">
                                                    <Swords className="w-4 h-4" />
                                                </span>
                                            )}
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-xs font-bold text-foreground truncate">{d.name}</span>
                                                <span className="block text-caption text-muted-foreground">Niv. {d.level} — {d.bossName}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Configuration par donjon sélectionné */}
                    {selections.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">Succès, date & note par donjon</p>
                            {selections.map((s) => (
                                <div key={s.dungeon.id} className="rounded-2xl border border-border bg-surface/30 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(expandedId === s.dungeon.id ? null : s.dungeon.id)}
                                        className="w-full flex items-center gap-2 p-3 text-left"
                                    >
                                        {s.dungeon.imageUrl ? (
                                            <span className="w-9 h-9 rounded-lg overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
                                                <img src={s.dungeon.imageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                                            </span>
                                        ) : (
                                            <span className="w-9 h-9 rounded-lg bg-background border border-border shrink-0 flex items-center justify-center text-muted-foreground">
                                                <Swords className="w-4 h-4" />
                                            </span>
                                        )}
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-xs font-bold text-foreground">{s.dungeon.name}</span>
                                            <span className="block text-caption text-muted-foreground">
                                                {s.achievements.length} succès
                                                {s.targetDate ? ` · ${new Date(s.targetDate).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : ""}
                                                {s.message ? " · note" : ""}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleDungeon(s.dungeon); }}
                                            className="text-muted-foreground hover:text-danger"
                                            title="Retirer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </button>

                                    {expandedId === s.dungeon.id && (
                                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
                                            {/* Succès */}
                                            <div>
                                                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                    <Trophy className="w-3 h-3" /> Succès visés
                                                </p>
                                                {s.dungeon.achievements.length === 0 ? (
                                                    <p className="text-caption text-muted-foreground">Aucun succès connu pour ce donjon.</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                        {s.dungeon.achievements.map((a) => {
                                                            const isOn = s.achievements.includes(a.id);
                                                            return (
                                                                <button
                                                                    key={a.id}
                                                                    type="button"
                                                                    onClick={() => toggleAchievement(s.dungeon.id, a.id)}
                                                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-caption font-bold border transition-colors ${
                                                                        isOn
                                                                            ? "bg-warning/15 border-warning/40 text-warning"
                                                                            : "bg-surface border-border text-muted-foreground hover:border-border-strong"
                                                                    }`}
                                                                >
                                                                    {a.challenge.iconUrl && (
                                                                        <img src={a.challenge.iconUrl} alt="" className="w-3.5 h-3.5 object-contain rounded" />
                                                                    )}
                                                                    {a.challenge.name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>


                                            {/* Date — OPTIONNELLE (heure facultative) */}
                                            <div className="space-y-1.5">
                                                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                    <CalendarClock className="w-3 h-3" /> Date prévue <span className="text-muted-foreground normal-case font-medium">(optionnelle — heure facultative)</span>
                                                </p>
                                                <DateTimePicker
                                                    value={s.targetDate}
                                                    onChange={(v) => updateSelection(s.dungeon.id, { targetDate: v })}
                                                    minDate={new Date()}
                                                    placeholder="Sans date (publié directement)"
                                                    timeOptional={true}
                                                />
                                            </div>
                                            {/* Note */}
                                            <textarea
                                                value={s.message}
                                                onChange={(e) => updateSelection(s.dungeon.id, { message: e.target.value })}
                                                placeholder="Note pour ce donjon (ex: succès précis, stuff requis…)"
                                                maxLength={500}
                                                className="w-full bg-surface/60 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/30"
                                                rows={2}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-border p-4 flex items-center justify-between gap-3">
                    <span className="text-caption text-muted-foreground font-bold">
                        {selections.length} donjon{selections.length > 1 ? "s" : ""} sélectionné{selections.length > 1 ? "s" : ""} — minimum {MIN_DUNGEONS}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose} className="h-10 px-4 rounded-xl text-xs font-black text-muted-foreground hover:text-foreground">
                            Annuler
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selections.length < MIN_DUNGEONS}
                            className="h-10 px-5 rounded-xl text-xs font-black bg-warning hover:bg-warning text-warning-foreground uppercase tracking-wider"
                        >
                            Confirmer ({selections.length})
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
