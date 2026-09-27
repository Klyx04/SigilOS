"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    X, Sword, Users, Trophy, ChevronDown, CheckCircle2, Circle, Info, Loader2,
    MapPin, Crown, ChevronRight, AlertTriangle, BookOpen, Sparkles, ShieldAlert,
    ArrowUpRight
} from "lucide-react";
import { getDungeonDirectory } from "@/server/actions/dungeon-finder-actions";
import { searchDungeons } from "@/server/actions/game-data-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getClass } from "@/lib/dofus-assets";

interface Dungeon {
    id: string | number;
    name: any;
    bossName: string;
    level: number;
    imageUrl?: string | null;
}

interface AchievementDirectory {
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    points: number;
    hasCompleted: { id: string; name: string; imageUrl: string | null; classe: string | null }[];
    missing: { id: string; name: string; imageUrl: string | null; classe: string | null }[];
}

interface DungeonDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    dungeons: Dungeon[];
    guildId?: string;
    isPublic?: boolean;
}

interface RaidBossStrat {
    id: number | string;
    title: string;
    bossName: string;
    floor: string;
    coords: string;
    imageUrl: string;
    points: string;
    tag: string;
    description: string;
    mechanics: { label: string; desc: string; danger?: boolean }[];
    strategy: string[];
    tips: string[];
    guideSlug: string;
}

