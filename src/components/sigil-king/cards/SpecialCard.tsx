import { memo } from "react";
import { motion } from "framer-motion";

export type CardType = "incarnation" | "ogrest" | "eniripsa" | "pandawa" | "sram" | "devastator" | "almamater";

interface SpecialInfo {
    label: string;
    subLabel: string;
    color: string;
    bgFrom: string;
    bgTo: string;
    glow: string;
    symbol: string;
}

const SPECIAL_INFO: Record<CardType, SpecialInfo> = {
    ogrest:     { label: "OGREST",       subLabel: "Roi des Titans",    color: "#FFD700", bgFrom: "#1a1200", bgTo: "#3d2b00", glow: "rgba(255,215,0,0.8)",    symbol: "👑" },
    eniripsa:   { label: "ÉNIRIPSA",     subLabel: "Guérisseuse Sacrée",color: "#00D4F0", bgFrom: "#001a20", bgTo: "#003040", glow: "rgba(0,212,240,0.7)",     symbol: "💫" },
    incarnation:{ label: "INCARNATION",  subLabel: "Guerrier Légendaire",color: "#E53E3E", bgFrom: "#1a0000", bgTo: "#3d0000", glow: "rgba(229,62,62,0.7)",     symbol: "⚔️" },
    pandawa:    { label: "PANDAWA",      subLabel: "Trop ivre pour combattre", color: "#718096", bgFrom: "#0d0d0d", bgTo: "#1a1a1a", glow: "rgba(113,128,150,0.5)", symbol: "🍶" },
    sram:       { label: "SRAM",         subLabel: "Assassin Double Identité", color: "#9B59B6", bgFrom: "#100020", bgTo: "#200040", glow: "rgba(155,89,182,0.7)",  symbol: "🗡️" },
    devastator: { label: "DÉVASTATEUR",  subLabel: "Annule le pli",     color: "#FF4444", bgFrom: "#0d0000", bgTo: "#1a0000", glow: "rgba(255,68,68,0.6)",     symbol: "💀" },
    almamater:  { label: "ALMA MATER",   subLabel: "Vole le pli",       color: "#F6E05E", bgFrom: "#1a1600", bgTo: "#2d2400", glow: "rgba(246,224,94,0.7)",     symbol: "🌟" },
};

const INCARNATION_NAMES = ["Iop", "Sacrieur", "Roublard", "Crâ", "Osamodas"];

interface Props {
    type: CardType;
    name: string;
    cardId: string;
    size?: "sm" | "md" | "lg";
    playable?: boolean;
    selected?: boolean;
    sramChoice?: "incarnation" | "pandawa";
    onClick?: () => void;
}

const DIM = {
    sm: { w: 56, h: 84 },
    md: { w: 80, h: 120 },
    lg: { w: 110, h: 165 },
};

export const SpecialCard = memo(function SpecialCard({ type, name, cardId, size = "md", playable = true, selected = false, sramChoice, onClick }: Props) {
    const info = SPECIAL_INFO[type];
    const { w, h } = DIM[size];

    const getImagePath = () => {
        if (type === "incarnation") {
            if (name.includes("Iop")) return "/images/sigil-king/incarnations/iop.png";
            if (name.includes("Sacrieur")) return "/images/sigil-king/incarnations/Sacrieur.png";
            if (name.includes("Roublard")) return "/images/sigil-king/incarnations/Roublard.png";
            if (name.includes("Crâ")) return "/images/sigil-king/incarnations/Cra.png";
            if (name.includes("Osamodas")) return "/images/sigil-king/incarnations/Osamodas.png";
            return "/images/sigil-king/incarnations/iop.png";
        }
        if (type === "ogrest") return "/images/sigil-king/speciales/ogrest.png";
        if (type === "eniripsa") return "/images/sigil-king/speciales/eniripsa.png";
        if (type === "pandawa") return "/images/sigil-king/speciales/Pandawa.png";
        if (type === "sram") return "/images/sigil-king/speciales/sram.png";
        if (type === "devastator") return "/images/sigil-king/speciales/Devastateur.png";
        if (type === "almamater") return "/images/sigil-king/speciales/Baleine-Blanche.png";
        return "";
    };

    return (
        <motion.div
            layoutId={cardId}
            style={{ width: w, height: h }}
            className={`relative rounded-lg overflow-hidden border transition-all select-none
                ${!playable ? "opacity-30 grayscale cursor-not-allowed" : "cursor-pointer"}
                ${selected ? "ring-2 ring-amber-400 z-10 shadow-[0_0_25px_rgba(251,191,36,0.6)]" : "border-white/10 shadow-xl"}`}
            onClick={playable ? onClick : undefined}
            whileHover={playable ? { y: -10, scale: 1.06, rotate: 1, transition: { type: "spring", stiffness: 400, damping: 15 } } : {}}
        >
            {/* Character Illustration */}
            <img 
                src={getImagePath()} 
                className="absolute inset-0 w-full h-full object-cover"
                alt={name}
            />

            {/* Overlays & Labels */}
            <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${selected ? "from-amber-600/40" : "from-black/80 font-black"}`} />
            
            <div className="absolute bottom-0 left-0 right-0 p-1.5 flex flex-col items-center">
                <span className="text-[7px] uppercase tracking-tighter text-white/60 font-bold">{info.label}</span>
                <span className={`uppercase font-black italic leading-none truncate w-full text-center
                    ${size === "lg" ? "text-[11px]" : "text-[9px]"}`}
                    style={{ color: info.color, textShadow: "0 2px 4px rgba(0,0,0,0.8)", fontFamily: "'Cinzel', serif" }}>
                    {name}
                </span>
            </div>

            {/* Sram specific overlay */}
            {type === "sram" && sramChoice && (
                <div className="absolute top-2 right-2 bg-black/60 rounded-full w-6 h-6 flex items-center justify-center border border-amber-500 shadow-lg">
                    <span className="text-xs">{sramChoice === "incarnation" ? "⚔️" : "🍶"}</span>
                </div>
            )}

            {/* Effect Glow */}
            <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
                style={{ background: `radial-gradient(circle at 50% 40%, ${info.glow} 0%, transparent 70%)` }} 
            />
        </motion.div>
    );
});
