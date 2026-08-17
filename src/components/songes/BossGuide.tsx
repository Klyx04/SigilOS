"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, Star, Swords, Shield, Wind, BookOpen, Lightbulb, ChevronDown, ExternalLink, Dice5 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface BossData {
    Id: number;
    Name: string;
    Image: string;
    Difficulty: number;
    ImmediateFocus: number;
    Evasion: number;
    Tanking: number;
    Information: string;
    Mechanic?: string | null;
    Advice: string;
    InformationShort?: string | null;
    MechanicShort?: string | null;
    AdviceShort?: string | null;
    Illustration?: string | null;
    Caption?: string | null;
}

// ============================================
// VIABILITY BAR
// ============================================

function ViabilityBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        "h-4 w-3 rounded-sm transition-all duration-300",
                        i < value ? "" : "bg-surface"
                    )}
                    style={i < value ? { backgroundColor: color } : undefined}
                />
            ))}
        </div>
    );
}

// ============================================
// DIFFICULTY STARS
// ============================================

function DifficultyStars({ difficulty }: { difficulty: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
                <Star
                    key={i}
                    className={cn(
                        "w-3.5 h-3.5 transition-all",
                        i < difficulty
                            ? "text-warning fill-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.5)]"
                            : "text-foreground/15"
                    )}
                />
            ))}
        </div>
    );
}

// ============================================
// MARKDOWN-LIKE RENDERER (simple)
// ============================================

import { sanitizeHtml } from "@/lib/security";

function renderMarkdown(text: string) {
    if (!text) return null;
    // Split into lines
    const lines = text.trim().split("\n").filter(l => l.trim());
    return (
        <ul className="space-y-1.5 text-sm leading-relaxed">
            {lines.map((line, i) => {
                let content = line.replace(/^-\s*/, "").trim();
                // Bold: **text**
                content = content.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
                // Underline: <u>text</u>
                content = content.replace(/<u>(.*?)<\/u>/g, '<span class="underline decoration-amber-400/60">$1</span>');
                // Italic: *text*
                content = content.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="text-foreground/50 not-italic text-xs">$1</em>');

                const safeContent = sanitizeHtml(content) || "";

                return (
                    <li key={i} className="flex items-start gap-2">
                        <span className="text-foreground/40 mt-1 shrink-0">•</span>
                        {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml */}
                        <span dangerouslySetInnerHTML={{ __html: safeContent }} />
                    </li>
                );
            })}
        </ul>
    );
}

// ============================================
// CONSTANTS
// ============================================

const WIDTH_EXCEPTIONS: Record<string, string> = {
    "Bethel Akarna": "max-w-4xl",
    "Comte Harebourg": "max-w-4xl",
    "Corruption": "max-w-6xl",
    "Éternel Conflit": "max-w-5xl",
    "Guerre": "max-w-5xl",
    "Reine des Voleurs": "max-w-6xl",
    "Servitude": "max-w-5xl",
    "Vortex": "max-w-6xl",
    "Dremoan": "max-w-6xl",
    "Mekamouth": "max-w-5xl",
    "Cire Momore": "max-w-5xl",
    "Tal Kasha": "max-w-5xl",
    "Déchireuse Perturbé": "max-w-4xl",
    "Solar": "max-w-4xl",
    "Ilyzaelle": "max-w-4xl"
};

// ============================================
// BOSS CARD (Detail View)
// ============================================