const RAID_BOSSES: Record<string | number, RaidBossStrat> = {
    1183118: {
        id: 1183118,
        title: "Gouffre du Gigalodon — Avant-poste",
        bossName: "Avant-poste des Explorateurs",
        floor: "Étage -1",
        coords: "[3, 2]",
        imageUrl: "/images/guides/gigalodon/04-coffre-du-raid.jpg",
        points: "Dépôt des récoltes & fragments",
        tag: "Hub Logistique",
        description: "Camp de base des explorateurs du gouffre. Point de départ, de ravitaillement et de dépôt de toutes vos ressources minées et fragments.",
        mechanics: [
            { label: "18 Groupes de monstres", desc: "Nettoyer l'avant-poste en 3 escouades de 4 joueurs pour ouvrir les accès rapidement." },
            { label: "Filons de sel marin", desc: "Miner le sel marin pour alimenter les luminomachines nécessaires à la descente." },
            { label: "Palier 10 000 points (Crucial)", desc: "Déposer impérativement les récoltes au coffre dès le début pour faire passer le taux de drop des fragments de 5% à 20% !", danger: true }
        ],
        strategy: [
            "Scindez l'équipe en 3 groupes de 4 dès l'entrée.",
            "Nettoyez les salles en parallèle pour récolter le sel marin sur les filons.",
            "Ne descendez pas aux étages inférieurs sans avoir déposé au coffre pour activer le bonus de 20% de drop !"
        ],
        tips: [
            "Le PNJ marchande propose des potions et buffs de résistances très utiles pour les étages abyssaux.",
            "Gardez toujours 1 joueur mobile pour courir déposer au coffre sans bloquer les autres combats."
        ],
        guideSlug: "raid-gigalodon-dofus-guide"
    },
    1183119: {
        id: 1183119,
        title: "Mureine des Abysses",
        bossName: "Mureine",
        floor: "Étage -2",
        coords: "[4, 7]",
        imageUrl: "/images/guides/gigalodon/46-boss-mureine.jpg",
        points: "+10 000 pts",
        tag: "Boss de Palier",
        description: "Anguille titanesque des grands fonds. Dégâts colossaux en ligne droite et debuff sévère de caractéristiques.",
        mechanics: [
            { label: "Niveau 4 Requis", desc: "Ne JAMAIS lancer le combat avant que le raid n'ait atteint le niveau 4 de progression !", danger: true },
            { label: "Frénésie & Debuff de masse", desc: "Applique un lourd malus de puissance et tape très fort en ligne et en zone.", danger: true },
            { label: "Fragment 2 du Coffre", desc: "Vaincre la Mureine octroie le 2ème fragment nécessaire à l'ouverture du Gigalodon.", danger: false }
        ],
        strategy: [
            "Méthode Tank : Bloquez la Mureine dans un coin avec un Pandawa tank et des invocations.",
            "Méthode Distance : Maintenez le boss à plus de 10 PO avec un retrait PM continu (Cra / Enutrof).",
            "Éliminez en priorité les monstres d'accompagnement (Murare) pour éviter les surprises."
        ],
        tips: [
            "Équipez des résistances Eau et Terre solides sur le personnage au corps à corps.",
            "Le retrait PM neutralise presque entièrement son potentiel offensif."
        ],
        guideSlug: "raid-gigalodon-dofus-guide"
    },
    1183120: {
        id: 1183120,
        title: "Exécrabe le Fouisseur",
        bossName: "Exécrabe",
        floor: "Étage -4",
        coords: "[9, 11]",
        imageUrl: "/images/guides/gigalodon/71-boss-execrabe.jpg",
        points: "+10 000 pts",
        tag: "Boss & Énigme",
        description: "Crustacé géant fouisseur. La clé de sa défaite réside dans l'observation attentive de ses mutations.",
        mechanics: [
            { label: "ORDRE DES 4 FORMES (Impératif)", desc: "Notez ABSOLUMENT l'ordre d'apparition des 4 formes d'Exécrabe durant le combat ! Cet ordre est INDISPENSABLE pour activer les statues sous le lac et déverrouiller le raccourci vers l'étage -5.", danger: true },
            { label: "Carapace Blindée", desc: "Réduction massive des dommages subis lorsqu'il rentre dans sa carapace.", danger: false },
            { label: "Fragment 3 du Coffre", desc: "Octroie le 3ème fragment de clé du raid.", danger: false }
        ],
        strategy: [
            "Désignez 1 joueur pour noter l'ordre des formes au fur et à mesure (ex: Étoile → Carré → Cercle → Triangle).",
            "Déplacez le boss hors de ses glyphes pour pouvoir lui infliger des dégâts optimaux.",
            "Dès la sortie de sa carapace, lancez vos plus gros sorts de burst avec érosion."
        ],
        tips: [
            "Dès la victoire, foncez activer les 4 statues immergées sous le lac dans l'ordre noté.",
            "L'activation réussie ouvre la trappe raccourci direct vers l'étage -5 !"
        ],
        guideSlug: "raid-gigalodon-dofus-guide"
    },
    1183121: {
        id: 1183121,
        title: "Willorque des Profondeurs",
        bossName: "Willorque",
        floor: "Étage -6",
        coords: "[11, 16]",
        imageUrl: "/images/guides/gigalodon/103-boss-willorque.jpg",
        points: "+10 000 pts",
        tag: "Boss Abyssal",
        description: "Monstre mythique régnant dans le noir absolu des profondeurs abyssales. Combat exigeant une discipline de fer.",
        mechanics: [
            { label: "NOIR TOTAL (Vision Réduite)", desc: "Vision drastiquement limitée sur toute l'arène. Impossible de cibler ou soigner des alliés éloignés !", danger: true },
            { label: "Invocations d'Orques Spectres", desc: "Invoque des créatures causant de lourds dégâts en pourcentage d'érosion à chaque tour.", danger: true },
            { label: "Fragment 4 du Coffre", desc: "Dernier fragment requis pour affronter le Gigalodon !", danger: false }
        ],
        strategy: [
            "Cheese Pandawa : Bloquez Willorque dans un angle avec un Pandawa tank et des invocations statiques (Cawotte / Chafer).",
            "Restez groupés à mi-distance (4-6 PO) pour garder vos lignes de vue malgré le Noir Total.",
            "Éliminez immédiatement les orques spectres dès leur apparition pour ne pas accumuler d'érosion mortelle."
        ],
        tips: [
            "Les sorts sans ligne de vue et les sorts de zone sont rois dans ce combat.",
            "Une fois Willorque vaincu, retournez à l'avant-poste (-1) pour déposer les 4 fragments au coffre et lancer le combat final !"
        ],
        guideSlug: "raid-gigalodon-dofus-guide"
    },
    1183122: {
        id: 1183122,
        title: "Gigalodon le Léviathan",
        bossName: "Gigalodon",
        floor: "Coffre -1",
        coords: "[3, 2]",
        imageUrl: "/images/guides/gigalodon/118-boss-gigalodon.jpg",
        points: "+15 000 pts (Score max)",
        tag: "Boss Ultime",
        description: "Le Léviathan ancestral du gouffre. Phase de burst chronométrée en 3 tours pour infliger un maximum de dégâts et scorer.",
        mechanics: [
            { label: "NE JAMAIS ÊTRE DEVANT LA GUEULE", desc: "Les 3 cases face à sa gueule déclenchent l'engloutissement immédiat : mort définitive du personnage sans réanimation possible !", danger: true },
            { label: "ESPACEMENT DE 3 CASES ENTRE ALLIÉS", desc: "Le sort Gigarâle se propage par rebond et inflige 700 points de dégâts par allié à portée de 2 cases.", danger: true },
            { label: "ESQUIVE DANS LES DIAGONALES", desc: "Positionnez-vous strictement dans ses diagonales pour éviter les cônes de souffle Ultrasplash et Tournageoire.", danger: false }
        ],
        strategy: [
            "Tour 1 : Placement rigoureux en diagonales, application des buffs de puissance et vulnérabilités.",
            "Tour 2 : Déchaînement du burst maximal (armes, sorts à gros dégâts, érosion).",
            "Tour 3 : Dernier round de frappes avant la fin automatique du combat."
        ],
        tips: [
            "100K dégâts = +5 000 pts · 250K = +9 000 pts · 500K = +12 000 pts · 1M dégâts = +15 000 pts (Score Parfait).",
            "Maximisez les multiplicateurs de dégâts de groupe (Vulnérabilité Panda, Masque Psychopathe Zobal, etc.)."
        ],
        guideSlug: "raid-gigalodon-dofus-guide"
    }
};

