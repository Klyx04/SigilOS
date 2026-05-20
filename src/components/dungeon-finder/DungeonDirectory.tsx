"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Users,
  Trophy,
  ChevronLeft,
  ChevronDown,
  CheckCircle2,
  Circle,
  Sword,
  Info,
  Map as MapIcon,
  Globe,
  Copy,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import {
  getDungeonsWithAchievements,
  getMonsterStats,
} from "@/server/actions/game-data-actions";
import { getDungeonDirectory } from "@/server/actions/dungeon-finder-actions";
import { Button } from "@/components/ui/button";
import { getClass } from "@/lib/dofus-assets";
import { MapViewer } from "@/components/worldmap/map-viewer";

function StatResist({
  label,
  value,
  color,
  border,
  text,
}: {
  label: string;
  value?: number;
  color: string;
  border: string;
  text: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 group/res relative`}>
      <div
        className={`w-5 h-5 rounded border ${color} ${border} flex items-center justify-center transition-all group-hover/res:scale-110 shadow-sm overflow-hidden`}
      >
        <span className={`text-[8px] font-black ${text}`}>
          {value !== undefined ? `${value}%` : ""}
        </span>
      </div>
      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">
        {label}
      </span>
    </div>
  );
}

interface Dungeon {
  id: string;
  name: string;
  bossName: string;
  level: number;
  imageUrl?: string | null;
  isExpedition: boolean;
  dofuspourlesnoobsUrl?: string | null;
  dpnlUrl?: string | null;
  dofensiveUrl?: string | null;
}

interface AchievementDirectory {
  achievementId: string;
  achievementName: string;
  iconUrl: string | null;
  points: number;
  hasCompleted: {
    id: string;
    name: string;
    imageUrl: string | null;
    classe: string | null;
  }[];
  missing: {
    id: string;
    name: string;
    imageUrl: string | null;
    classe: string | null;
  }[];
}

interface DungeonDirectoryProps {
  guildId: string;
  onCreatePost?: (dungeonId: string) => void;
}

export function DungeonDirectory({
  guildId,
  onCreatePost,
}: DungeonDirectoryProps) {
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null);
  const [bossStats, setBossStats] = useState<any | null>(null);
  const [selectedGrade, setSelectedGrade] = useState(4); // Default to G5 (index 4)
  const [directoryData, setDirectoryData] = useState<AchievementDirectory[]>(
    [],
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(1000);
  const [selectedSpellId, setSelectedSpellId] = useState<number | null>(null);
  const [loadingDb, setLoadingDb] = useState(true);
  const [loadingDir, setLoadingDir] = useState(false);
  const [expandedAchv, setExpandedAchv] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"pseudo" | "classe">("pseudo");
  const [selectedDrop, setSelectedDrop] = useState<any | null>(null);

  useEffect(() => {
    getDungeonsWithAchievements().then((res) => {
      if (res.success && res.data) {
        const uniqueDungeons = Array.from(
          new Map(res.data.map((item: any) => [item.id, item])).values(),
        ) as Dungeon[];
        setDungeons(uniqueDungeons.sort((a, b) => b.level - a.level));
      }
      setLoadingDb(false);
    });
  }, []);

  const filteredDungeons = useMemo(() => {
    const term = search.toLowerCase();
    return dungeons.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(term) ||
        d.bossName.toLowerCase().includes(term);
      const matchesLevel = d.level >= minLevel && d.level <= maxLevel;
      return matchesSearch && matchesLevel;
    });
  }, [dungeons, search, minLevel, maxLevel]);

  async function handleSelectDungeon(dungeon: Dungeon) {
    setSelectedDungeon(dungeon);
    setBossStats(null);
    setSelectedGrade(4);
    setSelectedSpellId(null);
    setLoadingDir(true);
    setDirectoryData([]);
    setExpandedAchv(null);
    setMemberSearch("");

    const [dirRes, statsRes] = await Promise.all([
      getDungeonDirectory(guildId, dungeon.id),
      getMonsterStats(dungeon.bossName),
    ]);

    if (dirRes.success && dirRes.data) {
      setDirectoryData(dirRes.data);
      if (dirRes.data.length > 0) {
        setExpandedAchv(dirRes.data[0].achievementId);
      }
    }

    if (statsRes.success && statsRes.data) {
      setBossStats(statsRes.data);
      // If monster has fewer than 5 grades, adjust selectedGrade
      if (statsRes.data.grades.length <= selectedGrade) {
        setSelectedGrade(statsRes.data.grades.length - 1);
      }
    }

    setLoadingDir(false);
  }

  const filteredDirectory = useMemo(() => {
    const term = memberSearch.toLowerCase();

    const sortFn = (a: any, b: any) =>
      sortMode === "classe"
        ? (a.classe || "").localeCompare(b.classe || "") || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name);

    return directoryData
      .map((achv) => {
        const filterFn = (m: any) =>
          !term ||
          m.name.toLowerCase().includes(term) ||
          (m.classe && m.classe.toLowerCase().includes(term));
        return {
          ...achv,
          missing: achv.missing.filter(filterFn).sort(sortFn),
          hasCompleted: achv.hasCompleted.filter(filterFn).sort(sortFn),
        };
      });
  }, [directoryData, memberSearch, sortMode]);

  if (loadingDb) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-pulse">
        <Users className="w-10 h-10 mb-4 opacity-50" />
        <p className="font-medium">Chargement de la base de données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!selectedDungeon ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  Succès Commun
                </h2>
                <p className="text-sm text-slate-400 mt-1 ml-10">
                  Trouve qui a ou n'a pas encore validé chaque succès de donjon
                  dans la guilde.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un donjon…"
                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-sm transition-all shadow-inner h-11"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/40 border border-white/5 rounded-xl">
                  {[
                    { label: "Tout", min: 1, max: 1000 },
                    { label: "1-50", min: 1, max: 50 },
                    { label: "51-100", min: 51, max: 100 },
                    { label: "101-150", min: 101, max: 150 },
                    { label: "151-190", min: 151, max: 190 },
                    { label: "191-200", min: 191, max: 200 },
                  ].map((preset) => {
                    const isActive =
                      minLevel === preset.min && maxLevel === preset.max;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setMinLevel(preset.min);
                          setMaxLevel(preset.max);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                          isActive
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                            : "bg-white/5 text-slate-500 border-transparent hover:bg-white/10 hover:text-slate-300"
                        }`}
                      >
                        {preset.label === "Tout"
                          ? "Tous Niveaux"
                          : `Lvl ${preset.label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Grid of Dungeons */}
            {filteredDungeons.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {filteredDungeons.map((dungeon) => (
                  <motion.button
                    key={dungeon.id}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectDungeon(dungeon)}
                    className="relative group overflow-hidden rounded-xl flex flex-col items-center text-center border border-white/5 bg-slate-900/40 hover:bg-slate-900/60 hover:border-indigo-500/40 shadow-sm transition-all p-2 pb-2.5"
                  >
                    {/* Image */}
                    <div className="w-full aspect-square flex items-center justify-center mb-1.5 relative">
                      {dungeon.imageUrl ? (
                        <img
                          src={dungeon.imageUrl}
                          alt={dungeon.name}
                          className="w-4/5 h-4/5 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shadow-inner border border-white/5">
                          <Search className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                      {dungeon.isExpedition && (
                        <div className="absolute top-0 right-0 bg-indigo-600 text-[7px] font-black px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg shadow-lg uppercase tracking-tighter z-10">
                          Expédition
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-1">
                        Lvl {dungeon.level}
                      </div>
                      <h3 className="text-[11px] font-bold text-slate-300 leading-tight line-clamp-2 group-hover:text-white transition-colors">
                        {dungeon.name}
                      </h3>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>Aucun donjon trouvé pour "{search}"</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Back Button */}
            <div className="mb-2">
              <button
                onClick={() => setSelectedDungeon(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-zinc-900/50 text-slate-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Retour à l'annuaire
              </button>
            </div>
            <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl">
              <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 lg:gap-8">
                {/* Left Column: Info, Loot, Spells */}
                <div className="flex-1 space-y-6 min-w-0">
                  <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                    {(bossStats?.imageUrl || selectedDungeon.imageUrl) && (
                      <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl bg-gradient-to-tr from-slate-950 to-slate-900 border border-white/10 flex items-center justify-center p-2 shadow-inner">
                        <img
                          src={bossStats?.imageUrl || selectedDungeon.imageUrl}
                          alt={bossStats?.name || "Boss"}
                          className="w-full h-full object-contain filter drop-shadow-lg"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-950 border border-white/10 rounded-lg shadow-inner">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                            Niveau {selectedDungeon.level}
                          </span>
                        </div>
                        {selectedDungeon.isExpedition && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shadow-sm">
                            <Sword className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                              Expédition
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/5 rounded-lg">
                          <MapIcon className="w-3 h-3 text-zinc-500" />
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            Classique
                          </span>
                        </div>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-lg tracking-tight truncate">
                        {selectedDungeon.name}
                      </h2>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Boss</span>
                          <span className="text-sm font-black text-white bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                            {selectedDungeon.bossName}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {(selectedDungeon.dofuspourlesnoobsUrl || selectedDungeon.dpnlUrl) && (
                            <a 
                              href={selectedDungeon.dofuspourlesnoobsUrl || selectedDungeon.dpnlUrl || "#"} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="group/link flex items-center gap-2 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 hover:border-indigo-500 rounded-xl transition-all shadow-lg active:scale-95"
                            >
                              <div className="w-5 h-5 rounded-lg bg-indigo-500/20 group-hover/link:bg-white/20 flex items-center justify-center transition-colors">
                                <Globe className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-black uppercase tracking-wider">Guide DPNL</span>
                              <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100" />
                            </a>
                          )}
                          {selectedDungeon.dofensiveUrl && (
                            <a 
                              href={selectedDungeon.dofensiveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="group/link flex items-center gap-2 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-emerald-500 rounded-xl transition-all shadow-lg active:scale-95"
                            >
                              <div className="w-5 h-5 rounded-lg bg-emerald-500/20 group-hover/link:bg-white/20 flex items-center justify-center transition-colors">
                                <Sword className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-black uppercase tracking-wider">Dofensive</span>
                              <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* Drops Section: Ultra compact */}
                    {bossStats?.drops && bossStats.drops.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400/60 ml-1">
                            Butins notables
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2 pt-1.5 custom-scrollbar">
                          {bossStats.drops.map((drop: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedDrop(drop)}
                              className="group/drop relative bg-white/5 border border-white/5 rounded-md p-1 hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center w-7 h-7 md:w-8 md:h-8 shrink-0"
                              title={`${drop.name} - Drop: ${drop.percent}%`}
                            >
                              <img
                                src={drop.imageUrl}
                                alt={drop.name}
                                className="w-full h-full object-contain filter drop-shadow-xs group-hover/drop:scale-110 transition-transform"
                              />
                              <div className="absolute -top-1.5 -right-1 bg-indigo-600 text-[7px] font-black px-1.5 py-0.5 rounded-sm shadow-xl opacity-0 group-hover/drop:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none origin-bottom-right">
                                {drop.percent}%
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spells Section: Smaller buttons */}
                    {bossStats?.spells && bossStats.spells.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-400/60 ml-1">
                          Capacités du Boss
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {bossStats.spells.map((spell: any, idx: number) => {
                            const isActive = selectedSpellId === spell.id;
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedSpellId(isActive ? null : spell.id)}
                                className={`flex items-center gap-2 border rounded-md px-1.5 py-1 transition-all outline-none group/spell ${
                                  isActive 
                                    ? "bg-rose-500/20 border-rose-500/40 text-rose-100 shadow-lg" 
                                    : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded overflow-hidden flex items-center justify-center p-0.5 transition-all ${isActive ? 'bg-rose-500/30' : 'bg-slate-900'}`}>
                                  {spell.imageUrl ? (
                                    <img src={spell.imageUrl} alt="" className="w-full h-full object-contain" />
                                  ) : (
                                    <Sword className="w-2.5 h-2.5 opacity-50" />
                                  )}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-tight ${isActive ? 'text-rose-200' : 'text-slate-400 group-hover/spell:text-slate-200'}`}>
                                  {spell.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Spell Details: Inline and compact */}
                        <AnimatePresence mode="wait">
                          {selectedSpellId && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 mt-1.5 space-y-2.5 shadow-inner">
                                {(() => {
                                  const spell = bossStats.spells.find((s: any) => s.id === selectedSpellId);
                                  if (!spell) return null;
                                  return (
                                    <>
                                      <div className="flex items-center items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded bg-black/40 flex items-center justify-center border border-white/10 p-1">
                                            {spell.imageUrl ? <img src={spell.imageUrl} alt="" className="w-full h-full object-contain" /> : <Sword className="w-3.5 h-3.5 text-rose-500/50" />}
                                          </div>
                                          <div>
                                            <h5 className="text-xs font-black text-white">{spell.name}</h5>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className="text-[8px] font-black text-amber-500/70 bg-amber-500/5 px-1 py-0.5 rounded border border-amber-500/10 uppercase">{spell.apCost} PA</span>
                                              <span className="text-[8px] font-black text-indigo-400/70 bg-indigo-500/5 px-1 py-0.5 rounded border border-indigo-500/10 uppercase">{spell.minRange}-{spell.range} PO</span>
                                              <span className={`text-[8px] font-black px-1 py-0.5 rounded border uppercase ${spell.castTestLos ? 'text-emerald-500/70 bg-emerald-500/5 border-emerald-500/10' : 'text-rose-500/70 bg-rose-500/5 border-rose-500/10'}`}>
                                                {spell.castTestLos ? 'LDV' : 'S-LDV'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-slate-400 leading-snug bg-black/20 rounded-lg p-2 border border-white/5 font-medium">
                                        {spell.description}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Sidebar (Minimap & Stats) */}
                <div className="md:w-56 lg:w-64 space-y-3 shrink-0">
                  {/* Integrated Mini Map */}
                  {bossStats?.coordinates && (
                    <div className="w-full h-60 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] group/map relative bg-slate-950">
                      <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between p-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest italic shrink-0">
                          <Globe className="w-3 h-3 animate-pulse" />
                          [{bossStats.coordinates.x}, {bossStats.coordinates.y}]
                        </div>
                        <button
                          onClick={() => {
                            const cmd = `/travel ${bossStats.coordinates.x} ${bossStats.coordinates.y}`;
                            navigator.clipboard.writeText(cmd);
                            toast.success("Command copiée !", { description: cmd });
                          }}
                          className="pointer-events-auto w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 flex items-center justify-center transition-all shadow-lg active:scale-95 group/copy"
                          title="Copier /travel"
                        >
                          <Copy className="w-3.5 h-3.5 group-hover/copy:scale-110 transition-transform" />
                        </button>
                      </div>
                      <div className="w-full h-full transform transition-transform group-hover/map:scale-105 duration-1000">
                        <MapViewer
                          initialTab="map"
                          initialX={bossStats.coordinates.x}
                          initialY={bossStats.coordinates.y}
                          initialWorldId={bossStats.coordinates.worldMapId}
                          initialZoom={1}
                          hideUI={true}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats Card */}
                  <div className="bg-slate-950/30 border border-white/5 rounded-xl p-3 shadow-xl">
                    <div className="flex items-center justify-between mb-2.5 border-b border-white/5 pb-1.5">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Stats Boss</span>
                      <div className="flex gap-0.5">
                        {bossStats?.grades?.map((_: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => setSelectedGrade(i)}
                            className={`w-3.5 h-3.5 rounded text-[7px] font-black flex items-center justify-center transition-all border ${
                              selectedGrade === i
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-white/5 border-white/5 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                      <div className="bg-black/30 p-1.5 rounded-lg border border-white/5">
                        <span className="text-[7px] font-bold text-zinc-600 uppercase block">Vie</span>
                        <span className="text-white font-black">{bossStats?.grades[selectedGrade]?.lifePoints?.toLocaleString() || "---"}</span>
                      </div>
                      <div className="bg-black/30 p-1.5 rounded-lg border border-white/5">
                        <span className="text-[7px] font-bold text-zinc-600 uppercase block">PA | PM</span>
                        <span className="text-white font-black">{bossStats ? `${bossStats.grades[selectedGrade]?.actionPoints} | ${bossStats.grades[selectedGrade]?.movementPoints}` : "---"}</span>
                      </div>
                      <div className="bg-black/30 p-2 rounded-lg border border-white/5 col-span-2">
                        <div className="flex justify-between items-center gap-1">
                          <StatResist label="N" value={bossStats?.grades[selectedGrade]?.resists.neutral} color="bg-zinc-500/20" border="border-zinc-500/20" text="text-zinc-400" />
                          <StatResist label="T" value={bossStats?.grades[selectedGrade]?.resists.earth} color="bg-orange-500/20" border="border-orange-500/20" text="text-orange-400" />
                          <StatResist label="F" value={bossStats?.grades[selectedGrade]?.resists.fire} color="bg-red-500/20" border="border-red-500/20" text="text-red-400" />
                          <StatResist label="E" value={bossStats?.grades[selectedGrade]?.resists.water} color="bg-blue-500/20" border="border-blue-500/20" text="text-blue-400" />
                          <StatResist label="A" value={bossStats?.grades[selectedGrade]?.resists.air} color="bg-emerald-400/20" border="border-emerald-400/20" text="text-emerald-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {onCreatePost && (
                    <Button
                      onClick={() => onCreatePost(selectedDungeon.id)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-lg shadow-lg shadow-indigo-950/20 transition-all hover:scale-[1.01] active:scale-95 text-[10px] uppercase tracking-wider"
                    >
                      <Users className="w-3 h-3 mr-2" />
                      Créer un groupe
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Directory Content */}
            {loadingDir ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 animate-pulse bg-slate-900/30 rounded-3xl border border-slate-800/50">
                <Search className="w-8 h-8 mb-3 opacity-50" />
                <p>Analyse des succès de la guilde...</p>
              </div>
            ) : filteredDirectory.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-200/80">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-60 text-amber-500" />
                <p>Ce donjon ne possède aucun succès recensé dans la base.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Member Search + Sort */}
                <div className="flex items-center gap-2 ml-auto">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Chercher un membre…"
                      className="w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner h-10 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => setSortMode(m => m === "pseudo" ? "classe" : "pseudo")}
                    title={sortMode === "pseudo" ? "Trier par classe" : "Trier par pseudo"}
                    className={`flex items-center gap-1.5 px-3 h-10 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${
                      sortMode === "classe"
                        ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                        : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {sortMode === "classe" ? "Classe" : "Pseudo"}
                  </button>
                </div>

                {filteredDirectory.map((achv) => {
                  const isExpanded = expandedAchv === achv.achievementId;
                  const totalMembers =
                    achv.hasCompleted.length + achv.missing.length;
                  const completionRate =
                    totalMembers > 0
                      ? Math.round(
                          (achv.hasCompleted.length / totalMembers) * 100,
                        )
                      : 0;

                  return (
                    <div
                      key={achv.achievementId}
                      className={`group/card rounded-2xl transition-all duration-300 overflow-hidden border ${
                        isExpanded
                          ? "bg-slate-900/90 border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.08)]"
                          : "bg-slate-900/30 border-white/5 hover:border-white/12 hover:bg-slate-900/50 hover:shadow-lg shadow-sm"
                      }`}
                    >
                      <button
                        onClick={() =>
                          setExpandedAchv(
                            isExpanded ? null : achv.achievementId,
                          )
                        }
                        className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 gap-4 text-left focus:outline-none"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-all duration-300 ${
                            isExpanded
                              ? "bg-indigo-600/10 border-indigo-500/30"
                              : "bg-slate-900 border-white/5 group-hover/card:scale-105"
                          }`}>
                            {achv.iconUrl ? (
                              <img
                                src={achv.iconUrl}
                                alt=""
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <Trophy className="w-6 h-6 text-indigo-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-white leading-snug tracking-tight">
                              {achv.achievementName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              {completionRate === 100 ? (
                                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Terminé
                                </span>
                              ) : completionRate > 0 ? (
                                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  En Cours
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50">
                                  Non Commencé
                                </span>
                              )}
                              <span className="text-xs text-slate-400">
                                {achv.hasCompleted.length} / {totalMembers} membres
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex flex-col gap-1 w-full md:w-48 shrink-0">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <span>Progression</span>
                            <span className={completionRate === 100 ? "text-emerald-400 font-extrabold" : "text-indigo-400 font-extrabold"}>{completionRate}%</span>
                          </div>
                          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner relative">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                completionRate === 100
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                  : completionRate > 0
                                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                                  : "bg-slate-850"
                              }`}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 mt-2 md:mt-0 border-t border-white/5 pt-2.5 md:pt-0 md:border-none">
                          {/* Avatars Preview */}
                          {!isExpanded && achv.missing.length > 0 && (
                            <div className="flex -space-x-2">
                              {achv.missing.slice(0, 4).map((m, i) => (
                                <div
                                  key={i}
                                  className="w-7 h-7 rounded-full border-2 border-slate-900 bg-slate-850 overflow-hidden relative shadow-md"
                                  title={`${m.name} cherche encore`}
                                >
                                  {m.imageUrl ? (
                                    <img
                                      src={m.imageUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Users className="w-3 h-3 m-1.5 text-slate-500" />
                                  )}
                                </div>
                              ))}
                              {achv.missing.length > 4 && (
                                <div className="w-7 h-7 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400 z-10 shadow-md">
                                  +{achv.missing.length - 4}
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isExpanded
                                ? "bg-indigo-500/20 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                                : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"
                            }`}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5"
                          >
                            <div className="p-5 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 bg-slate-950/20 shadow-inner">
                              {/* Col 1: MISSING */}
                              <div className="bg-slate-950/40 border border-rose-500/10 rounded-2xl p-5 shadow-[inset_0_1px_4px_rgba(244,63,94,0.05)]">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                                  <div className="flex items-center gap-2 font-bold text-sm">
                                    <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                      <Circle className="w-3.5 h-3.5 text-rose-400" />
                                    </div>
                                    <span className="text-rose-300">
                                      Cherchent encore
                                    </span>
                                  </div>
                                  <span className="text-xs font-black bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">
                                    {achv.missing.length}
                                  </span>
                                </div>

                                {achv.missing.length > 0 ? (
                                  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                    {achv.missing.map((member) => (
                                      <MemberPill
                                        key={member.id}
                                        member={member}
                                        variant="missing"
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500 italic text-center py-4">
                                    Tout le monde a validé ce succès ! 🎉
                                  </p>
                                )}
                              </div>

                              {/* Col 2: HAS COMPLETED */}
                              <div className="bg-slate-950/40 border border-emerald-500/10 rounded-2xl p-5 shadow-[inset_0_1px_4px_rgba(16,185,129,0.05)]">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                                  <div className="flex items-center gap-2 font-bold text-sm">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-inner flex items-center justify-center">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <span className="text-emerald-300">
                                      Déjà validé
                                    </span>
                                  </div>
                                  <span className="text-xs font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    {achv.hasCompleted.length}
                                  </span>
                                </div>

                                {achv.hasCompleted.length > 0 ? (
                                  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                    {achv.hasCompleted.map((member) => (
                                      <MemberPill
                                        key={member.id}
                                        member={member}
                                        variant="completed"
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-600 italic text-center py-4">
                                    Personne n'a encore validé ce succès.
                                  </p>
                                )}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Modal */}
      <AnimatePresence>
        {selectedDrop && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDrop(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[320px] bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center p-3 shadow-inner relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-50" />
                   <img src={selectedDrop.imageUrl} alt={selectedDrop.name} className="w-full h-full object-contain relative z-10 drop-shadow-md" />
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-white leading-tight mb-1">{selectedDrop.name}</h3>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                    Taux de drop : {selectedDrop.percent}%
                  </div>
                </div>

                <div className="w-full grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={() => setSelectedDrop(null)}
                    className="px-4 py-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all"
                  >
                    Fermer
                  </button>
                  <a 
                    href={`https://dofusdb.fr/fr/database/item/${selectedDrop.objectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
                  >
                    DofusDB <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberPill({
  member,
  variant,
}: {
  member: any;
  variant: "missing" | "completed";
}) {
  const isMissing = variant === "missing";
  const cls = member.classe ? getClass(member.classe) : null;

  return (
    <div
      className={`group flex items-center justify-between p-2 rounded-xl border transition-all duration-200 ${
        isMissing
          ? "bg-slate-950/40 hover:bg-slate-900/80 border-rose-500/10 hover:border-rose-500/30 text-rose-100 shadow-[0_2px_8px_rgba(244,63,94,0.02)]"
          : "bg-emerald-950/20 hover:bg-emerald-900/30 border-emerald-500/10 hover:border-emerald-500/30 text-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.02)]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg overflow-hidden shrink-0 border transition-transform duration-200 group-hover:scale-105 ${
            isMissing
              ? "border-rose-500/20 bg-rose-950/30"
              : "border-emerald-500/20 bg-emerald-950/30"
          } flex items-center justify-center`}
        >
          {member.imageUrl ? (
            <img
              src={member.imageUrl}
              alt={member.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Users className={`w-3.5 h-3.5 ${isMissing ? "text-rose-400/60" : "text-emerald-400/60"}`} />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold truncate text-slate-100 leading-tight">
            {member.name}
          </span>
          {member.classe && (
            <span className="text-[10px] text-slate-400 font-medium truncate capitalize">
              {member.classe}
            </span>
          )}
        </div>
      </div>

      {cls && (
        <div className="shrink-0 pl-1.5 flex items-center">
          <img
            src={cls.icon}
            alt={member.classe}
            className={`w-5 h-5 object-contain transition-all duration-300 group-hover:scale-110 ${
              isMissing
                ? "drop-shadow-[0_0_4px_rgba(244,63,94,0.2)] opacity-80 group-hover:opacity-100"
                : "drop-shadow-[0_0_4px_rgba(16,185,129,0.2)] opacity-80 group-hover:opacity-100"
            }`}
            title={member.classe}
          />
        </div>
      )}
    </div>
  );
}