function BossDetail({ boss, shortVersion }: { boss: BossData; shortVersion: boolean }) {
    const info = (shortVersion && boss.InformationShort) ? boss.InformationShort : boss.Information;
    const mechanic = (shortVersion && boss.MechanicShort) ? boss.MechanicShort : boss.Mechanic;
    const advice = (shortVersion && boss.AdviceShort) ? boss.AdviceShort : boss.Advice;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Boss Header */}
            <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                {/* Boss Image & Viability Bars Group */}
                <div className="flex items-start gap-4 shrink-0">
                    {/* Boss Image */}
                    <div className="relative">
                        <div className="w-24 h-24 rounded-xl border border-border bg-black/40 overflow-hidden shadow-lg shadow-black/30">
                            <img
                                src={`/images/songes-bosses/${boss.Image}`}
                                alt={boss.Name}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    </div>

                    {/* Bars (Mobile or Small Layout) */}
                    <div className="md:hidden space-y-1.5 mt-1">
                        <div className="flex items-center gap-2">
                            <Swords className="w-3.5 h-3.5 text-danger" />
                            <ViabilityBar value={boss.ImmediateFocus} color="#f87171" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Wind className="w-3.5 h-3.5 text-info" />
                            <ViabilityBar value={boss.Evasion} color="#60a5fa" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-success" />
                            <ViabilityBar value={boss.Tanking} color="#34d399" />
                        </div>
                    </div>
                </div>

                {/* Name + Difficulty + Bars (Desktop Layout) */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight truncate">{boss.Name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-caption uppercase tracking-wider text-foreground/30 font-bold">Difficulté</span>
                        <DifficultyStars difficulty={boss.Difficulty} />
                    </div>

                    {/* Viability Bars (Desktop) */}
                    <div className="hidden md:block mt-3 space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 w-16 shrink-0">
                                <Swords className="w-3.5 h-3.5 text-danger" />
                                <span className="text-caption uppercase tracking-wider text-foreground/40">Focus</span>
                            </div>
                            <ViabilityBar value={boss.ImmediateFocus} color="#f87171" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 w-16 shrink-0">
                                <Wind className="w-3.5 h-3.5 text-info" />
                                <span className="text-caption uppercase tracking-wider text-foreground/40">Esquive</span>
                            </div>
                            <ViabilityBar value={boss.Evasion} color="#60a5fa" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 w-16 shrink-0">
                                <Shield className="w-3.5 h-3.5 text-success" />
                                <span className="text-caption uppercase tracking-wider text-foreground/40">Tank</span>
                            </div>
                            <ViabilityBar value={boss.Tanking} color="#34d399" />
                        </div>
                    </div>
                </div>

                {/* Illustration (if exists) */}
                {boss.Illustration && (
                    <div className="shrink-0 w-full md:w-auto md:max-w-[200px] space-y-2">
                        <div className="rounded-xl border border-border bg-black/40 overflow-hidden shadow-lg aspect-auto md:aspect-square flex items-center justify-center">
                            <img
                                src={`/images/songes-bosses/${boss.Illustration}`}
                                alt="Illustration"
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                        {boss.Caption && (
                            <p className="text-caption text-foreground/30 text-center leading-tight italic">
                                {boss.Caption}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    {/* Information Panel */}
                    <div className="rounded-xl border border-info/20 bg-info/5 p-4 h-fit">
                        <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-info" />
                            <span className="text-xs font-bold uppercase tracking-wider text-info">Informations</span>
                        </div>
                        <div className="text-foreground/70 overflow-hidden">
                            {renderMarkdown(info)}
                        </div>
                    </div>

                    {/* Mechanic Panel */}
                    {mechanic && (
                        <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 h-fit">
                            <div className="flex items-center gap-2 mb-2">
                                <Swords className="w-4 h-4 text-warning" />
                                <span className="text-xs font-bold uppercase tracking-wider text-warning">Mécaniques</span>
                            </div>
                            <div className="text-foreground/70 overflow-hidden">
                                {renderMarkdown(mechanic)}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {/* Advice Panel */}
                    <div className="rounded-xl border border-success/20 bg-success/5 p-4 h-fit">
                        <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-success" />
                            <span className="text-xs font-bold uppercase tracking-wider text-success">Conseils</span>
                        </div>
                        <div className="text-foreground/70 overflow-hidden">
                            {renderMarkdown(advice)}
                        </div>
                    </div>

                    {/* Dofensive Link */}
                    <a
                        href={`https://dofensive.com/fr/monster/${boss.Id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-surface text-foreground/60 hover:bg-surface hover:text-foreground transition-all text-sm font-medium group mt-auto"
                    >
                        <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        Besoin de détails ? (Dofensive)
                    </a>
                </div>
            </div>
        </div>
    );
}

// ============================================
// MAIN: BOSS GUIDE COMPONENT
// ============================================

export function BossGuide({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [bosses, setBosses] = useState<BossData[]>([]);
    const [search, setSearch] = useState("");
    const [selectedBoss, setSelectedBoss] = useState<BossData | null>(null);
    const [shortVersion, setShortVersion] = useState(false);
    const [loading, setLoading] = useState(true);
    const searchRef = useRef<HTMLInputElement>(null);

    // Load boss data
    useEffect(() => {
        if (!isOpen) return;
        fetch("/data/songes-bosses.json")
            .then(r => r.json())
            .then((data: BossData[]) => {
                setBosses(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [isOpen]);

    // Focus search on open
    useEffect(() => {
        if (isOpen && searchRef.current) {
            setTimeout(() => searchRef.current?.focus(), 200);
        }
    }, [isOpen]);

    // Filtered bosses
    const filtered = useMemo(() => {
        if (!search.trim()) return [];
        const q = search.toLowerCase().trim();
        return bosses
            .filter(b => b.Name.toLowerCase().includes(q))
            .slice(0, 15);
    }, [search, bosses]);

    // Random boss
    const randomBoss = () => {
        if (bosses.length === 0) return;
        const idx = Math.floor(Math.random() * bosses.length);
        setSelectedBoss(bosses[idx]);
        setSearch("");
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={cn(
                "relative w-full max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col transition-all duration-300",
                selectedBoss ? (WIDTH_EXCEPTIONS[selectedBoss.Name] || "max-w-2xl") : "max-w-2xl"
            )}>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xl border-b border-border px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-warning/10 border border-warning/20">
                                <BookOpen className="w-6 h-6 text-warning" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-foreground tracking-tight">Guide des Boss</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Songes Pour Les Noobs — par Volcasaurus</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-surface hover:bg-surface text-foreground/50 hover:text-foreground transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/30" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Rechercher un boss..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setSelectedBoss(null); }}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface border border-border text-foreground text-base placeholder:text-foreground/30 focus:outline-none focus:border-warning/40 focus:ring-1 focus:ring-warning/20 transition-all"
                        />
                        {search && (
                            <button
                                onClick={() => { setSearch(""); setSelectedBoss(null); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between mt-3">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={shortVersion}
                                onChange={e => setShortVersion(e.target.checked)}
                                className="rounded border-border-strong bg-surface text-warning focus:ring-warning/30 w-4 h-4"
                            />
                            <span className="text-sm text-foreground/40 group-hover:text-foreground/60 transition-colors">Version courte</span>
                        </label>
                        <button
                            onClick={randomBoss}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 hover:text-warning transition-all text-sm font-medium"
                        >
                            <Dice5 className="w-4 h-4" />
                            Boss aléatoire
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-warning/30 border-t-amber-400 rounded-full animate-spin" />
                        </div>
                    ) : selectedBoss ? (
                        <>
                            <button
                                onClick={() => setSelectedBoss(null)}
                                className="text-sm text-foreground/40 hover:text-foreground/70 mb-4 flex items-center gap-1 transition-colors"
                            >
                                ← Retour aux résultats
                            </button>
                            <BossDetail boss={selectedBoss} shortVersion={shortVersion} />
                        </>
                    ) : search.trim() && filtered.length > 0 ? (
                        <div className="space-y-1">
                            {filtered.map(boss => (
                                <button
                                    key={boss.Id}
                                    onClick={() => setSelectedBoss(boss)}
                                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-surface transition-all text-left group"
                                >
                                    <div className="w-12 h-12 rounded-xl border border-border bg-black/40 overflow-hidden shrink-0">
                                        <img
                                            src={`/images/songes-bosses/${boss.Image}`}
                                            alt={boss.Name}
                                            className="w-full h-full object-contain p-0.5"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-base font-semibold text-foreground/80 group-hover:text-foreground truncate">{boss.Name}</div>
                                        <DifficultyStars difficulty={boss.Difficulty} />
                                    </div>
                                    <ChevronDown className="w-5 h-5 text-foreground/20 -rotate-90 group-hover:text-warning transition-colors" />
                                </button>
                            ))}
                        </div>
                    ) : search.trim() ? (
                        <div className="text-center py-20 text-foreground/30 text-sm">
                            Aucun boss trouvé pour « {search} »
                        </div>
                    ) : (
                        <div className="text-center py-20 space-y-4">
                            <BookOpen className="w-16 h-16 text-foreground/10 mx-auto" />
                            <div>
                                <p className="text-foreground/40 text-base font-medium">Cherche un boss pour voir sa fiche</p>
                                <p className="text-foreground/20 text-sm mt-1">144 boss référencés</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