export function DungeonDetailModal({ isOpen, onClose, dungeons, guildId, isPublic = false }: DungeonDetailModalProps) {
    const [selectedDungeonIndex, setSelectedDungeonIndex] = useState(0);
    const [directoryData, setDirectoryData] = useState<AchievementDirectory[]>([]);
    const [resolvedDj, setResolvedDj] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expandedAchv, setExpandedAchv] = useState<string | null>(null);
    // #175 — popup de blocage quand le DJ n'est pas répertorié dans le module Donjons & Quêtes.
    const [djNotListedOpen, setDjNotListedOpen] = useState(false);

    const dungeon = dungeons[selectedDungeonIndex];
    const isOcreQuest = !!(dungeon as any).__isOcreQuest;
    const canShowGuildMembers = !isPublic && !!guildId;

    useEffect(() => {
        if (isOpen && dungeon) {
            setLoading(true);
            setDirectoryData([]);
            setExpandedAchv(null);
            setResolvedDj(null);
            
            const dName = typeof dungeon.name === 'string' ? dungeon.name : dungeon.name?.fr;
            
            // Resolve real DJ info for official boss name, image, etc.
            const djPromise = searchDungeons(dName || dungeon.id.toString()).then(res => {
                if (res.success && res.data && res.data.length > 0) {
                    const first = res.data[0];
                    setResolvedDj(first);
                    // Si public, peupler les succès avec les données du donjon sans membres
                    if (!canShowGuildMembers && first.achievements?.length > 0) {
                        setDirectoryData(first.achievements.map((a: any) => ({
                            achievementId: a.id,
                            achievementName: a.challenge?.name || a.name || "Succès",
                            iconUrl: a.challenge?.iconUrl || null,
                            points: a.points || 10,
                            hasCompleted: [],
                            missing: []
                        })));
                    }
                }
            });

            if (canShowGuildMembers && guildId) {
                getDungeonDirectory(guildId, dungeon.id.toString(), dName).then((res) => {
                    if (res.success && res.data) {
                        setDirectoryData(res.data);
                        if (res.data.length > 0) {
                            setExpandedAchv(res.data[0].achievementId);
                        }
                    }
                    setLoading(false);
                }).catch(() => setLoading(false));
            } else {
                djPromise.finally(() => setLoading(false));
            }
        }
    }, [isOpen, dungeon, guildId, canShowGuildMembers]);

    if (!isOpen || !dungeon) return null;

    const dName = typeof dungeon?.name === 'string' ? dungeon.name : dungeon?.name?.fr || "";
    const raidBossInfo = dungeon ? (RAID_BOSSES[dungeon.id] || Object.values(RAID_BOSSES).find(rb =>
        dName.toLowerCase().includes(rb.bossName.toLowerCase()) ||
        dName.toLowerCase().includes(rb.title.toLowerCase())
    )) : undefined;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false} 
                className="w-[95vw] max-w-2xl bg-[#0a0f18] border border-border shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-[2rem] md:rounded-[2.5rem] text-foreground overflow-hidden p-0 gap-0 flex flex-col h-[min(750px,85vh)]"
            >
                
                {/* Header with Background Image */}
                <div className="relative h-48 bg-background border-b border-border overflow-hidden shrink-0">
                    {(raidBossInfo?.imageUrl || resolvedDj?.imageUrl || dungeon.imageUrl) && (
                        <motion.img 
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 0.35 }}
                            src={raidBossInfo?.imageUrl || resolvedDj?.imageUrl || dungeon.imageUrl} 
                            alt="" 
                            className="absolute inset-0 w-full h-full object-cover" 
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f18] via-[#0a0f18]/50 to-transparent" />
                    
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-xl bg-surface hover:bg-surface border border-border text-foreground/50 hover:text-foreground transition-all z-20"
                    >
                        <X size={20} />
                    </button>

                    <div className="absolute bottom-6 left-6 right-6 md:left-8 md:right-8 flex items-end justify-between gap-4 z-10">
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-surface/80 border border-border shadow-2xl overflow-hidden flex items-center justify-center shrink-0">
                                {(raidBossInfo?.imageUrl || resolvedDj?.imageUrl || dungeon.imageUrl) ? (
                                    <img src={raidBossInfo?.imageUrl || resolvedDj?.imageUrl || dungeon.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Sword className="w-8 h-8 text-muted-foreground" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 md:gap-3 mb-1 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-500 text-caption font-black uppercase tracking-widest italic">
                                        Lvl {resolvedDj?.level || dungeon.level || 200}
                                    </span>
                                    {raidBossInfo && (
                                        <span className="px-2 py-0.5 rounded-lg bg-[#7c3aed]/20 border border-[#7c3aed]/40 text-[#a78bfa] text-caption font-black uppercase tracking-widest italic">
                                            {raidBossInfo.floor}
                                        </span>
                                    )}
                                    {raidBossInfo && (
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-caption font-black uppercase tracking-widest italic">
                                            {raidBossInfo.points}
                                        </span>
                                    )}
                                    {isOcreQuest && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-caption font-black uppercase tracking-widest italic">
                                            <img src="/module-dofus/Dofus_Ocre.png" alt="" className="w-3 h-3 object-contain" />
                                            Quête Ocre
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-lg md:text-2xl font-black text-foreground truncate drop-shadow-2xl uppercase italic tracking-tighter">
                                    {raidBossInfo?.title || resolvedDj?.name || (typeof dungeon.name === 'string' ? dungeon.name : dungeon.name?.fr || "Donjon")}
                                </h2>
                                <p className="text-caption md:text-sm font-bold text-foreground/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                                    <Sword size={12} className="text-amber-500" /> {raidBossInfo ? `${raidBossInfo.bossName} · ${raidBossInfo.coords}` : (resolvedDj?.bossName || "Boss Inconnu")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation if multiple dungeons */}
                {dungeons.length > 1 && (
                    <div className="flex bg-black/40 border-b border-border p-2 gap-2 overflow-x-auto custom-scrollbar">
                        {dungeons.map((d, idx) => (
                            <button
                                key={d.id}
                                onClick={() => setSelectedDungeonIndex(idx)}
                                className={`px-4 py-2 rounded-xl text-caption font-black uppercase italic transition-all whitespace-nowrap ${
                                    selectedDungeonIndex === idx 
                                        ? "bg-amber-600 text-warning-foreground shadow-lg shadow-amber-600/20" 
                                        : "bg-surface text-foreground/30 hover:bg-surface hover:text-foreground/50 border border-border"
                                }`}
                            >
                                {typeof d.name === 'string' ? d.name : d.name?.fr || "Donjon"}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar bg-[#0a0f18]/20">
                    {raidBossInfo ? (
                        <div className="space-y-6">
                            {/* Description & Position */}
                            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-caption font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Sparkles size={13} /> {raidBossInfo.tag}
                                    </span>
                                    <span className="text-caption font-mono text-white/40">{raidBossInfo.coords}</span>
                                </div>
                                <p className="text-sm text-white/80 leading-relaxed">{raidBossInfo.description}</p>
                            </div>

                            {/* Mécaniques Clés & Dangers */}
                            <div className="space-y-3">
                                <h4 className="text-caption font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <AlertTriangle size={13} className="text-rose-400" />
                                    Mécaniques Clés & Dangers
                                </h4>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {raidBossInfo.mechanics.map((m, i) => (
                                        <div
                                            key={i}
                                            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                                                m.danger
                                                    ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                                                    : "bg-white/[0.03] border-white/10 text-white/90"
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                                m.danger ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                                            }`}>
                                                {m.danger ? <AlertTriangle size={14} /> : <ShieldAlert size={14} />}
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <p className="text-xs font-black uppercase tracking-wide flex items-center gap-2">
                                                    <span>{m.label}</span>
                                                    {m.danger && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white tracking-widest">
                                                            CRITIQUE
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-white/70 leading-relaxed">{m.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stratégie Recommandée */}
                            <div className="space-y-3">
                                <h4 className="text-caption font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <Sword size={13} className="text-amber-400" />
                                    Stratégie de Combat Recommandée
                                </h4>
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                                    {raidBossInfo.strategy.map((s, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <p className="text-xs text-white/80 leading-relaxed">{s}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Astuces & Bons Réflexes */}
                            <div className="space-y-3">
                                <h4 className="text-caption font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <CheckCircle2 size={13} className="text-emerald-400" />
                                    Astuces & Bons Réflexes
                                </h4>
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                                    {raidBossInfo.tips.map((t, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <span className="text-emerald-400 text-xs font-black mt-0.5">✓</span>
                                            <p className="text-xs text-emerald-200/90 leading-relaxed">{t}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bouton Guide Complet */}
                            <Link
                                href={`/guides/${raidBossInfo.guideSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#7c3aed]/20 via-[#4f46e5]/20 to-[#06b6d4]/20 border border-[#7c3aed]/40 hover:border-[#7c3aed] transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#7c3aed]/30 flex items-center justify-center text-[#a78bfa] group-hover:scale-110 transition-transform">
                                        <BookOpen size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-white">Consulter le Guide Complet du Raid</p>
                                        <p className="text-[11px] text-white/50">Cartes HD, énigmes, compositions et barèmes de score</p>
                                    </div>
                                </div>
                                <ArrowUpRight size={18} className="text-white/40 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                            </Link>
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                            <p className="text-foreground/20 font-black uppercase text-caption tracking-widest animate-pulse">Analyse des Succès de Guilde...</p>
                        </div>
                    ) : directoryData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-surface border border-dashed border-border rounded-3xl">
                            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center border border-border">
                                <Info className="text-foreground/20" size={24} />
                            </div>
                            <p className="text-foreground/30 font-bold text-sm italic">Aucun succès répertorié pour ce donjon.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-foreground/20 font-black uppercase text-caption tracking-widest">Répertoire des Succès</h3>
                                <div className="flex-1 h-px bg-surface" />
                            </div>

                            {directoryData.map((achv) => {
                                const isExpanded = expandedAchv === achv.achievementId;
                                const completionRate = Math.round((achv.hasCompleted.length / (achv.hasCompleted.length + achv.missing.length)) * 100);

                                return (
                                    <div 
                                        key={achv.achievementId}
                                        className={`rounded-[1.5rem] border transition-all duration-300 overflow-hidden ${
                                            isExpanded 
                                                ? "bg-surface border-amber-500/30 shadow-2xl" 
                                                : "bg-surface border-border hover:border-border hover:bg-surface"
                                        }`}
                                    >
                                        <button
                                            onClick={() => setExpandedAchv(isExpanded ? null : achv.achievementId)}
                                            className="w-full flex items-center justify-between p-4 px-6 text-left"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="w-12 h-12 rounded-xl bg-black/40 border border-border flex items-center justify-center shrink-0 shadow-inner group">
                                                    {achv.iconUrl ? (
                                                        <img src={achv.iconUrl} alt="" className="w-8 h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform" />
                                                    ) : (
                                                        <img src="/assets/icons/icone-succes.png" alt="Succès" className="w-6 h-6 object-contain" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs md:text-sm font-black text-foreground uppercase italic tracking-tight truncate">{achv.achievementName}</h4>
                                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                                                        <span className="text-caption md:text-caption font-black text-amber-500 bg-amber-500/10 px-1.5 md:px-2 py-0.5 rounded-lg border border-amber-500/20">
                                                            {achv.points} PTS
                                                        </span>
                                                        {canShowGuildMembers && (
                                                            <span className="text-caption md:text-caption font-bold text-foreground/30 uppercase tracking-widest">
                                                                Complétion : {completionRate}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {canShowGuildMembers && (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? "bg-amber-500/20 text-amber-500" : "bg-surface text-foreground/20 border border-border"}`}>
                                                    <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                                                </div>
                                            )}
                                        </button>

                                        <AnimatePresence>
                                            {canShowGuildMembers && isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                                    className="px-6 pb-6"
                                                >
                                                    <div className="pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Missing List */}
                                                        <div className="space-y-4 flex flex-col h-full">
                                                            <div className="flex items-center justify-between shrink-0">
                                                                <span className="text-caption font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <Circle size={8} fill="currentColor" /> Cherchent encore
                                                                </span>
                                                                <span className="text-caption font-black text-foreground/20 bg-surface px-2 py-0.5 rounded-lg">
                                                                    {achv.missing.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                                                {achv.missing.length > 0 ? achv.missing.map((member) => (
                                                                    <MemberPill key={member.id} member={member} isMissing />
                                                                )) : (
                                                                    <p className="text-caption text-foreground/10 italic py-2">Tout le monde a validé ! 🎉</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Completed List */}
                                                        <div className="space-y-4 flex flex-col h-full">
                                                            <div className="flex items-center justify-between shrink-0">
                                                                <span className="text-caption font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <CheckCircle2 size={8} fill="currentColor" /> Déjà validé
                                                                </span>
                                                                <span className="text-caption font-black text-foreground/20 bg-surface px-2 py-0.5 rounded-lg">
                                                                    {achv.hasCompleted.length}
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                                                {achv.hasCompleted.length > 0 ? achv.hasCompleted.map((member) => (
                                                                    <MemberPill key={member.id} member={member} />
                                                                )) : (
                                                                    <p className="text-caption text-foreground/10 italic py-2">Aucun succès validé.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer / Actions */}
                <div className="p-6 bg-surface border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center p-1.5 shrink-0">
                             <img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-5 h-5 object-contain" />
                        </div>
                        <p className="text-caption text-foreground/30 font-bold uppercase tracking-widest leading-tight">
                            {canShowGuildMembers ? (
                                <>Consultez les membres de guilde<br/>pour organiser vos groupes</>
                            ) : (
                                <>Carte Interactive Dofus Unity<br/>Données officielles et succès répertoriés</>
                            )}
                        </p>
                    </div>
                    {/* En mode guilde : création DJ directe depuis la WorldMap. En mode public : pas de lien dashboard */}
                    {canShowGuildMembers && (
                        resolvedDj ? (
                            <a
                                href={`/dashboard/${guildId}/donjons-et-quetes?dungeonId=${encodeURIComponent(resolvedDj.id)}`}
                                className="px-6 py-3 rounded-2xl bg-amber-600 text-warning-foreground font-black text-caption uppercase italic shadow-lg shadow-amber-600/20 hover:bg-amber-500 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                            >
                                Créer un groupe <ChevronRight size={14} />
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setDjNotListedOpen(true)}
                                className="px-6 py-3 rounded-2xl bg-amber-600 text-warning-foreground font-black text-caption uppercase italic shadow-lg shadow-amber-600/20 hover:bg-amber-500 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                            >
                                Créer un groupe <ChevronRight size={14} />
                            </button>
                        )
                    )}
                </div>
            </DialogContent>
        </Dialog>

            {/* #175 — Popup de blocage : donjon non répertorié dans le module Donjons & Quêtes. */}
            <Dialog open={djNotListedOpen} onOpenChange={setDjNotListedOpen}>
                <DialogContent
                    showCloseButton={false}
                    className="w-[95vw] max-w-md bg-[#0a0f18] border border-border shadow-[0_50px_100px_rgba(0,0,0,0.8)] rounded-3xl text-foreground overflow-hidden p-0 gap-0"
                >
                    <div className="p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                            <Info size={26} className="text-amber-500" />
                        </div>
                        <h3 className="text-lg font-black text-foreground mb-2">Ce donjon n'est pas répertorié</h3>
                        <p className="text-caption text-foreground/40 font-semibold leading-relaxed mb-6">
                            Impossible de créer un groupe pour «&nbsp;{typeof dungeon.name === 'string' ? dungeon.name : dungeon.name?.fr || "ce donjon"}&nbsp;»
                            car il n'existe pas encore dans le module <strong>Donjons &amp; Quêtes</strong>.<br />
                            Signale-le à un officier ou au God pour qu'il soit ajouté.
                        </p>
                        <button
                            type="button"
                            onClick={() => setDjNotListedOpen(false)}
                            className="w-full px-6 py-3 rounded-2xl bg-surface border border-border text-foreground font-black text-caption uppercase italic hover:bg-elevated transition-all"
                        >
                            Compris
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function MemberPill({ member, isMissing }: { member: any, isMissing?: boolean }) {
    const classInfo = member.classe ? getClass(member.classe) : null;
    
    return (
        <div className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${isMissing ? "bg-surface border-border hover:border-border" : "bg-emerald-500/5 border-emerald-500/10 opacity-60"}`}>
            <div className="w-6 h-6 rounded-lg bg-black/40 border border-border overflow-hidden flex items-center justify-center shrink-0">
                {member.imageUrl ? (
                    <img src={member.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Users size={12} className="text-foreground/20" />
                )}
            </div>
            <span className="text-caption font-bold text-foreground/70 truncate flex-1 uppercase tracking-tighter">
                {member.name}
            </span>
            {classInfo && (
                <div className="w-4 h-4 rounded overflow-hidden opacity-50 shadow-inner">
                    <img src={classInfo.icon} alt={member.classe} className="w-full h-full object-contain" />
                </div>
            )}
        </div>
    );
}
