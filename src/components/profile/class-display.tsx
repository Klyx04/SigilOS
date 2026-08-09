"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { cn, formatDofusPseudo } from "@/lib/utils";
import { ClassIcon } from "@/components/shared/class-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { verifyDofusPseudo } from "@/server/actions/profile-actions";
import { Loader2, Search, UserCheck, AlertTriangle, Pencil, Info, Plus, UserCircle } from "lucide-react";

interface ClassDisplayProps {
    pseudoDofus?: string | null;
    mainClass?: string | null;
    onSave?: (mainClass: string, pseudoDofus: string) => void;
    readOnly?: boolean;
    guildId?: string;
}

export function ClassDisplay({
    pseudoDofus,
    mainClass,
    onSave,
    readOnly = false,
    guildId,
}: ClassDisplayProps) {
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMain, setSelectedMain] = useState<string>(mainClass || "");
    const [localPseudo, setLocalPseudo] = useState<string>(pseudoDofus || "");
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");

    // Auto-open if redirected with ?edit=identity (Security: check readOnly)
    useEffect(() => {
        if (!readOnly && searchParams.get("edit") === "identity") {
            setIsOpen(true);
            handleOpen();
        }
    }, [searchParams, readOnly]);

    const mainClassData = getClass(mainClass || "");

    const handleSave = () => {
        if (!localPseudo) {
            toast.error("Le pseudo est obligatoire");
            return;
        }

        if (localPseudo !== (pseudoDofus || "") && verifyStatus !== "success") {
            toast.error("Veuillez vérifier votre pseudo avec la loupe avant de confirmer.");
            return;
        }

        onSave?.(selectedMain, localPseudo);
        setIsOpen(false);
    };

    const handleOpen = () => {
        setSelectedMain(mainClass || "");
        setLocalPseudo(pseudoDofus || "");
        setVerifyStatus("idle");
    };

    const handleVerify = async () => {
        if (!localPseudo || localPseudo.length < 2 || !guildId) return;
        setIsVerifying(true);
        setVerifyStatus("idle");
        try {
            const res = await verifyDofusPseudo(localPseudo, guildId);
            if (res.success) {
                setVerifyStatus("success");
                toast.success("Pseudo trouvé sur le ladder !");
            } else {
                setVerifyStatus("error");
                toast.error(res.error || "Pseudo introuvable");
            }
        } catch (e) {
            setVerifyStatus("error");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="p-6 bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-white/10 transition-all hover:border-amber-500/30 shadow-2xl group space-y-4">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                Identité de Combat
                            </h3>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Pseudo Dofus officiel & Classe</p>
                        </div>
                    </div>
                    {!readOnly && (
                        <DialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 px-3 text-xs font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 rounded-xl transition-all cursor-pointer"
                                onClick={handleOpen}
                            >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
                                Modifier
                            </Button>
                        </DialogTrigger>
                    )}
                </div>

                {/* Main Class Display - Premium Card COMPACT */}
                {mainClassData ? (
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-5 group-hover:border-amber-500/40 transition-colors">
                        {/* Background Glow */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[40px] opacity-25 pointer-events-none"
                            style={{ backgroundColor: mainClassData.color }}
                        />

                        <div className="relative flex items-center gap-4">
                            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 shadow-lg shrink-0" style={{ borderColor: `${mainClassData.color}50` }}>
                                <ClassIcon classId={mainClassData.id} size={38} className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                            </div>

                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest shrink-0">Pseudo Dofus :</span>
                                    {pseudoDofus ? (
                                        <span className="text-lg font-black text-amber-400 tracking-wide drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                                            {pseudoDofus}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-black text-amber-400/80 animate-pulse uppercase tracking-widest">
                                            Non renseigné
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest shrink-0">Classe principale :</span>
                                    <span className="text-sm font-black text-white uppercase tracking-wider" style={{ color: mainClassData.color }}>
                                        {mainClassData.name}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {!readOnly ? (
                            <DialogTrigger asChild>
                                <button
                                    onClick={handleOpen}
                                    className="w-full p-6 text-center border-2 border-dashed border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-xl mb-4 transition-all group/cta relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover/cta:opacity-100 transition-opacity" />
                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center group-hover/cta:scale-110 transition-transform">
                                            <Plus className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <p className="text-sm font-black text-zinc-300 uppercase tracking-widest">Configurer mon Identité</p>
                                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">Pseudo Dofus & Classe requis</p>
                                    </div>
                                </button>
                            </DialogTrigger>
                        ) : (
                            <div className="w-full p-6 text-center border-2 border-zinc-800/50 rounded-xl mb-4 bg-zinc-900/10">
                                <p className="text-sm font-black text-zinc-600 uppercase tracking-widest italic">Profil non configuré</p>
                            </div>
                        )}
                    </div>
                )}

                <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                    <DialogHeader className="p-8 pb-4 border-b border-white/5 shrink-0">
                        <DialogTitle className="text-2xl font-black">Modifier votre profil</DialogTitle>
                        <DialogDescription className="text-base text-zinc-400">Définissez votre identité en jeu.</DialogDescription>
                    </DialogHeader>

                    <div className="px-8 pt-6 pb-2 shrink-0">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2 pl-1">
                                <UserCircle className="w-5 h-5" />
                                Pseudo Dofus Exact
                            </label>
                            <div className="relative">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            value={localPseudo}
                                            onChange={(e) => {
                                                setLocalPseudo(formatDofusPseudo(e.target.value));
                                                setVerifyStatus("idle");
                                            }}
                                            placeholder="Votre pseudo en jeu..."
                                            className={cn(
                                                "bg-zinc-900/50 border-white/10 h-14 focus:ring-primary/20 pr-12 text-lg font-semibold transition-all",
                                                verifyStatus === "success" && "border-emerald-500/50",
                                                verifyStatus === "error" && "border-rose-500/50"
                                            )}
                                            maxLength={50}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-600">
                                            {localPseudo.length}/50
                                        </div>
                                        {verifyStatus === "success" && (
                                            <div className="absolute left-[-2px] top-[-2px] bottom-[-2px] w-1 bg-emerald-500 rounded-l-md" />
                                        )}
                                    </div>
                                    <Button 
                                        variant="outline"
                                        className={cn(
                                            "h-14 w-14 shrink-0 bg-zinc-900/50 border-white/10 transition-all",
                                            verifyStatus === "success" && "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                                        )}
                                        onClick={handleVerify}
                                        disabled={isVerifying || localPseudo.length < 2}
                                    >
                                        {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    </Button>
                                </div>
                                <p className="text-[11px] leading-relaxed text-zinc-500 pl-1 mt-3">
                                    {verifyStatus === "success" ? (
                                        <span className="text-emerald-500 font-bold italic flex items-center gap-2">
                                            <UserCheck className="w-3.5 h-3.5" />
                                            Pseudo trouvé et validé sur le ladder officiel.
                                        </span>
                                    ) : (
                                        <>
                                            Le pseudo doit être <strong className="text-zinc-300 uppercase tracking-tighter">EXACT</strong> (Majuscules, tirets, etc.) pour que la synchronisation fonctionne. Utilisez la loupe <Search className="inline w-3 h-3 mb-0.5" /> pour vérifier.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden px-8 flex flex-col">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-6 mb-2 pl-1">Classe Principale</h4>
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 py-4 pb-24">
                                {DOFUS_CLASSES.map(c => {
                                    const isSelected = selectedMain === c.id;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedMain(c.id)}
                                            className={cn(
                                                "group relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-300 aspect-square overflow-hidden",
                                                isSelected
                                                    ? "border-white/40 shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)]"
                                                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                                            )}
                                            style={isSelected ? {
                                                borderColor: c.color,
                                                backgroundColor: `${c.color}25`,
                                                boxShadow: `0 0 20px -5px ${c.color}60`
                                            } : undefined}
                                        >
                                            <div className={cn("mb-2 transform transition-transform group-hover:scale-110 duration-300", isSelected ? "scale-110" : "")}>
                                                <ClassIcon classId={c.id} size={36} />
                                            </div>
                                            <span className={cn("w-full px-1 text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider transition-colors truncate text-center", isSelected ? "text-white" : "text-zinc-500")}
                                                style={isSelected ? { color: 'white', textShadow: `0 0 10px ${c.color}` } : undefined}
                                            >
                                                {c.name}
                                            </span>

                                            {isSelected && (
                                                <>
                                                    <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                                        style={{ backgroundColor: c.color }}
                                                    >
                                                        <div className="w-1 h-1 rounded-full bg-white" />
                                                    </div>
                                                    <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-white/20" />
                                                </>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/5 bg-zinc-900/40 flex justify-end gap-3 shrink-0">
                        <DialogClose asChild>
                            <Button variant="ghost" className="text-zinc-400 hover:text-white">
                                Annuler
                            </Button>
                        </DialogClose>
                        <Button 
                            onClick={handleSave} 
                            variant="sigil"
                            size="xl"
                        >
                            Confirmer les changements
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
